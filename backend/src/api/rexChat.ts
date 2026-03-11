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
  const { userId, messages, campaign_id, conversationId, metadata } = safeBody as {
    userId?: string;
    messages?: { role: 'user' | 'assistant'; content: string }[];
    campaign_id?: string;
    conversationId?: string;
    metadata?: any;
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
            ? `Cloud Engine queue failed: ${queued.error}`
            : `Cloud Engine queued capture for this post. target_id=${queued?.target_id || ''} job_id=${queued?.job_id || ''} (ETA ~${queued?.eta_seconds || 60}s). Say: "poll results ${queued?.target_id}" to fetch results.`;
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
            : `Queued LinkedIn connect requests for campaign (template: "${templateName}"). job_id=${result?.job_id || ''} requested=${result?.requested || 0}. Track in /cloud-engine/activity.`;
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
      { type:'function',function:{name:'source_leads',parameters:{ type:'object', properties:{ userId:{type:'string'}, campaignId:{type:'string'}, source:{type:'string',description:'Lead source: "apollo" (default, fast) or "linkedin"'}, filters:{type:'object', description:'Search criteria for finding leads', properties:{ title:{type:'string',description:'Job title to search for (e.g. "CISO", "VP Engineering", "Head of Sales")'}, location:{type:'string',description:'Location to search in (e.g. "San Francisco", "New York, NY", "London, UK")'}, keywords:{type:'string',description:'Additional keywords for broader search'}, count:{type:'number',description:'Number of leads to return (default 25, max 200)'}, booleanSearch:{type:'boolean',description:'Use Boolean syntax in title field (e.g. "CISO OR Chief Information Security Officer")'}}, required:['title','location']}}, required:['userId','campaignId','source']}}},
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
      { type:'function', function:{ name:'sniper_send_message_to_profile', parameters:{ type:'object', properties:{ userId:{type:'string'}, profile_url:{type:'string'}, lead_id:{type:'string'}, template_name:{type:'string'}, message:{type:'string'} }, required:['userId'] } } },
      // Sniper V2: Agentic browser settings & status tools
      { type:'function', function:{ name:'sniper_update_settings', parameters:{ type:'object', properties:{ userId:{type:'string'}, max_connects_per_day:{type:'number'}, max_messages_per_day:{type:'number'}, min_delay_seconds:{type:'number'}, max_delay_seconds:{type:'number'}, active_hours_start:{type:'string'}, active_hours_end:{type:'string'}, active_hours_days:{type:'string'}, timezone:{type:'string'}, safety_mode:{type:'boolean'}, provider:{type:'string'}, cloud_engine_enabled:{type:'boolean'}, max_actions_per_day:{type:'number'}, max_actions_per_hour:{type:'number'}, cooldown_minutes:{type:'number'} }, required:['userId'] } } },
      { type:'function', function:{ name:'sniper_get_status', parameters:{ type:'object', properties:{ userId:{type:'string'}, job_id:{type:'string'} }, required:['userId'] } } },
      // Sniper v1 Cloud Engine mission tools
      { type:'function', function:{ name:'sniper_decision_makers', description:'Find decision makers at a company. Queues a Cloud Engine mission.', parameters:{ type:'object', properties:{ userId:{type:'string'}, company_url:{type:'string',description:'LinkedIn company URL (e.g. https://www.linkedin.com/company/nebius/)'}, company_name:{type:'string',description:'Company name for display'}, criteria:{type:'string',description:'Who to look for, e.g. "VP Engineering who would buy our AI platform"'}, limit:{type:'number',description:'Max profiles to return (default 10)'} }, required:['userId','company_url'] } } },
      { type:'function', function:{ name:'sniper_people_search', description:'Run a LinkedIn People Search URL through Cloud Engine.', parameters:{ type:'object', properties:{ userId:{type:'string'}, search_url:{type:'string',description:'LinkedIn people search URL'}, limit:{type:'number'} }, required:['userId','search_url'] } } },
      { type:'function', function:{ name:'sniper_sn_lead_search', description:'Run a Sales Navigator lead search URL through Cloud Engine.', parameters:{ type:'object', properties:{ userId:{type:'string'}, search_url:{type:'string',description:'Sales Navigator lead search URL'}, limit:{type:'number'} }, required:['userId','search_url'] } } },
      { type:'function', function:{ name:'sniper_jobs_intent', description:'Find companies with open job listings matching a LinkedIn Jobs search URL.', parameters:{ type:'object', properties:{ userId:{type:'string'}, search_url:{type:'string',description:'LinkedIn Jobs search URL'}, limit:{type:'number'} }, required:['userId','search_url'] } } },
      { type:'function', function:{ name:'sniper_sn_connect', description:'Send Sales Navigator connect requests to profile URLs.', parameters:{ type:'object', properties:{ userId:{type:'string'}, profile_urls:{type:'array',items:{type:'string'},description:'LinkedIn profile URLs'}, note:{type:'string',description:'Optional connect note (max 300 chars)'} }, required:['userId','profile_urls'] } } },
      { type:'function', function:{ name:'sniper_sn_inmail', description:'Send Sales Navigator InMail to profile URLs.', parameters:{ type:'object', properties:{ userId:{type:'string'}, profile_urls:{type:'array',items:{type:'string'}}, subject:{type:'string'}, message:{type:'string'} }, required:['userId','profile_urls','subject','message'] } } },
      { type:'function', function:{ name:'sniper_sn_message', description:'Send Sales Navigator direct messages to connected profiles.', parameters:{ type:'object', properties:{ userId:{type:'string'}, profile_urls:{type:'array',items:{type:'string'}}, message:{type:'string'} }, required:['userId','profile_urls','message'] } } },
      { type:'function', function:{ name:'sniper_import_to_leads', description:'Import LinkedIn profile URLs into the leads table. Does not require Cloud Engine.', parameters:{ type:'object', properties:{ userId:{type:'string'}, profile_urls:{type:'array',items:{type:'string'}}, campaign_id:{type:'string',description:'Optional campaign to attach leads to'} }, required:['userId','profile_urls'] } } },
      { type:'function', function:{ name:'sniper_add_to_table', description:'Add LinkedIn profile URLs to a custom table. Does not require Cloud Engine.', parameters:{ type:'object', properties:{ userId:{type:'string'}, profile_urls:{type:'array',items:{type:'string'}}, table_id:{type:'string'} }, required:['userId','profile_urls','table_id'] } } },
      { type:'function', function:{ name:'sniper_list_jobs', description:'List recent Cloud Engine jobs with status. Useful for checking mission progress.', parameters:{ type:'object', properties:{ userId:{type:'string'}, limit:{type:'number'} }, required:['userId'] } } },
      // Job Requisition tools
      { type:'function', function:{ name:'search_jobs', description:'Search user job requisitions by title.', parameters:{ type:'object', properties:{ userId:{type:'string'}, query:{type:'string'} }, required:['userId'] } } },
      { type:'function', function:{ name:'create_job_requisition', description:'Create a new job requisition with pipeline.', parameters:{ type:'object', properties:{ userId:{type:'string'}, title:{type:'string'}, description:{type:'string'}, department:{type:'string'}, location:{type:'string'}, salary_range:{type:'string'} }, required:['userId','title'] } } },
      { type:'function', function:{ name:'add_candidate_to_job', description:'Add a candidate to a job requisition pipeline stage. Defaults to first stage if stage not specified.', parameters:{ type:'object', properties:{ userId:{type:'string'}, candidateId:{type:'string'}, jobId:{type:'string'}, stage:{type:'string'} }, required:['userId','candidateId','jobId'] } } },
      { type:'function', function:{ name:'get_job_pipeline', description:'Get pipeline stages and candidates for a job requisition.', parameters:{ type:'object', properties:{ userId:{type:'string'}, jobId:{type:'string'} }, required:['userId','jobId'] } } },
      // Kanban tools
      { type:'function', function:{ name:'create_kanban_board', description:'Create a new Kanban board with custom columns.', parameters:{ type:'object', properties:{ userId:{type:'string'}, name:{type:'string'}, columns:{type:'array',items:{type:'string'}} }, required:['userId','name'] } } },
      { type:'function', function:{ name:'create_kanban_card', description:'Add a card to a Kanban board column.', parameters:{ type:'object', properties:{ userId:{type:'string'}, boardId:{type:'string'}, listId:{type:'string'}, title:{type:'string'}, description:{type:'string'} }, required:['userId','boardId','listId','title'] } } },
      { type:'function', function:{ name:'move_kanban_card', description:'Move a Kanban card to a different column.', parameters:{ type:'object', properties:{ userId:{type:'string'}, cardId:{type:'string'}, targetListId:{type:'string'} }, required:['userId','cardId','targetListId'] } } },
      // Persona / Template / Form / Sequence tools
      { type:'function', function:{ name:'create_persona', description:'Create an ideal candidate persona for sourcing. Define target titles, locations, and keywords.', parameters:{ type:'object', properties:{ userId:{type:'string'}, name:{type:'string'}, titles:{type:'array',items:{type:'string'}}, locations:{type:'array',items:{type:'string'}}, include_keywords:{type:'array',items:{type:'string'}}, exclude_keywords:{type:'array',items:{type:'string'}}, goal_total_leads:{type:'number'} }, required:['userId','name','titles'] } } },
      { type:'function', function:{ name:'generate_outreach_template', description:'AI-generate a personalized outreach email template and save it.', parameters:{ type:'object', properties:{ userId:{type:'string'}, template_name:{type:'string'}, job_title:{type:'string'}, company_or_context:{type:'string'}, tone:{type:'string',description:'professional, casual, or direct'} }, required:['userId','template_name','job_title'] } } },
      { type:'function', function:{ name:'create_screening_form', description:'Create a screening questionnaire for candidates. Auto-generates questions if not provided.', parameters:{ type:'object', properties:{ userId:{type:'string'}, title:{type:'string'}, job_title:{type:'string'}, questions:{type:'array',items:{type:'object',properties:{label:{type:'string'},field_type:{type:'string'},options:{type:'array',items:{type:'string'}}}}}, job_id:{type:'string'} }, required:['userId','title'] } } },
      { type:'function', function:{ name:'create_email_sequence', description:'Create a multi-step email sequence with delays between steps. Auto-generates 3-step sequence if steps not provided.', parameters:{ type:'object', properties:{ userId:{type:'string'}, name:{type:'string'}, steps:{type:'array',items:{type:'object',properties:{subject:{type:'string'},body:{type:'string'},delay_days:{type:'number'}}}}, stop_on_reply:{type:'boolean'} }, required:['userId','name'] } } },
      { type:'function', function:{ name:'classify_reply', description:'Reclassify a sourcing reply or manually override its classification label. Triggers auto-actions (pipeline move, sequence pause) when the label changes.', parameters:{ type:'object', properties:{ userId:{type:'string'}, replyId:{type:'string',description:'UUID of the sourcing_replies row'}, forceLabel:{type:'string',description:'Optional: manually set label instead of re-running AI. One of: positive|meeting_request|neutral|negative|oos|auto'} }, required:['userId','replyId'] } } }
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

    // Fetch job context if job_id passed in metadata
    let jobBlock = '';
    if (metadata?.job_id) {
      try {
        const { data: job } = await supabase.from('job_requisitions').select('*').eq('id', metadata.job_id).maybeSingle();
        if (job) {
          const { data: stages } = await supabase.from('pipeline_stages').select('title').eq('pipeline_id', job.pipeline_id).order('position');
          const { count } = await supabase.from('candidate_jobs').select('id', { count: 'exact', head: true }).eq('job_id', job.id);
          jobBlock = `\n\n**Current Job Context:**\nYou are assisting with: "${job.title}" (${job.department || 'No department'}) — Job ID: ${job.id}\nLocation: ${job.location || 'Not specified'} | Salary: ${job.salary_range || 'Not specified'}\nPipeline stages: ${(stages || []).map((s: any) => s.title).join(' → ') || 'Default'}\nCurrent candidates: ${count || 0} in pipeline\nJob description (summary): ${(job.description || '').slice(0, 1500)}\n\nJob-specific instructions:\n- Use the job description above to inform sourcing criteria (target titles, skills, location, experience level).\n- After sourcing and enrichment, convert leads to candidates using convert_lead_to_candidate, then add them to this job's pipeline using add_candidate_to_job (default to the first stage).\n- Ask the user: "Should I track candidates in the job pipeline, or would you prefer a separate Kanban board?"\n- You can also use create_kanban_board, create_kanban_card, and move_kanban_card if the user prefers Kanban tracking.`;
        }
      } catch (e) { console.error('[rexChat] job context fetch error', e); }
    }
    if (!jobBlock) {
      jobBlock = `\n\n**Job context instructions:**\n- When the user asks about sourcing or outreach for a role, ask: "Do you already have a job requisition for this role? If so, what's the name? I can search your jobs with search_jobs." If not, offer to create one with create_job_requisition.\n- Once a job is identified, use add_candidate_to_job to place sourced candidates into the job's pipeline.`;
    }

    const contextMessage = {
      role: 'system',
      content: `You are REX, a recruiting and career AI assistant built into HirePilot. You help recruiters source leads, send outreach, manage campaigns, analyze resumes, and automate LinkedIn workflows.

Be conversational and concise — answer like a sharp colleague, not a manual. Use markdown formatting (bold, lists, headers) to keep responses scannable.

When you can fulfill a request with a tool, just do it. Don't describe a plan first — act, then summarize what happened. You have the tool schemas; use them directly.

Key behaviors:
- **Lead sourcing**: If the user wants leads but doesn't specify a source, ask once: "Apollo (fast, verified emails) or LinkedIn (connection workflow)?" Default to Apollo if they don't answer.
- **Apollo vs Cloud Engine disambiguation**: These are two very different systems. Apollo (source_leads, filter_leads) searches a database for contact info -- fast, returns emails. Cloud Engine (sniper_* tools) automates a real LinkedIn browser session -- slower, but finds live profiles and can take actions like connecting or messaging. Key signals:
  - User says "using apollo" or "apollo.io" or wants emails/contact info --> use Apollo tools (source_leads)
  - User says "using cloud engine", "using linkedin", "on linkedin", or "Sales Navigator" --> use Cloud Engine (sniper_* tools)
  - User says "find decision makers at [company]" or "who leads engineering at [company]" without specifying --> this sounds like a Cloud Engine mission. Confirm: "This sounds like a LinkedIn search. Want me to use Cloud Engine to find them live on LinkedIn, or would you prefer a quick Apollo database lookup?"
  - User pastes a LinkedIn URL or Sales Navigator URL --> always Cloud Engine
  - User wants to send connect requests, InMails, or messages --> always Cloud Engine
- **Bulk actions**: Prefer campaign-level tools (send_campaign_email_auto, send_campaign_email_by_template_name) over single-lead tools when emailing a whole campaign.
- **Resume/LinkedIn help**: Use resume_intelligence (analyze first, rewrite on request, coach for strategy) and linkedin_intelligence. Be hiring-manager aware and outcome-focused — no ATS keyword stuffing.
- **Sequences**: If timing isn't provided for sequence steps, ask once for step delays (e.g., "0, 2, 4 business days").
- **Auto-track setup**: Gather persona, campaign, cadence, timing, and volume with brief back-and-forth — don't dump all questions at once.
- **Cloud Engine missions**: You can queue LinkedIn automation missions. These are async -- after queuing, tell the user the job is running and they can check progress in /cloud-engine/activity. Available missions:
  - sniper_decision_makers -- find decision makers at a company (accepts optional criteria like "VP Engineering who controls the AI budget")
  - sniper_people_search -- run a LinkedIn people search URL
  - sniper_sn_lead_search -- run a Sales Navigator search URL
  - sniper_jobs_intent -- find companies with open jobs matching a search URL
  - sniper_collect_post -- extract engagers from a LinkedIn post
- **Outreach actions**: After collecting profiles, chain with outreach:
  - sniper_campaign_outreach_connect -- batch connect using a template
  - sniper_sn_connect -- Sales Nav connect requests
  - sniper_sn_inmail -- Sales Nav InMail
  - sniper_sn_message -- Sales Nav direct messages
  - sniper_send_message_to_profile -- message a single profile
- **Data actions**: Move results into leads or custom tables:
  - sniper_import_to_leads -- import profiles to leads (DB only, no Cloud Engine needed)
  - sniper_add_to_table -- add profiles to a custom table
- **Status and polling**: Use sniper_list_jobs to see recent jobs, sniper_poll_leads to get extracted profiles from a job, sniper_get_status for quick status.
- **Multi-mission chaining**: When a user describes a pipeline (e.g. "find companies hiring for AI, find their decision makers, then connect"), queue each step and explain the chain. Each mission is async -- guide the user to check back or use sniper_poll_leads.
- **Guardrails**: If Cloud Engine is off or LinkedIn is not connected, the tools will return a help message with setup instructions. Do not retry -- just show the user the instructions.
- **Job tools**: Use search_jobs to find existing job requisitions, create_job_requisition to make new ones, get_job_pipeline to see pipeline state, and add_candidate_to_job to place candidates into job pipelines.
- **Kanban tools**: Use create_kanban_board, create_kanban_card, and move_kanban_card when users want visual board tracking.
- **Persona tools**: Use create_persona to build reusable sourcing profiles. When the user describes an ideal candidate, create a persona with titles, locations, and keywords.
- **Template tools**: Use generate_outreach_template to AI-draft personalized email templates. Use list_email_templates to check existing templates first.
- **Form tools**: Use create_screening_form to auto-generate screening questionnaires. Link to a job req when available.
- **Sequence tools**: Use create_email_sequence to build multi-step follow-up cadences. If the user doesn't specify steps, auto-generate a 3-step sequence.
- **Reply tools**: Use classify_reply to reclassify or manually override a reply's classification. Triggers auto-actions (pipeline move, sequence pause) when the label changes. Classifications: positive, meeting_request, neutral, negative, oos, auto.

**Multi-step workflow plans:**
When the user requests a complex workflow (sourcing + enrichment + outreach, or any 3+ step process), respond with a numbered plan. Structure your response as:
1. **Source Candidates** — [describe what/where you'll source]
2. **Enrich Profiles** — [describe enrichment: emails, work history, etc.]
3. **Score & Rank** — [describe scoring criteria from the job requirements]
4. **Convert to Candidates** — [describe: convert top leads to candidates, add to job pipeline]
5. **Launch Outreach** — [describe: email sequence, personalized templates]

Use exactly these step patterns when applicable — the execution engine recognizes them:
- "Source" for sourcing (Apollo or LinkedIn)
- "Enrich" for enrichment
- "Score" or "Rank" for scoring
- "Convert" or "Add to pipeline" for CRM actions
- "Outreach" or "Email" or "Sequence" for messaging

After presenting the plan, the user can approve it for automated execution. Each step runs in sequence with real tool calls.
${jobBlock}

Always pass userId="${userId}" when calling tools.${campaign_id ? ` Current campaign: ${campaign_id}.` : ''}`
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
            const summary = `Cloud Engine queued capture for this post. target_id=${toolResultAny?.target_id || ''} job_id=${toolResultAny?.job_id || ''} (ETA ~${toolResultAny?.eta_seconds || 60}s). Say: "poll results ${toolResultAny?.target_id}" to fetch results.`;
            assistantMessage = { role: 'assistant', content: summary } as any;
          }
        }
      } catch (fallbackErr) {
        console.error('[rexChat] fallback error', fallbackErr);
      }
    }

    // After tools: apply error overrides and append contextual links
    try {
      // Error overrides — safety-critical, fully replace model output
      if (lastToolResult && lastToolResult.error === 'NO_EMAIL_PROVIDER') {
        assistantMessage = { role: 'assistant', content: 'You need to connect an email service first (SendGrid, Google, or Outlook). Go to **Settings → Integrations** to connect.' } as any;
      }
      if (lastToolResult && lastToolResult.error_code === 'CLOUD_ENGINE_DISABLED' && lastToolResult.help) {
        assistantMessage = { role: 'assistant', content: String(lastToolResult.help) } as any;
      }

      // Helper to append text to assistant content
      const appendToContent = (extra: string) => {
        if (assistantMessage?.content && typeof (assistantMessage as any).content === 'string') {
          (assistantMessage as any).content += extra;
        } else if (assistantMessage?.content && typeof (assistantMessage as any).content?.text === 'string') {
          (assistantMessage as any).content.text += extra;
        }
      };

      // Campaign view links — append
      if (lastToolResult && (lastToolResult.campaign_id || lastToolResult.std_campaign_id)) {
        appendToContent(`\n\n[View in Agent Mode](/agent-mode?campaign=${lastToolResult.campaign_id || ''}) · [View in Leads](/leads?campaign=${lastToolResult.std_campaign_id || ''})`);
      }

      // Outreach nudge — append
      if (executedSourcing && ((lastToolResult?.imported || 0) > 0)) {
        const lastUser = messages[messages.length - 1];
        const text = String(lastUser?.content || '').toLowerCase();
        const wantsOutreach = /(reach out|email|send|outreach|contact)/.test(text);
        if (!wantsOutreach) {
          appendToContent('\n\nWant me to start outreach to these leads? Just tell me the tone (casual, professional, etc.) and I\'ll draft the opener.');
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