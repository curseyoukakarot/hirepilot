import { Request, Response } from 'express';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';
import fetch from 'node-fetch';
import { completeOnboardingStep } from '../lib/onboarding';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function rexChat(req: Request, res: Response) {
  if ((req as any)?.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const safeBody = (req as any)?.body || {};
  const { userId, messages, campaign_id, conversationId } = safeBody as {
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

    // ===============================================
    // Deterministic pre-processor for explicit intents
    // ===============================================
    try {
      const lastUserMsg = [...(messages || [])].reverse().find(m => m.role === 'user');
      const lastUserText = String((lastUserMsg as any)?.content || '').toLowerCase();
      // Slack setup intent: provide exact instructions with correct URLs without waiting for tool calls
      if (/(setup|set\s*up|enable).*(rex).*slack|slack.*(setup|set\s*up).*rex/.test(lastUserText)) {
        const base = process.env.BACKEND_URL || process.env.BACKEND_PUBLIC_URL || 'https://api.thehirepilot.com';
        const urls = {
          commands: `${base}/api/slack/commands`,
          interactivity: `${base}/api/slack/interactivity`,
          events: `${base}/api/slack/events`
        };
        const text = [
          'Here\'s how to enable REX in your Slack workspace:',
          '1) Go to https://api.slack.com/apps → Create New App → From scratch → Name: "HirePilot (REX)" and choose your workspace.',
          `2) Slash Commands → Create new → Command: /rex → Request URL: ${urls.commands} → Usage hint: /rex link me → Save.`,
          `3) Interactivity & Shortcuts → Toggle ON → Request URL: ${urls.interactivity} → Save.`,
          `4) (Optional) Event Subscriptions → Toggle ON → Request URL: ${urls.events} → Add bot event: app_mention → Save.`,
          '5) OAuth & Permissions → Bot Token Scopes → add: commands, chat:write, channels:read, users:read → Install to workspace.',
          '6) In Slack, invite the bot to a channel with /invite @YourBot → then run /rex link me and /rex hello.'
        ].join('\n');
        return res.status(200).json({ reply: { role:'assistant', content: text } });
      }
      let providerHint: 'sendgrid'|'google'|'outlook'|null = null;

      // Pattern A: "send from my <provider> account"
      const providerMatch = /(send\s+from\s+my\s+)(sendgrid|google|outlook)(\s+account)?/i.exec(String((lastUserMsg as any)?.content || ''));
      if (providerMatch) {
        providerHint = providerMatch[2].toLowerCase() as any;
        try {
          await supabase
            .from('user_settings')
            .upsert({ user_id: userId, preferred_email_provider: providerHint }, { onConflict: 'user_id' });
          console.log('[rexChat][pre] set preferred provider', { userId, provider: providerHint });
        } catch (e) {
          console.warn('[rexChat][pre] failed to set preferred provider', (e as any)?.message || e);
        }
      }

      // Pattern B: "send/email ... to lead <uuid>" (or "lead id: <uuid>")
      const sendLeadMatch = /(send|email)[^\n]*?(?:to|lead)[^\n]*?(?:lead[-_\s]*id[:\s]*)?([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i.exec(String((lastUserMsg as any)?.content || ''));
      if (sendLeadMatch) {
        const leadId = sendLeadMatch[2];

        // Extract a recent draft from the previous assistant message
        const prevAssistant = [...(messages || [])].slice(0, Math.max(0, (messages || []).length - 1)).reverse().find(m => m.role === 'assistant');
        const assistantText = prevAssistant
          ? (typeof (prevAssistant as any).content === 'string'
              ? String((prevAssistant as any).content)
              : String((prevAssistant as any)?.content?.text || ''))
          : '';

        // Very lightweight subject/body parsing
        let subject = '';
        const subjMatch = /\*\*?subject\*\*?\s*:?\s*(.+)/i.exec(assistantText) || /subject\s*:?\s*(.+)/i.exec(assistantText);
        if (subjMatch) subject = subjMatch[1].trim();
        if (!subject) subject = 'Message';
        let html = assistantText ? assistantText.replace(/\n/g, '<br/>') : '';

        if (!html) {
          console.log('[rexChat][pre] no draft html located; falling back to model');
        } else {
          try {
            const { server: rexServer } = await import('../rex/server');
            const caps = rexServer.getCapabilities?.();
            const tool = caps?.tools?.['send_email_to_lead'];
            if (!tool?.handler) throw new Error('send_email_to_lead tool not available');
            const result = await tool.handler({ userId, lead_id: leadId, subject, html, provider: providerHint || undefined });
            if (result?.ok) {
              const used = result?.used || providerHint || 'provider';
              return res.status(200).json({ reply: { role: 'assistant', content: `Email sent to lead ${leadId} via ${used}.` } });
            }
            if (result?.error === 'NO_EMAIL_PROVIDER') {
              return res.status(200).json({ reply: { role: 'assistant', content: 'You need to connect an email service first (SendGrid, Google, or Outlook). Go to Settings → Integrations to connect.' } });
            }
            // If tool returned non-ok, fall through to model
            console.warn('[rexChat][pre] send_email_to_lead returned non-ok', result);
          } catch (preErr) {
            console.warn('[rexChat][pre] send_email_to_lead error', (preErr as any)?.message || preErr);
          }
        }
      }
    } catch (preTopErr) {
      console.warn('[rexChat][pre] preprocessor top-level error', (preTopErr as any)?.message || preTopErr);
    }

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
            : `Sniper queued capture for this post. target_id=${queued?.target_id || ''} job_id=${queued?.job_id || ''} (ETA ~${queued?.eta_seconds || 60}s). Say: "poll sniper ${queued?.target_id}" to fetch results.`;
          return res.status(200).json({ reply: { role: 'assistant', content: summary } });
        }
      }
    } catch {}

    // Hard short-circuit: campaign LinkedIn outreach using a named LinkedIn request template
    try {
      const lastUserMsgEarly = [...(messages || [])].reverse().find(m => m.role === 'user');
      const raw = String(lastUserMsgEarly?.content || '');
      const text = raw.toLowerCase();
      const wantsLinkedInOutreach = /(send|queue).*(linkedin).*(outreach|connect|connection)/i.test(text);
      const wantsCampaign = /campaign/i.test(text);
      const tplMatch = /template[^"'`]*["'`]\s*([^"'`]+?)\s*["'`]/i.exec(raw);
      if (wantsLinkedInOutreach && wantsCampaign && tplMatch?.[1]) {
        const templateName = String(tplMatch[1]).trim();
        const { server: rexServer } = await import('../rex/server');
        const caps = rexServer.getCapabilities?.();
        const tool = caps?.tools?.['sniper_campaign_outreach_connect'];
        if (tool?.handler) {
          const result: any = await withTimeout(tool.handler({ userId, campaign_id: 'latest', template_name: templateName }), 45000);
          const summary = result?.error_code === 'CLOUD_ENGINE_DISABLED' && result?.help
            ? String(result.help)
            : result?.error
              ? `LinkedIn outreach failed: ${result.error}`
            : `Queued LinkedIn connect requests for campaign (template: "${templateName}"). job_id=${result?.job_id || ''} requested=${result?.requested || 0}. Track in /sniper/activity.`;
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
      // Slack setup guide
      { type:'function', function:{ name:'slack_setup_guide', parameters:{ type:'object', properties:{ userId:{ type:'string' } }, required:['userId'] } } },
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
      // Bulk campaign email helpers
      // Preferred auto tool: uses template when available, falls back to draft
      { type:'function', function:{ name:'send_campaign_email_auto', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string', optional:true}, subject:{type:'string', optional:true}, html:{type:'string', optional:true}, scheduled_for:{type:'string', optional:true}, channel:{type:'string', optional:true} }, required:['userId','campaign_id'] } } },
      { type:'function', function:{ name:'set_preferred_email_provider', parameters:{ type:'object', properties:{ userId:{type:'string'}, provider:{type:'string', enum:['sendgrid','google','outlook'] } }, required:['userId','provider'] } } },
      { type:'function', function:{ name:'send_email_to_lead', parameters:{ type:'object', properties:{ userId:{type:'string'}, lead_id:{type:'string'}, subject:{type:'string', optional:true}, html:{type:'string', optional:true}, provider:{type:'string', optional:true} }, required:['userId','lead_id'] } } },
      // Sequence enrollment by name
      { type:'function', function:{ name:'enroll_campaign_in_sequence_by_name', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, sequence_name:{type:'string'}, start_time_local:{type:'string'}, timezone:{type:'string'}, provider:{type:'string'} }, required:['userId','campaign_id','sequence_name'] } } },
      // Create a sequence from a template + delays then enroll
      { type:'function', function:{ name:'create_sequence_from_template_and_enroll', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string'}, delays_business_days:{type:'array', items:{ type:'number' }}, timezone:{type:'string'}, start_time_local:{type:'string'}, provider:{type:'string'} }, required:['userId','campaign_id','template_name','delays_business_days'] } } },
      // Resume / LinkedIn intelligence tools
      { type:'function', function:{ name:'resume_intelligence', parameters:{ type:'object', properties:{ mode:{type:'string', enum:['analyze','rewrite','coach','builder_generate']}, resume_text:{type:'string'}, linkedin_text:{type:'string'}, target_role:{type:'string'}, target_title:{type:'string'}, user_context:{type:'string'} }, required:['mode','resume_text'] } } },
      { type:'function', function:{ name:'resume_scoring', parameters:{ type:'object', properties:{ resume_text:{type:'string'}, target_role:{type:'string'} }, required:['resume_text'] } } },
      { type:'function', function:{ name:'linkedin_intelligence', parameters:{ type:'object', properties:{ mode:{type:'string', enum:['analyze','rewrite']}, linkedin_text:{type:'string'}, resume_text:{type:'string'}, target_role:{type:'string'} }, required:['mode','linkedin_text'] } } },
      { type:'function', function:{ name:'resume_to_outreach', parameters:{ type:'object', properties:{ resume_json:{type:'object'}, target_role:{type:'string'}, company_context:{type:'string'} }, required:['resume_json'] } } },
      {
        type:'function',
        function:{
          name:'create_persona_auto_track',
          parameters:{
            type:'object',
            properties:{
              userId:{type:'string'},
              persona_id:{type:'string'},
              campaign_mode:{type:'string', enum:['use_existing','create_new']},
              existing_campaign_id:{type:'string', nullable:true},
              new_campaign_name:{type:'string', nullable:true},
              cadence:{type:'string'},
              day_of_week:{type:'string', nullable:true},
              time_utc:{type:'string'},
              leads_per_run:{type:'number'},
              send_delay_minutes:{type:'number'},
              daily_send_cap:{type:'number', nullable:true}
            },
            required:['userId','persona_id','campaign_mode','cadence','time_utc','leads_per_run','send_delay_minutes']
          }
        }
      },
      // Campaign controls
      { type:'function', function:{ name:'sourcing_pause_campaign', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'} }, required:['userId','campaign_id'] } } },
      { type:'function', function:{ name:'sourcing_resume_campaign', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'} }, required:['userId','campaign_id'] } } },
      { type:'function', function:{ name:'sourcing_cancel_campaign', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'} }, required:['userId','campaign_id'] } } },
      // Sniper v1 (Cloud Engine) tools
      { type:'function', function:{ name:'sniper_collect_post', parameters:{ type:'object', properties:{ userId:{type:'string'}, post_url:{type:'string'}, limit:{type:'number'} }, required:['userId','post_url'] } } },
      { type:'function', function:{ name:'sniper_poll_leads', parameters:{ type:'object', properties:{ userId:{type:'string'}, target_id:{type:'string'}, job_id:{type:'string'}, limit:{type:'number'}, cursor:{type:'string'} }, required:['userId'] } } },
      { type:'function', function:{ name:'sniper_campaign_outreach_connect', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string'}, max_count:{type:'number'} }, required:['userId','template_name'] } } },
      { type:'function', function:{ name:'sniper_send_message_to_profile', parameters:{ type:'object', properties:{ userId:{type:'string'}, profile_url:{type:'string'}, lead_id:{type:'string'}, template_name:{type:'string'}, message:{type:'string'} }, required:['userId'] } } }
    ];

    // Lightweight endpoint: weekly check-in hook (called by cron)
    const reqPath = String((req as any)?.path || (req as any)?.url || '');
    const reqMethod = String((req as any)?.method || 'POST');
    if (reqPath.endsWith('/rex/checkin') && reqMethod === 'POST') {
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
      content: `You are REX, a recruiting and career agent.
If the user asks to source leads or create a campaign with a target title/location/count and does NOT clearly specify the lead source, first ask ONE concise clarifying question: "Which lead source should I use: Apollo (fast, verified emails) or LinkedIn (connection workflow)?" and wait for their answer before calling any tools.
If the user specifies the source, immediately call the tool 'source_leads' with { userId, campaignId: 'latest', source: '<apollo|linkedin>', filters: { title: <normalized title>, location: <city, state>, count: <N> } }.
If the user doesn’t answer the clarifying question, default to Apollo after one follow-up.
Be concise. Do not output generic plans when a tool can fulfill the request.
Note: If 'linkedin' is chosen and it is not available, clearly state that LinkedIn sourcing is queued and offer to proceed with Apollo.
If the user asks to "go to this LinkedIn post" or to "pull everyone who liked/commented on a post" and provides a LinkedIn post URL, call the tool 'sniper_collect_post' with { userId, post_url: <url>, limit: 0 }. Do not send outreach; simply return queued status (target_id, job_id) and ETA.
If the user says "poll sniper <target_id>" or asks to check results for a target/campaign, call 'sniper_poll_leads' with { userId, target_id: <uuid>, limit: 50 } and return leads plus last run status.
If the user asks: "send linkedin outreach to the campaign you just created" AND provides a LinkedIn request template name, call 'sniper_campaign_outreach_connect' with { userId, campaign_id: 'latest', template_name: '<name>' } and then tell them to monitor results in /sniper/activity.
If the user asks to send a LinkedIn message to someone they are already connected to, call 'sniper_send_message_to_profile' with either { userId, lead_id } or { userId, profile_url } and include message content or template_name.
When the user asks to email the newly sourced campaign using a named template, do this:
1) If they ask for a preview, call 'preview_campaign_email' with { userId, campaign_id: '<latest or given>', template_name } and return the subject/body.
2) If they confirm sending, call 'send_campaign_email_by_template_name' with { userId, campaign_id: '<latest or given>', template_name } and report how many were queued.
Prefer using these bulk tools instead of single-lead tools when the intent is to email a whole campaign.
If the user asks to send using a sequence template by name (e.g., "send with sequence XYZ every 2 business days"), resolve the sequence by name and call 'enroll_campaign_in_sequence_by_name' with { userId, campaign_id: '<latest or given>', sequence_name: 'XYZ', start_time_local: '<now or provided>', timezone: 'America/Chicago' }. The business-day spacing comes from the sequence steps; do not hardcode delays.
If the user says "send using template <NAME>" but does not provide timing for steps, ask a single follow-up question to collect step timing (e.g., "When should step 1, 2, and 3 send? (e.g., 0,2,4 business days)"), then call 'create_sequence_from_template_and_enroll' with delays_business_days like [0,2,4].
If the user explicitly says "send from my <provider> account" where <provider> is sendgrid/google/outlook, call 'set_preferred_email_provider' with that provider before sending.
If the user requests a recurring persona sourcing schedule that automatically enrolls new leads into a campaign ("auto track", "source 50 personas weekly and auto-email", "REX take the order"), gather details in this order with short confirmations:
1) Persona to use (offer known personas if unclear).
2) Outreach campaign plan: ask whether to use an existing campaign or create a new one (collect campaign name when creating).
3) Cadence + timing (daily vs weekly, ask for day/time if weekly; capture HH:MM in user's stated timezone or default to America/Chicago then convert to UTC).
4) Volume + safety: leads per run, whether to send immediately or delay (collect delay in hours → minutes), and optional daily send cap.
Once you have these answers, call 'create_persona_auto_track' with the gathered values (convert hours to minutes, ensure cadence/day/time are populated). After the tool succeeds, confirm the schedule back to the user with persona, campaign, cadence, leads/run, delay, and daily cap.
RESUME / LINKEDIN HELP:
- If the user asks for resume or LinkedIn help, or uploads a resume/profile, use the resume tools:
  - resume_intelligence (modes: analyze|rewrite|coach|builder_generate)
  - resume_scoring
  - linkedin_intelligence
  - resume_to_outreach
- Default to resume_intelligence mode=analyze for first pass; use rewrite when asked for a rewrite; use coach when they want strategy; use builder_generate only when asked for builder-prefill JSON.
- When files are attached, summarize key signals first, then choose the right mode.
Tone: first-person, hiring-manager aware, outcome-focused, no ATS keyword stuffing. Coaching first, rewriting when requested.
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
        // Force new campaign for sourcing; resolve 'latest' for sending
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
          if (toolName === 'send_campaign_email_auto') {
            const cid = String(args?.campaign_id || '').trim();
            const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cid);
            if (!cid || cid === 'latest' || !looksUuid) {
              // Find the most recent classic campaign for this user
              const { data: latest } = await supabase
                .from('campaigns')
                .select('id,created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (latest?.id) args.campaign_id = latest.id;
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

      // Safety net: ensure every tool_call_id has a tool response
      const toolResponseIds = new Set(
        messages.filter((m: any) => m.role === 'tool' && m.tool_call_id).map((m: any) => m.tool_call_id)
      );
      for (const call of toolCalls) {
        if (!toolResponseIds.has(call.id)) {
          messages.push(
            assistantMessage as any,
            {
              role: 'tool',
              tool_call_id: call.id,
              name: call.function?.name || call.name || 'unknown_tool',
              content: JSON.stringify({ error: 'tool response missing; auto-inserted stub' })
            } as any
          );
        }
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
            const summary = `Sniper queued capture for this post. target_id=${toolResultAny?.target_id || ''} job_id=${toolResultAny?.job_id || ''} (ETA ~${toolResultAny?.eta_seconds || 60}s). Say: "poll sniper ${toolResultAny?.target_id}" to fetch results.`;
            assistantMessage = { role: 'assistant', content: summary } as any;
          }
        }
      } catch (fallbackErr) {
        console.error('[rexChat] fallback error', fallbackErr);
      }
    }

    // After tools: normalize messaging for common actions and add nudges
    try {
      const lastUser = messages[messages.length - 1];
      const text = String(lastUser?.content || '').toLowerCase();
      const wantsOutreach = /(reach out|email|send|outreach|contact)/.test(text);
      const mentionsNewCampaign = /create\s+(a\s+)?new\s+campaign|\bnew\s+campaign\b/.test(text);
      // If tool queued emails, reply deterministically (avoid model hallucinations like "draft mode")
      if (lastToolResult && typeof lastToolResult.queued === 'number') {
        const mode = String(lastToolResult.mode || 'draft');
        const count = Number(lastToolResult.queued || 0);
        const when = lastToolResult.scheduled_for ? ` Scheduled for ${lastToolResult.scheduled_for}.` : '';
        const textResp = `Queued ${count} emails via ${mode === 'template' ? 'template' : 'custom draft'} using SendGrid.${when} They will be sent automatically; no manual action in SendGrid is required.`;
        assistantMessage = { role: 'assistant', content: textResp } as any;
      }
      // If the queue/worker reported missing provider
      if (lastToolResult && lastToolResult.error === 'NO_EMAIL_PROVIDER') {
        assistantMessage = { role: 'assistant', content: 'You need to connect an email service first (SendGrid, Google, or Outlook). Go to Settings → Integrations to connect.' } as any;
      }
      // If Sniper Cloud Engine is disabled, explain how to enable it
      if (lastToolResult && lastToolResult.error_code === 'CLOUD_ENGINE_DISABLED' && lastToolResult.help) {
        assistantMessage = { role: 'assistant', content: String(lastToolResult.help) } as any;
      }
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

    // Onboarding: first chat message triggers activation
    try {
      await completeOnboardingStep(userId, 'rex_chat_activated', {});
    } catch (e) {
      console.error('onboarding rex_chat_activated failed', e);
    }

    return res.status(200).json({ reply: assistantMessage });
  } catch (err: any) {
    console.error('[rexChat] Error:', err?.stack || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 