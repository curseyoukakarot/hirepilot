import { Request, Response } from 'express';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function rexChat(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, messages } = req.body as {
    userId?: string;
    messages?: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!userId || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing userId or messages array' });
  }

  // Ensure CORS header is always present for browser callers
  res.set('Access-Control-Allow-Origin', '*');

  try {
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

    console.log('rexChat role check', { userType });
    const allowedRoles = ['RecruitPro','Recruiter','User','TeamAdmin','SuperAdmin','super_admin'];
    const allowed = !userType || allowedRoles.includes(userType);
    if (!allowed) {
      return res.status(403).json({ error: 'REX access forbidden for this user' });
    }

    // Tool definitions (sync with server capabilities)
    const tools: any = [
      {
        type: 'function',
        function: {
          name: 'schedule_campaign',
          parameters: { type: 'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, send_time:{type:'string'} }, required:['userId','campaign_id','send_time'] }
        }
      },
      { type:'function',function:{name:'send_email',parameters:{ type:'object', properties:{ userId:{type:'string'}, to:{type:'string'}, subject:{type:'string'}, body:{type:'string'}}, required:['userId','to','subject','body']}}},
      { type:'function',function:{name:'enrich_lead',parameters:{ type:'object', properties:{ userId:{type:'string'}, linkedin_url:{type:'string'}}, required:['userId','linkedin_url']}}},
      { type:'function',function:{name:'get_campaign_metrics',parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}}, required:['userId','campaign_id']}}}
    ];

    let completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
    });

    let assistantMessage = completion.choices[0].message;

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