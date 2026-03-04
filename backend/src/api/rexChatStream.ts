import { Request, Response } from 'express';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';
import fetch from 'node-fetch';
import { completeOnboardingStep } from '../lib/onboarding';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseEvent(res: Response, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sseTokens(res: Response, text: string) {
  // Send full text as a single token event (for pre-processor short-circuits)
  sseEvent(res, 'token', { t: text });
}

async function withTimeout<T>(p: Promise<T>, ms = 25000): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ] as [Promise<T>, Promise<T>]);
}

async function persistMessage(
  baseUrl: string,
  convId: string,
  role: string,
  content: any,
  authHeader: string
) {
  try {
    await fetch(`${baseUrl}/api/rex/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify({ role, content })
    });
  } catch (e) {
    console.error('[rexChatStream] persist error', e);
  }
}

async function ensureConversation(
  baseUrl: string,
  convId: string | undefined,
  title: string,
  authHeader: string
): Promise<string | undefined> {
  if (convId) return convId;
  try {
    const resp = await fetch(`${baseUrl}/api/rex/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify({ title: title.slice(0, 120) })
    });
    const data = await resp.json();
    return (data as any)?.conversation?.id;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Pre-processors: return { handled, reply } if short-circuited
// ---------------------------------------------------------------------------

async function runPreProcessors(
  messages: any[],
  userId: string
): Promise<{ handled: boolean; reply?: string }> {
  const lastUserMsg = [...(messages || [])].reverse().find((m: any) => m.role === 'user');
  const lastUserText = String((lastUserMsg as any)?.content || '').toLowerCase();
  const lastUserRaw = String((lastUserMsg as any)?.content || '');

  // Slack setup
  if (/(setup|set\s*up|enable).*(rex).*slack|slack.*(setup|set\s*up).*rex/.test(lastUserText)) {
    const base = process.env.BACKEND_URL || process.env.BACKEND_PUBLIC_URL || 'https://api.thehirepilot.com';
    const urls = {
      commands: `${base}/api/slack/commands`,
      interactivity: `${base}/api/slack/interactivity`,
      events: `${base}/api/slack/events`
    };
    return {
      handled: true,
      reply: [
        'Here\'s how to enable REX in your Slack workspace:',
        `1) Go to https://api.slack.com/apps → Create New App → From scratch → Name: "HirePilot (REX)" and choose your workspace.`,
        `2) Slash Commands → Create new → Command: /rex → Request URL: ${urls.commands} → Usage hint: /rex link me → Save.`,
        `3) Interactivity & Shortcuts → Toggle ON → Request URL: ${urls.interactivity} → Save.`,
        `4) (Optional) Event Subscriptions → Toggle ON → Request URL: ${urls.events} → Add bot event: app_mention → Save.`,
        '5) OAuth & Permissions → Bot Token Scopes → add: commands, chat:write, channels:read, users:read → Install to workspace.',
        '6) In Slack, invite the bot to a channel with /invite @YourBot → then run /rex link me and /rex hello.'
      ].join('\n')
    };
  }

  // Provider preference
  const providerMatch = /(send\s+from\s+my\s+)(sendgrid|google|outlook)(\s+account)?/i.exec(lastUserRaw);
  if (providerMatch) {
    const providerHint = providerMatch[2].toLowerCase();
    try {
      await supabase
        .from('user_settings')
        .upsert({ user_id: userId, preferred_email_provider: providerHint }, { onConflict: 'user_id' });
    } catch {}
  }

  // Send to lead by UUID
  const sendLeadMatch = /(send|email)[^\n]*?(?:to|lead)[^\n]*?(?:lead[-_\s]*id[:\s]*)?([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i.exec(lastUserRaw);
  if (sendLeadMatch) {
    const leadId = sendLeadMatch[2];
    const prevAssistant = [...(messages || [])].slice(0, Math.max(0, (messages || []).length - 1)).reverse().find((m: any) => m.role === 'assistant');
    const assistantText = prevAssistant
      ? (typeof (prevAssistant as any).content === 'string' ? String((prevAssistant as any).content) : String((prevAssistant as any)?.content?.text || ''))
      : '';

    let subject = '';
    const subjMatch = /\*\*?subject\*\*?\s*:?\s*(.+)/i.exec(assistantText) || /subject\s*:?\s*(.+)/i.exec(assistantText);
    if (subjMatch) subject = subjMatch[1].trim();
    if (!subject) subject = 'Message';
    const html = assistantText ? assistantText.replace(/\n/g, '<br/>') : '';

    if (html) {
      try {
        const { server: rexServer } = await import('../rex/server');
        const caps = rexServer.getCapabilities?.();
        const tool = caps?.tools?.['send_email_to_lead'];
        if (tool?.handler) {
          const result = await tool.handler({ userId, lead_id: leadId, subject, html });
          if (result?.ok) {
            const used = result?.used || 'provider';
            return { handled: true, reply: `Email sent to lead ${leadId} via ${used}.` };
          }
          if (result?.error === 'NO_EMAIL_PROVIDER') {
            return { handled: true, reply: 'You need to connect an email service first (SendGrid, Google, or Outlook). Go to Settings → Integrations to connect.' };
          }
        }
      } catch {}
    }
  }

  // Sniper LinkedIn post collection
  const urlEarly = /https?:\/\/[^\s]*linkedin\.com\/posts\/[^\s]+/i.exec(lastUserRaw)?.[0];
  const wantsLikersEarly = /like|liked|likers/.test(lastUserText);
  if (urlEarly && wantsLikersEarly) {
    try {
      const { server: rexServer } = await import('../rex/server');
      const caps = rexServer.getCapabilities?.();
      const sniper = caps?.tools?.['sniper_collect_post'];
      if (sniper?.handler) {
        const queued: any = await sniper.handler({ userId, post_url: urlEarly, limit: 0 });
        const summary = queued?.error
          ? `Sniper queue failed: ${queued.error}`
          : `Sniper queued capture for this post. target_id=${queued?.target_id || ''} job_id=${queued?.job_id || ''} (ETA ~${queued?.eta_seconds || 60}s). Say: "poll sniper ${queued?.target_id}" to fetch results.`;
        return { handled: true, reply: summary };
      }
    } catch {}
  }

  // Campaign LinkedIn outreach
  const wantsLinkedInOutreach = /(send|queue).*(linkedin).*(outreach|connect|connection)/i.test(lastUserText);
  const wantsCampaign = /campaign/i.test(lastUserText);
  const tplMatch = /template[^"'`]*["'`]\s*([^"'`]+?)\s*["'`]/i.exec(lastUserRaw);
  if (wantsLinkedInOutreach && wantsCampaign && tplMatch?.[1]) {
    try {
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
        return { handled: true, reply: summary };
      }
    } catch {}
  }

  return { handled: false };
}

// ---------------------------------------------------------------------------
// Post-processing: apply deterministic overrides
// ---------------------------------------------------------------------------

function applyPostProcessors(
  content: string,
  lastToolResult: any,
  executedSourcing: boolean,
  messages: any[]
): string {
  let result = content;

  // Queued emails
  if (lastToolResult && typeof lastToolResult.queued === 'number') {
    const mode = String(lastToolResult.mode || 'draft');
    const count = Number(lastToolResult.queued || 0);
    const when = lastToolResult.scheduled_for ? ` Scheduled for ${lastToolResult.scheduled_for}.` : '';
    result = `Queued ${count} emails via ${mode === 'template' ? 'template' : 'custom draft'} using SendGrid.${when} They will be sent automatically; no manual action in SendGrid is required.`;
  }

  // Missing provider
  if (lastToolResult && lastToolResult.error === 'NO_EMAIL_PROVIDER') {
    result = 'You need to connect an email service first (SendGrid, Google, or Outlook). Go to Settings → Integrations to connect.';
  }

  // Cloud engine disabled
  if (lastToolResult && lastToolResult.error_code === 'CLOUD_ENGINE_DISABLED' && lastToolResult.help) {
    result = String(lastToolResult.help);
  }

  // Campaign view links
  if (lastToolResult && (lastToolResult.campaign_id || lastToolResult.std_campaign_id)) {
    const viewText = `\n\nView in Agent Mode: /agent-mode?campaign=${lastToolResult.campaign_id || ''}` +
      `\nView in Leads: /leads?campaign=${lastToolResult.std_campaign_id || ''}`;
    result += viewText;
  }

  // Outreach nudge
  if (executedSourcing && ((lastToolResult?.imported || 0) > 0)) {
    const lastUser = messages[messages.length - 1];
    const text = String(lastUser?.content || '').toLowerCase();
    const wantsOutreach = /(reach out|email|send|outreach|contact)/.test(text);
    if (!wantsOutreach) {
      result = result.replace(/no leads[^\n]*/i, '').trim() +
        '\n\nDo you want me to start outreach to these leads now? If yes, say the tone (e.g., casual, professional) and I will draft the opener.';
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tool definitions (same as rexChat.ts)
// ---------------------------------------------------------------------------

function getToolDefinitions(): any[] {
  return [
    { type:'function',function:{name:'schedule_campaign',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},send_time:{type:'string'}},required:['userId','campaign_id','send_time']}}},
    { type:'function',function:{name:'send_email',parameters:{type:'object',properties:{userId:{type:'string'},to:{type:'string'},subject:{type:'string'},body:{type:'string'},provider:{type:'string'},template_name:{type:'string'},template_id:{type:'string'}},required:['userId','to']}}},
    { type:'function',function:{name:'list_email_templates',parameters:{type:'object',properties:{userId:{type:'string'},query:{type:'string'}},required:['userId']}}},
    { type:'function',function:{name:'send_template_email',parameters:{type:'object',properties:{userId:{type:'string'},lead:{type:'string'},template_name:{type:'string'},template_id:{type:'string'},provider:{type:'string'}},required:['userId','lead']}}},
    { type:'function',function:{name:'enrich_lead',parameters:{type:'object',properties:{userId:{type:'string'},linkedin_url:{type:'string'}},required:['userId','linkedin_url']}}},
    { type:'function',function:{name:'get_campaign_metrics',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'slack_setup_guide',parameters:{type:'object',properties:{userId:{type:'string'}},required:['userId']}}},
    { type:'function',function:{name:'source_leads',parameters:{type:'object',properties:{userId:{type:'string'},campaignId:{type:'string'},source:{type:'string'},filters:{type:'object'}},required:['userId','campaignId','source']}}},
    { type:'function',function:{name:'filter_leads',parameters:{type:'object',properties:{userId:{type:'string'},campaignId:{type:'string'},filters:{type:'object',properties:{title:{type:'string'},synonyms:{type:'boolean'},strict_level:{type:'boolean'},has_email:{type:'boolean'},verified_only:{type:'boolean'},personal_email_only:{type:'boolean'},limit:{type:'number'},count:{type:'number'}}}},required:['userId']}}},
    { type:'function',function:{name:'convert_lead_to_candidate',parameters:{type:'object',properties:{userId:{type:'string'},leadId:{type:'string'}},required:['userId','leadId']}}},
    { type:'function',function:{name:'view_pipeline',parameters:{type:'object',properties:{userId:{type:'string'},jobId:{type:'string'},stage:{type:'string'},staleDays:{type:'number'},candidateName:{type:'string'}},required:['userId','jobId']}}},
    { type:'function',function:{name:'move_candidate_to_stage',parameters:{type:'object',properties:{userId:{type:'string'},candidate:{type:'string'},stage:{type:'string'},jobId:{type:'string'}},required:['userId','candidate','stage']}}},
    { type:'function',function:{name:'move_candidate',parameters:{type:'object',properties:{userId:{type:'string'},candidateId:{type:'string'},newStage:{type:'string'}},required:['userId','candidateId','newStage']}}},
    { type:'function',function:{name:'update_candidate_notes',parameters:{type:'object',properties:{userId:{type:'string'},candidateId:{type:'string'},note:{type:'string'},author:{type:'string'}},required:['userId','candidateId','note','author']}}},
    { type:'function',function:{name:'send_campaign_email_auto',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},template_name:{type:'string',optional:true},subject:{type:'string',optional:true},html:{type:'string',optional:true},scheduled_for:{type:'string',optional:true},channel:{type:'string',optional:true}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'set_preferred_email_provider',parameters:{type:'object',properties:{userId:{type:'string'},provider:{type:'string',enum:['sendgrid','google','outlook']}},required:['userId','provider']}}},
    { type:'function',function:{name:'send_email_to_lead',parameters:{type:'object',properties:{userId:{type:'string'},lead_id:{type:'string'},subject:{type:'string',optional:true},html:{type:'string',optional:true},provider:{type:'string',optional:true}},required:['userId','lead_id']}}},
    { type:'function',function:{name:'enroll_campaign_in_sequence_by_name',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},sequence_name:{type:'string'},start_time_local:{type:'string'},timezone:{type:'string'},provider:{type:'string'}},required:['userId','campaign_id','sequence_name']}}},
    { type:'function',function:{name:'create_sequence_from_template_and_enroll',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},template_name:{type:'string'},delays_business_days:{type:'array',items:{type:'number'}},timezone:{type:'string'},start_time_local:{type:'string'},provider:{type:'string'}},required:['userId','campaign_id','template_name','delays_business_days']}}},
    { type:'function',function:{name:'resume_intelligence',parameters:{type:'object',properties:{mode:{type:'string',enum:['analyze','rewrite','coach','builder_generate']},resume_text:{type:'string'},linkedin_text:{type:'string'},target_role:{type:'string'},target_title:{type:'string'},user_context:{type:'string'}},required:['mode','resume_text']}}},
    { type:'function',function:{name:'resume_scoring',parameters:{type:'object',properties:{resume_text:{type:'string'},target_role:{type:'string'}},required:['resume_text']}}},
    { type:'function',function:{name:'linkedin_intelligence',parameters:{type:'object',properties:{mode:{type:'string',enum:['analyze','rewrite']},linkedin_text:{type:'string'},resume_text:{type:'string'},target_role:{type:'string'}},required:['mode','linkedin_text']}}},
    { type:'function',function:{name:'resume_to_outreach',parameters:{type:'object',properties:{resume_json:{type:'object'},target_role:{type:'string'},company_context:{type:'string'}},required:['resume_json']}}},
    { type:'function',function:{name:'create_persona_auto_track',parameters:{type:'object',properties:{userId:{type:'string'},persona_id:{type:'string'},campaign_mode:{type:'string',enum:['use_existing','create_new']},existing_campaign_id:{type:'string',nullable:true},new_campaign_name:{type:'string',nullable:true},cadence:{type:'string'},day_of_week:{type:'string',nullable:true},time_utc:{type:'string'},leads_per_run:{type:'number'},send_delay_minutes:{type:'number'},daily_send_cap:{type:'number',nullable:true}},required:['userId','persona_id','campaign_mode','cadence','time_utc','leads_per_run','send_delay_minutes']}}},
    { type:'function',function:{name:'sourcing_pause_campaign',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'sourcing_resume_campaign',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'sourcing_cancel_campaign',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'sniper_collect_post',parameters:{type:'object',properties:{userId:{type:'string'},post_url:{type:'string'},limit:{type:'number'}},required:['userId','post_url']}}},
    { type:'function',function:{name:'sniper_poll_leads',parameters:{type:'object',properties:{userId:{type:'string'},target_id:{type:'string'},job_id:{type:'string'},limit:{type:'number'},cursor:{type:'string'}},required:['userId']}}},
    { type:'function',function:{name:'sniper_campaign_outreach_connect',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},template_name:{type:'string'},max_count:{type:'number'}},required:['userId','template_name']}}},
    { type:'function',function:{name:'sniper_send_message_to_profile',parameters:{type:'object',properties:{userId:{type:'string'},profile_url:{type:'string'},lead_id:{type:'string'},template_name:{type:'string'},message:{type:'string'}},required:['userId']}}},
    { type:'function',function:{name:'sniper_update_settings',parameters:{type:'object',properties:{userId:{type:'string'},max_connects_per_day:{type:'number'},max_messages_per_day:{type:'number'},min_delay_seconds:{type:'number'},max_delay_seconds:{type:'number'},active_hours_start:{type:'string'},active_hours_end:{type:'string'},active_hours_days:{type:'string'},timezone:{type:'string'},safety_mode:{type:'boolean'},provider:{type:'string'},cloud_engine_enabled:{type:'boolean'},max_actions_per_day:{type:'number'},max_actions_per_hour:{type:'number'},cooldown_minutes:{type:'number'}},required:['userId']}}},
    { type:'function',function:{name:'sniper_get_status',parameters:{type:'object',properties:{userId:{type:'string'},job_id:{type:'string'}},required:['userId']}}},
    { type:'function', function:{ name:'send_campaign_email_by_template_name', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string'} }, required:['userId','campaign_id','template_name'] } } },
    { type:'function', function:{ name:'send_campaign_email_draft', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, subject:{type:'string'}, html:{type:'string'} }, required:['userId','campaign_id','subject','html'] } } },
    { type:'function', function:{ name:'preview_campaign_email', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string'} }, required:['userId','campaign_id'] } } },
  ];
}

// ---------------------------------------------------------------------------
// Build system prompt (same as rexChat.ts)
// ---------------------------------------------------------------------------

function buildSystemPrompt(userId: string, campaign_id?: string): any {
  return {
    role: 'system',
    content: `You are REX, a recruiting and career agent.
If the user asks to source leads or create a campaign with a target title/location/count and does NOT clearly specify the lead source, first ask ONE concise clarifying question: "Which lead source should I use: Apollo (fast, verified emails) or LinkedIn (connection workflow)?" and wait for their answer before calling any tools.
If the user specifies the source, immediately call the tool 'source_leads' with { userId, campaignId: 'latest', source: '<apollo|linkedin>', filters: { title: <normalized title>, location: <city, state>, count: <N> } }.
If the user doesn't answer the clarifying question, default to Apollo after one follow-up.
Be concise. Do not output generic plans when a tool can fulfill the request.
Note: If 'linkedin' is chosen and it is not available, clearly state that LinkedIn sourcing is queued and offer to proceed with Apollo.
If the user asks to "go to this LinkedIn post" or to "pull everyone who liked/commented on a post" and provides a LinkedIn post URL, call the tool 'sniper_collect_post' with { userId, post_url: <url>, limit: 0 }. Do not send outreach; simply return queued status (target_id, job_id) and ETA.
If the user says "poll sniper <target_id>" or asks to check results for a target/campaign, call 'sniper_poll_leads' with { userId, target_id: <uuid>, limit: 50 } and return leads plus last run status.
If the user asks: "send linkedin outreach to the campaign you just created" AND provides a LinkedIn request template name, call 'sniper_campaign_outreach_connect' with { userId, campaign_id: 'latest', template_name: '<name>' } and then tell them to monitor results in /sniper/activity.
If the user asks to send a LinkedIn message to someone they are already connected to, call 'sniper_send_message_to_profile' with either { userId, lead_id } or { userId, profile_url } and include message content or template_name.
If the user asks to change Sniper settings (e.g., "set my max connects to 30", "only run between 9am and 5pm", "add a 30 second delay", "pause sniper", "switch to agentic browser"), call 'sniper_update_settings' with the relevant fields. Confirm the changes back to the user.
If the user asks about their Sniper status, quota, or recent jobs (e.g., "what are my sniper settings?", "how many connects do I have left?", "show my recent sniper jobs"), call 'sniper_get_status' and summarize the results.
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
  };
}

// ---------------------------------------------------------------------------
// Main streaming handler
// ---------------------------------------------------------------------------

export default async function rexChatStream(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const safeBody = req.body || {};
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

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  (res as any).flushHeaders?.();
  res.write('retry: 3000\n\n');

  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    try { res.end(); } catch {}
  };
  req.on('close', cleanup);

  const authHeader = req.headers.authorization || '';
  const internalUrl = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;

  try {
    // 1. Validate user
    const { data: userRow, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    if (error) throw error;
    if (!userRow) {
      sseEvent(res, 'error', { message: 'User not found' });
      cleanup();
      return;
    }

    // 2. Run pre-processors
    const preResult = await runPreProcessors(messages, userId);
    if (preResult.handled && preResult.reply) {
      sseTokens(res, preResult.reply);
      // Ensure conversation + persist
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      let convId = await ensureConversation(internalUrl, conversationId, String(lastUserMsg?.content || 'New chat'), authHeader);
      if (convId && lastUserMsg) {
        await persistMessage(internalUrl, convId, 'user', { text: lastUserMsg.content }, authHeader);
      }
      if (convId) {
        await persistMessage(internalUrl, convId, 'assistant', { text: preResult.reply }, authHeader);
      }
      sseEvent(res, 'done', { conversation_id: convId, full_content: preResult.reply });
      cleanup();
      return;
    }

    // 3. Emit thinking status
    sseEvent(res, 'status', { phase: 'thinking' });

    const tools = getToolDefinitions();
    const contextMessage = buildSystemPrompt(userId, campaign_id);

    // 4. First OpenAI call (streaming)
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [contextMessage, ...messages],
      tools,
      stream: true,
    });

    let contentAccum = '';
    const toolCallsAccum: Array<{ id: string; function: { name: string; arguments: string } }> = [];

    for await (const chunk of stream) {
      if (cleaned) break;
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // Stream text tokens
      if (delta.content) {
        contentAccum += delta.content;
        sseEvent(res, 'token', { t: delta.content });
      }

      // Accumulate tool call fragments
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallsAccum[idx]) {
            toolCallsAccum[idx] = { id: '', function: { name: '', arguments: '' } };
          }
          if (tc.id) toolCallsAccum[idx].id = tc.id;
          if (tc.function?.name) toolCallsAccum[idx].function.name += tc.function.name;
          if (tc.function?.arguments) toolCallsAccum[idx].function.arguments += tc.function.arguments;
        }
      }
    }

    // Setup conversation persistence
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    let convId = await ensureConversation(internalUrl, conversationId, String(lastUserMsg?.content || 'New chat'), authHeader);
    if (convId && lastUserMsg) {
      await persistMessage(internalUrl, convId, 'user', { text: lastUserMsg.content }, authHeader);
    }

    // 5. No tool calls — apply post-processors and finish
    if (toolCallsAccum.length === 0) {
      const final = applyPostProcessors(contentAccum, null, false, messages);
      if (final !== contentAccum) {
        sseEvent(res, 'replace', { full_content: final });
      }
      sseEvent(res, 'done', { conversation_id: convId, full_content: final });
      if (convId) {
        await persistMessage(internalUrl, convId, 'assistant', { text: final }, authHeader);
      }
      try { await completeOnboardingStep(userId, 'rex_chat_activated', {}); } catch {}
      cleanup();
      return;
    }

    // 6. Tool execution phase
    sseEvent(res, 'status', { phase: 'tools' });

    const { server: rexServer } = await import('../rex/server');
    const capabilities = rexServer.getCapabilities?.();

    // Build the assistant message with tool_calls for the messages array
    const assistantToolMsg: any = {
      role: 'assistant',
      content: contentAccum || null,
      tool_calls: toolCallsAccum.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments }
      }))
    };

    const updatedMessages: any[] = [contextMessage, ...messages, assistantToolMsg];
    let executedSourcing = false;
    let lastToolResult: any = null;

    for (const call of toolCallsAccum) {
      const toolName = call.function.name;
      if (!toolName) continue;

      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        args = call.function.arguments;
      }

      sseEvent(res, 'tool_start', { name: toolName, call_id: call.id });

      // Tool-specific arg prep (source_leads campaign creation, send_campaign_email_auto latest resolution)
      try {
        if (toolName === 'source_leads') {
          const titleGuess = (String(lastUserMsg?.content || '').match(/find\s+\d+\s+(.+?)\s+in/i)?.[1] || 'Sourcing Campaign').slice(0, 80);
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

      // Execute tool
      if (!capabilities?.tools?.[toolName]?.handler) {
        updatedMessages.push({
          role: 'tool', tool_call_id: call.id, name: toolName,
          content: JSON.stringify({ error: `Tool handler not found for ${toolName}` })
        });
        sseEvent(res, 'tool_end', { name: toolName, call_id: call.id });
        continue;
      }

      let toolResult: any = null;
      try {
        toolResult = await withTimeout(capabilities.tools[toolName].handler(args), 45000);
      } catch (toolErr: any) {
        console.error('[rexChatStream] tool error', toolName, toolErr?.message || toolErr);
        toolResult = { error: String(toolErr?.message || toolErr) };
      }

      lastToolResult = toolResult;
      executedSourcing = executedSourcing || ['source_leads', 'filter_leads'].includes(toolName);

      updatedMessages.push({
        role: 'tool', tool_call_id: call.id, name: toolName,
        content: JSON.stringify(toolResult)
      });

      sseEvent(res, 'tool_end', { name: toolName, call_id: call.id });
    }

    // 7. Check if post-processor will deterministically override
    const willOverride =
      (lastToolResult && typeof lastToolResult.queued === 'number') ||
      (lastToolResult && lastToolResult.error === 'NO_EMAIL_PROVIDER') ||
      (lastToolResult && lastToolResult.error_code === 'CLOUD_ENGINE_DISABLED' && lastToolResult.help);

    if (willOverride) {
      const overriddenContent = applyPostProcessors('', lastToolResult, executedSourcing, messages);
      sseTokens(res, overriddenContent);
      sseEvent(res, 'done', { conversation_id: convId, full_content: overriddenContent });
      if (convId) {
        await persistMessage(internalUrl, convId, 'assistant', { text: overriddenContent }, authHeader);
      }
      try { await completeOnboardingStep(userId, 'rex_chat_activated', {}); } catch {}
      cleanup();
      return;
    }

    // 8. Stream final response after tools
    sseEvent(res, 'status', { phase: 'responding' });

    const finalStream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: updatedMessages,
      stream: true,
    });

    let finalContent = '';
    for await (const chunk of finalStream) {
      if (cleaned) break;
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        finalContent += delta.content;
        sseEvent(res, 'token', { t: delta.content });
      }
    }

    // Apply non-deterministic post-processors (campaign links, outreach nudge)
    const processed = applyPostProcessors(finalContent, lastToolResult, executedSourcing, messages);
    if (processed !== finalContent) {
      sseEvent(res, 'replace', { full_content: processed });
      finalContent = processed;
    }

    sseEvent(res, 'done', { conversation_id: convId, full_content: finalContent });

    if (convId) {
      await persistMessage(internalUrl, convId, 'assistant', { text: finalContent }, authHeader);
    }

    try { await completeOnboardingStep(userId, 'rex_chat_activated', {}); } catch {}
    cleanup();

  } catch (err: any) {
    console.error('[rexChatStream] Error:', err?.stack || err);
    sseEvent(res, 'error', { message: err?.message || 'Internal server error' });
    cleanup();
  }
}
