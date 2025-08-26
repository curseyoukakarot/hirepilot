import { Request, Response } from 'express';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';
import fetch from 'node-fetch';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function rexChat(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, messages, campaign_id, conversationId } = req.body as {
    userId?: string;
    messages?: { role: 'user' | 'assistant'; content: string }[];
    campaign_id?: string;
    conversationId?: string;
  };

  if (!userId || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing userId or messages array' });
  }

  // Ensure CORS header is always present for browser callers
  res.set('Access-Control-Allow-Origin', '*');

  try {
    // Forward auth header for RLS-bound internal calls
    const authHeader = req.headers.authorization || '';

    // 1. Fetch user from Supabase
    const { data: userRow, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }

    let userType: string | null = (userRow?.role as string) || null;

    if (!userType) {
      // Fallback to auth metadata
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - admin API
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      userType = (authUser?.user?.user_metadata as any)?.role || (authUser?.user?.user_metadata as any)?.account_type || null;
    }

    // Check rex feature flag in integrations
    const { data: integ } = await supabase
      .from('integrations')
      .select('status')
      .eq('user_id', userId)
      .eq('provider', 'rex')
      .maybeSingle();

    const rexEnabled = ['enabled', 'connected', 'on', 'true'].includes(String(integ?.status || '').toLowerCase());
    console.log('rexChat role check', { userType, rexEnabled });
    const roleLc = (userType || '').toLowerCase();
    const allowedRoles = ['recruitpro','recruiter','user','teamadmin','team_admin','superadmin','super_admin','admin','member'];
    const allowed = rexEnabled || !userType || allowedRoles.includes(roleLc);
    if (!allowed) {
      return res.status(403).json({ error: 'REX access forbidden for this user' });
    }

    // Tool definitions (sync with server capabilities). Add new tools here so the model knows they exist.
    const tools: any = [
      {
        type: 'function',
        function: {
          name: 'schedule_campaign',
          parameters: { type: 'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, send_time:{type:'string'} }, required:['userId','campaign_id','send_time'] }
        }
      },
      {
        type:'function',
        function:{
          name:'send_email',
          parameters:{
            type:'object',
            properties:{
              userId:{type:'string'},
              to:{type:'string'},
              subject:{type:'string'},
              body:{type:'string'},
              provider:{type:'string'},
              template_name:{type:'string'},
              template_id:{type:'string'}
            },
            // Only require userId and to; subject/body are optional because a template may be used
            required:['userId','to']
          }
        }
      },
      {
        type:'function',
        function:{
          name:'list_email_templates',
          parameters:{ type:'object', properties:{ userId:{type:'string'}, query:{type:'string'} }, required:['userId'] }
        }
      },
      {
        type:'function',
        function:{
          name:'send_template_email',
          parameters:{
            type:'object',
            properties:{ userId:{type:'string'}, lead:{type:'string'}, template_name:{type:'string'}, template_id:{type:'string'}, provider:{type:'string'} },
            required:['userId','lead']
          }
        }
      },
      { type:'function',function:{name:'enrich_lead',parameters:{ type:'object', properties:{ userId:{type:'string'}, linkedin_url:{type:'string'}}, required:['userId','linkedin_url']}}},
      { type:'function',function:{name:'get_campaign_metrics',parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}}, required:['userId','campaign_id']}}},
      // Lead sourcing and filtering
      { type:'function',function:{name:'source_leads',parameters:{ type:'object', properties:{ userId:{type:'string'}, campaignId:{type:'string'}, source:{type:'string'}, filters:{type:'object'}}, required:['userId','campaignId','source']}}},
      { type:'function',function:{name:'filter_leads',parameters:{ type:'object', properties:{ userId:{type:'string'}, campaignId:{type:'string'}, filters:{ type:'object', properties:{ title:{type:'string'}, synonyms:{type:'boolean'}, strict_level:{type:'boolean'}, has_email:{type:'boolean'}, verified_only:{type:'boolean'}, personal_email_only:{type:'boolean'}, limit:{type:'number'}, count:{type:'number'} } }}, required:['userId']}}},
      // Lead → Candidate conversion
      { type:'function',function:{name:'convert_lead_to_candidate',parameters:{ type:'object', properties:{ userId:{type:'string'}, leadId:{type:'string'}}, required:['userId','leadId']}}},
      // New pipeline tools
      { type:'function',function:{name:'move_candidate',parameters:{ type:'object', properties:{ userId:{type:'string'}, candidateId:{type:'string'}, newStage:{type:'string'} }, required:['userId','candidateId','newStage']}}},
      { type:'function',function:{name:'move_candidate_to_stage',parameters:{ type:'object', properties:{ userId:{type:'string'}, candidate:{type:'string'}, stage:{type:'string'}, jobId:{type:'string'} }, required:['userId','candidate','stage']}}}
    ];

    const contextMessage = {
      role: 'system',
      content: `CONTEXT: userId=${userId}${campaign_id ? `, latest_campaign_id=${campaign_id}` : ''}`
    } as any;

    let completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [contextMessage, ...messages],
      tools,
    });

    let assistantMessage = completion.choices[0].message;

    // ---------------- Persist conversation & messages -----------------
    try {
      // Determine conversation id (create if not provided)
      let convId = conversationId as string | undefined;
      const lastUserMsg = [...(messages || [])].reverse().find(m => m.role === 'user');
      const title = (lastUserMsg?.content || 'New chat').slice(0, 120);
      if (!convId) {
        const createResp = await fetch(`${process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`}/api/rex/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
          body: JSON.stringify({ title })
        });
        const created = await createResp.json();
        convId = created?.conversation?.id;
      }

      if (convId && lastUserMsg) {
        // Save user message
        await fetch(`${process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`}/api/rex/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
          body: JSON.stringify({ role: 'user', content: { text: lastUserMsg.content } })
        });
      }

      if (convId && assistantMessage) {
        // Save assistant message
        await fetch(`${process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`}/api/rex/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
          body: JSON.stringify({ role: 'assistant', content: assistantMessage })
        });
      }
    } catch (persistErr) {
      console.error('[rexChat] persist error', persistErr);
      // Do not fail chat on persistence errors
    }

    // If tool call requested
    const call = completion.choices[0].message.tool_calls?.[0] as any;
    if (call) {
      // OpenAI returns { id, function: { name, arguments } }
      const toolName: string | undefined = call.function?.name || call.name;
      if (!toolName) throw new Error('Tool name missing in tool_call');

      let args: any = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : call.arguments;
      } catch (_) {
        // If arguments not valid JSON, keep raw string
        args = call.function?.arguments || call.arguments;
      }

      const { server: rexServer } = await import('../rex/server');
      const capabilities = rexServer.getCapabilities?.();
      if (!capabilities?.tools?.[toolName]?.handler) {
        throw new Error(`Tool handler not found for ${toolName}`);
      }

      const toolResult = await capabilities.tools[toolName].handler(args);

      // Feed the tool result back into the conversation
      messages.push(
        assistantMessage as any,
        {
          role: 'tool',
          tool_call_id: call.id,
          name: toolName,
          content: JSON.stringify(toolResult)
        } as any
      );

      completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages });
      assistantMessage = completion.choices[0].message;
    }

    return res.status(200).json({ reply: assistantMessage });
  } catch (err: any) {
    console.error('[rexChat] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 