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
    const withTimeout = async <T>(p: Promise<T>, ms = 25000): Promise<T> => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        // OpenAI SDK respects global timeout via client, but for any fetches we pass signal when possible
        // For generic promises, race with a timeout
        return await Promise.race([
          p,
          new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
        ] as [Promise<T>, Promise<T>]);
      } finally {
        clearTimeout(t);
      }
    };
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
    // Allow all users to access REX - no restrictions (temporary override)
    const allowed = true;

    // Hard short-circuit: Sniper LinkedIn post collection (avoid model decision-making)
    try {
      const lastUserMsgEarly = [...(messages || [])].reverse().find(m => m.role === 'user');
      const textEarly = String(lastUserMsgEarly?.content || '').toLowerCase();
      const urlEarly = /https?:\/\/[^\s]*linkedin\.com\/posts\/[^\s]+/i.exec(String(lastUserMsgEarly?.content || ''))?.[0];
      const wantsLikersEarly = /like|liked|likers/.test(textEarly);
      if (urlEarly && wantsLikersEarly) {
        const { server: rexServer } = await import('../rex/server');
        const caps = rexServer.getCapabilities?.();
        const sniper = caps?.tools?.['sniper_collect_post'];
        if (sniper?.handler) {
          const queued: any = await (async () => {
            try { return await sniper.handler({ userId, post_url: urlEarly, limit: 0 }); }
            catch (e:any) { return { error: String(e?.message || e) }; }
          })();
          const summary = queued?.error
            ? `Sniper queue failed: ${queued.error}`
            : `Sniper queued capture for this post. target_id=${queued?.target_id || ''} campaign_id=${queued?.campaign_id || ''} (ETA ~${queued?.eta_seconds || 60}s). Say: "poll sniper ${queued?.target_id}" to fetch results.`;
          return res.status(200).json({ reply: { role: 'assistant', content: summary } });
        }
      }
    } catch {}

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
      { type:'function',function:{name:'view_pipeline',parameters:{ type:'object', properties:{ userId:{type:'string'}, jobId:{type:'string'}, stage:{type:'string'}, staleDays:{type:'number'}, candidateName:{type:'string'} }, required:['userId','jobId']}}},
      { type:'function',function:{name:'move_candidate_to_stage',parameters:{ type:'object', properties:{ userId:{type:'string'}, candidate:{type:'string'}, stage:{type:'string'}, jobId:{type:'string'} }, required:['userId','candidate','stage']}}},
      { type:'function',function:{name:'move_candidate',parameters:{ type:'object', properties:{ userId:{type:'string'}, candidateId:{type:'string'}, newStage:{type:'string'} }, required:['userId','candidateId','newStage']}}},
      { type:'function',function:{name:'update_candidate_notes',parameters:{ type:'object', properties:{ userId:{type:'string'}, candidateId:{type:'string'}, note:{type:'string'}, author:{type:'string'} }, required:['userId','candidateId','note','author']}}},
      // Sniper tools (temporarily disabled)
      // { type:'function', function:{ name:'sniper_collect_post', parameters:{ type:'object', properties:{ userId:{type:'string'}, post_url:{type:'string'}, limit:{type:'number'} }, required:['userId','post_url'] } } },
      // { type:'function', function:{ name:'sniper_poll_leads', parameters:{ type:'object', properties:{ userId:{type:'string'}, target_id:{type:'string'}, campaign_id:{type:'string'}, limit:{type:'number'}, cursor:{type:'string'} }, required:['userId'] } } }
    ];

    // Lightweight endpoint: weekly check-in hook (called by cron)
    if (req.path.endsWith('/rex/checkin') && req.method === 'POST') {
      try {
        const { data: settings } = await supabase
          .from('user_settings')
          .select('last_rex_checkin_at, email, slack_webhook_url, campaign_updates')
          .eq('user_id', userId)
          .maybeSingle();
        const last = settings?.last_rex_checkin_at ? new Date(settings.last_rex_checkin_at) : null;
        const now = new Date();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (!last || now.getTime() - last.getTime() >= weekMs) {
          const message = `REX weekly check-in: Review your active campaigns: ${process.env.FRONTEND_BASE_URL || ''}/super-admin/sourcing`;
          if (settings?.campaign_updates && settings?.slack_webhook_url) {
            await (await import('axios')).default.post(settings.slack_webhook_url, { text: message });
          }
          if (settings?.email) {
            const sg = (await import('@sendgrid/mail')).default;
            // @ts-ignore
            sg.setApiKey(process.env.SENDGRID_API_KEY);
            await sg.send({ to: settings.email, from: process.env.SENDGRID_FROM || 'noreply@hirepilot.ai', subject: 'REX weekly check-in', text: message });
          }
          await supabase.from('user_settings').update({ last_rex_checkin_at: now.toISOString() }).eq('user_id', userId);
        }
        return res.status(200).json({ ok: true });
      } catch (e:any) {
        console.error('[rex/checkin]', e);
        return res.status(200).json({ ok: false });
      }
    }

    const contextMessage = {
      role: 'system',
      content: `You are REX, a recruiting agent.
If the user asks to source leads or create a campaign with a target title/location/count and does NOT clearly specify the lead source, first ask ONE concise clarifying question: "Which lead source should I use: Apollo (fast, verified emails) or LinkedIn (connection workflow)?" and wait for their answer before calling any tools.
If the user specifies the source, immediately call the tool 'source_leads' with { userId, campaignId: 'latest', source: '<apollo|linkedin>', filters: { title: <normalized title>, location: <city, state>, count: <N> } }.
If the user doesn’t answer the clarifying question, default to Apollo after one follow-up.
Be concise. Do not output generic plans when a tool can fulfill the request.
Note: If 'linkedin' is chosen and it is not available, clearly state that LinkedIn sourcing is queued and offer to proceed with Apollo.
If the user asks to "go to this LinkedIn post" or to "pull everyone who liked/commented on a post" and provides a LinkedIn post URL, call the tool 'sniper_collect_post' with { userId, post_url: <url>, limit: 0 }. Do not send outreach; simply return queued status (target_id, campaign_id) and ETA.
If the user says "poll sniper <target_id>" or asks to check results for a target/campaign, call 'sniper_poll_leads' with { userId, target_id: <uuid>, limit: 50 } and return leads plus last run status.
CONTEXT: userId=${userId}${campaign_id ? `, latest_campaign_id=${campaign_id}` : ''}`
    } as any;

    let completion = await withTimeout(openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [contextMessage, ...messages],
      tools,
    }), 30000);

    let assistantMessage = completion.choices[0].message;
    let executedSourcing = false;
    let lastToolResult: any = null;
    // Conversation id that we will persist messages into (reused across steps)
    let convId = conversationId as string | undefined;

    // ---------------- Persist conversation & messages -----------------
    try {
      // Determine conversation id (create if not provided)
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

      // Do not persist the initial assistant tool_call stub; we'll save the final reply after tools run
    } catch (persistErr) {
      console.error('[rexChat] persist error', persistErr);
      // Do not fail chat on persistence errors
    }

    // If tool calls were requested, process ALL of them to satisfy the API contract
    const toolCalls = completion.choices[0].message.tool_calls as any[] | undefined;
    if (toolCalls && toolCalls.length > 0) {
      const { server: rexServer } = await import('../rex/server');
      const capabilities = rexServer.getCapabilities?.();

      for (const call of toolCalls) {
        const toolName: string | undefined = call.function?.name || call.name;
        if (!toolName) continue;
        let args: any = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : call.arguments;
        } catch {
          args = call.function?.arguments || call.arguments;
        }
        // Force new campaign for sourcing
        try {
          if (toolName === 'source_leads') {
            const lastUserMsg = [...(messages || [])].reverse().find(m => m.role === 'user');
            const titleGuess = (String(lastUserMsg?.content || '').match(/find\s+\d+\s+(.+?)\s+in/i)?.[1] || 'Sourcing Campaign').slice(0,80);
            try {
              const { data: newCamp, error: newErr } = await supabase
                .from('sourcing_campaigns')
                .insert({ title: titleGuess, created_by: userId, audience_tag: 'rex' })
                .select('id')
                .single();
              if (newErr) throw newErr;
              args.campaignId = newCamp.id;
              await supabase
                .from('rex_user_context')
                .upsert({ supabase_user_id: userId, latest_campaign_id: newCamp.id }, { onConflict: 'supabase_user_id' });
            } catch {
              args.campaignId = `new_${Date.now()}`;
            }
          }
        } catch {}

        if (!capabilities?.tools?.[toolName]?.handler) {
          // Push an error tool response to satisfy API
          messages.push(
            assistantMessage as any,
            { role:'tool', tool_call_id: call.id, name: toolName, content: JSON.stringify({ error:`Tool handler not found for ${toolName}` }) } as any
          );
          continue;
        }

        let toolResult: any = null;
        try {
          toolResult = await withTimeout(capabilities.tools[toolName].handler(args), 45000);
        } catch (toolErr: any) {
          console.error('[rexChat] tool error', toolName, toolErr?.message || toolErr);
          toolResult = { error: String(toolErr?.message || toolErr) };
        }
        lastToolResult = toolResult;
        executedSourcing = executedSourcing || ['source_leads','filter_leads'].includes(toolName);
        messages.push(
          assistantMessage as any,
          { role:'tool', tool_call_id: call.id, name: toolName, content: JSON.stringify(toolResult) } as any
        );
      }

      // Now ask the model to respond after all tool results are included
      completion = await withTimeout(openai.chat.completions.create({ model: 'gpt-4o-mini', messages }), 30000);
      assistantMessage = completion.choices[0].message;
      // Persist the final assistant message (post-tools) only to the SAME conversation
      try {
        const lastUserMsg = [...(messages || [])].reverse().find(m => m.role === 'user');
        const title = (lastUserMsg?.content || 'New chat').slice(0, 120);
        // Ensure we have a conversation id; create only if still missing
        if (!convId) {
          const createResp2 = await fetch(`${process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`}/api/rex/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
            body: JSON.stringify({ title })
          });
          const created2 = await createResp2.json();
          convId = created2?.conversation?.id;
        }
        if (convId && assistantMessage) {
          // Sanitize assistant content to avoid persisting tool_calls or raw OpenAI message objects
          const assistantText = typeof (assistantMessage as any)?.content === 'string'
            ? (assistantMessage as any).content
            : typeof (assistantMessage as any)?.content?.text === 'string'
              ? (assistantMessage as any).content.text
              : '';
          await fetch(`${process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`}/api/rex/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
            body: JSON.stringify({ role: 'assistant', content: { text: assistantText } })
          });
        }
      } catch (persistFinalErr) {
        console.error('[rexChat] persist final reply error', persistFinalErr);
      }
    } else {
      // Deterministic fallback: if user asked for LinkedIn post likers, call sniper_collect_post directly (queued)
      try {
        const lastUserMsg = [...(messages || [])].reverse().find(m => m.role === 'user');
        const text = String(lastUserMsg?.content || '').toLowerCase();
        const urlMatch = /https?:\/\/[^\s]*linkedin\.com\/posts\/[^\s]+/i.exec(String(lastUserMsg?.content || ''));
        const wantsLikers = /like|liked|likers/.test(text);
        if (urlMatch && wantsLikers) {
          const postUrl = urlMatch[0];
          const { server: rexServer } = await import('../rex/server');
          const capabilities = rexServer.getCapabilities?.();
          const tool = capabilities?.tools?.['sniper_collect_post'];
          if (tool?.handler) {
            const toolResultAny: any = await withTimeout(tool.handler({ userId, post_url: postUrl, limit: 0 }), 45000);
            const summary = `Sniper queued capture for this post. target_id=${toolResultAny?.target_id || ''} campaign_id=${toolResultAny?.campaign_id || ''} (ETA ~${toolResultAny?.eta_seconds || 60}s). Say: "poll sniper ${toolResultAny?.target_id}" to fetch results.`;
            assistantMessage = { role: 'assistant', content: summary } as any;
          }
        }
      } catch (fallbackErr) {
        console.error('[rexChat] fallback error', fallbackErr);
      }
    }

    // After a successful lead sourcing request without explicit outreach intent, gently append a nudge
    try {
      const lastUser = messages[messages.length - 1];
      const text = String(lastUser?.content || '').toLowerCase();
      const wantsOutreach = /(reach out|email|send|outreach|contact)/.test(text);
      const mentionsNewCampaign = /create\s+(a\s+)?new\s+campaign|\bnew\s+campaign\b/.test(text);
      // Use the actual tool result we just executed
      if (lastToolResult && (lastToolResult.campaign_id || lastToolResult.std_campaign_id)) {
        const viewText = `\n\nView in Agent Mode: /agent-mode?campaign=${lastToolResult.campaign_id || ''}` +
                         `\nView in Leads: /leads?campaign=${lastToolResult.std_campaign_id || ''}`;
        if (assistantMessage?.content && typeof (assistantMessage as any).content === 'string') {
          (assistantMessage as any).content += viewText;
        } else if (assistantMessage?.content && typeof (assistantMessage as any).content?.text === 'string') {
          (assistantMessage as any).content.text += viewText;
        }
      }
      if (executedSourcing && !wantsOutreach && ((lastToolResult?.imported || 0) > 0)) {
        const nudgeText = '\n\nDo you want me to start outreach to these leads now? If yes, say the tone (e.g., casual, professional) and I will draft the opener.';
        if (assistantMessage?.content && typeof (assistantMessage as any).content === 'string') {
          (assistantMessage as any).content = (assistantMessage as any).content.replace(/no leads[^\n]*/i, '').trim() + nudgeText;
        } else if (assistantMessage?.content && typeof (assistantMessage as any).content?.text === 'string') {
          (assistantMessage as any).content.text = (assistantMessage as any).content.text.replace(/no leads[^\n]*/i, '').trim() + nudgeText;
        }
      }
    } catch {}

    return res.status(200).json({ reply: assistantMessage });
  } catch (err: any) {
    console.error('[rexChat] Error:', err?.stack || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 