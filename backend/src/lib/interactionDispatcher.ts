import { supabase } from './supabase';
import { pushNotification, processInteractionResult } from './notifications';
import OpenAI from 'openai';

// ── Types ──

export interface DispatchParams {
  userId: string;
  interactionId: string;
  actionId: string;
  threadKey?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DispatchResult {
  ok: boolean;
  message: string;
  result?: any;
}

// ── Helpers ──

/** Parse a thread key like "sourcing:campaignId:leadId" into parts */
function parseThreadKey(threadKey?: string): { campaignId?: string; leadId?: string } {
  if (!threadKey) return {};
  const parts = threadKey.split(':');
  return {
    campaignId: parts.length >= 2 ? parts[1] : undefined,
    leadId: parts.length >= 3 ? parts[2] : undefined
  };
}

// ── Action Handlers ──

async function handleReplyDraft(params: DispatchParams): Promise<DispatchResult> {
  const { campaignId, leadId } = parseThreadKey(params.threadKey);
  const replyId = params.data?.reply_id || params.metadata?.reply_id || null;
  const instruction = params.data?.instruction || params.data?.text || '';

  // Fetch the original reply for context
  let replyBody = '';
  let replySubject = '';
  let fromEmail = params.data?.from_email || params.metadata?.from_email || '';
  try {
    if (replyId) {
      const { data: r } = await supabase
        .from('email_replies')
        .select('subject, text_body, html_body, from_email')
        .eq('id', replyId)
        .maybeSingle();
      if (r) {
        replySubject = (r as any).subject || '';
        replyBody = (r as any).text_body || (r as any).html_body || '';
        if (!fromEmail) fromEmail = (r as any).from_email || '';
      }
    } else if (leadId) {
      const { data: r2 } = await supabase
        .from('email_replies')
        .select('subject, text_body, html_body, from_email')
        .eq('lead_id', leadId)
        .order('id', { ascending: false })
        .limit(1);
      if (r2?.[0]) {
        replySubject = (r2[0] as any).subject || '';
        replyBody = (r2[0] as any).text_body || (r2[0] as any).html_body || '';
        if (!fromEmail) fromEmail = (r2[0] as any).from_email || '';
      }
    }
  } catch {}

  // Draft reply via GPT-4o-mini
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const prompt = `Draft a concise, professional reply to this email.${instruction ? ` User instruction: "${instruction}"` : ''}

Original reply from prospect:
Subject: ${replySubject}
Body: ${replyBody}

Output JSON with keys: subject, html (the html body of the reply email). Keep it short and actionable.`;

  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = r.choices?.[0]?.message?.content || '';
  let draftSubject = replySubject ? `Re: ${replySubject}` : 'Following up';
  let draftHtml = '';
  try {
    const parsed = JSON.parse(content);
    if (parsed?.subject) draftSubject = String(parsed.subject);
    if (parsed?.html) draftHtml = String(parsed.html);
  } catch {
    draftHtml = content.replace(/\n/g, '<br/>');
  }

  // Push draft as a new notification with send/edit actions
  await pushNotification({
    user_id: params.userId,
    source: 'inapp',
    thread_key: params.threadKey,
    title: `Draft reply to ${fromEmail || 'prospect'}`,
    body_md: `**Subject:** ${draftSubject}\n\n---\n\n${draftHtml.replace(/<[^>]+>/g, '')}`,
    type: 'reply_draft',
    actions: [
      { id: 'send_draft', type: 'button', label: '📤 Send', style: 'primary' },
      { id: 'free_text', type: 'input', placeholder: 'Revise instruction…' }
    ],
    metadata: {
      campaign_id: campaignId,
      lead_id: leadId,
      lead_email: fromEmail,
      draft_subject: draftSubject,
      draft_html: draftHtml,
      reply_id: replyId
    }
  } as any);

  return { ok: true, message: `Draft reply created for ${fromEmail || 'prospect'}` };
}

async function handleSendDraft(params: DispatchParams): Promise<DispatchResult> {
  const leadEmail = params.data?.lead_email || params.metadata?.lead_email;
  const subject = params.data?.draft_subject || params.data?.subject || 'Following up';
  const html = params.data?.draft_html || params.data?.html || '';
  const { campaignId, leadId } = parseThreadKey(params.threadKey);

  if (!leadEmail) {
    return { ok: false, message: 'Missing recipient email for draft send' };
  }

  const { emailQueue } = await import('../queues/redis');
  const headers: Record<string, string> = {};
  if (campaignId) headers['X-Campaign-Id'] = String(campaignId);
  if (leadId) headers['X-Lead-Id'] = String(leadId);

  await emailQueue.add('send', {
    to: leadEmail,
    subject,
    html,
    headers,
    userId: params.userId
  }, { delay: 0 });

  return { ok: true, message: `Email queued to ${leadEmail}` };
}

async function handleDisqualify(params: DispatchParams): Promise<DispatchResult> {
  const { campaignId, leadId } = parseThreadKey(params.threadKey);

  if (leadId) {
    await supabase
      .from('sourcing_leads')
      .update({ outreach_stage: 'disqualified', updated_at: new Date().toISOString() })
      .eq('id', leadId);
  }

  return { ok: true, message: `Lead ${leadId || 'unknown'} disqualified` };
}

async function handleSnooze(params: DispatchParams): Promise<DispatchResult> {
  const hours = params.data?.hours || 24;

  // Push a re-surface notification scheduled for later
  const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await pushNotification({
    user_id: params.userId,
    source: 'inapp',
    thread_key: params.threadKey ? `snooze:${params.threadKey}` : undefined,
    title: `Snoozed reminder`,
    body_md: `This item was snoozed and is now due for review.`,
    type: 'snooze_reminder',
    actions: [
      { id: 'reply_draft', type: 'button', label: '🤖 Draft with REX', style: 'primary' },
      { id: 'disqualify', type: 'button', label: '❌ Disqualify', style: 'danger' }
    ],
    metadata: {
      ...(params.metadata || {}),
      snoozed_from: params.threadKey,
      snooze_until: snoozeUntil
    }
  } as any);

  return { ok: true, message: `Snoozed for ${hours} hours` };
}

async function handlePauseCampaign(params: DispatchParams): Promise<DispatchResult> {
  const { campaignId } = parseThreadKey(params.threadKey);
  const cid = campaignId || params.data?.campaign_id || params.metadata?.campaign_id;
  if (!cid) return { ok: false, message: 'Missing campaign ID' };

  await supabase
    .from('sourcing_campaigns')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', cid)
    .eq('created_by', params.userId);

  return { ok: true, message: 'Campaign paused' };
}

async function handleResumeCampaign(params: DispatchParams): Promise<DispatchResult> {
  const { campaignId } = parseThreadKey(params.threadKey);
  const cid = campaignId || params.data?.campaign_id || params.metadata?.campaign_id;
  if (!cid) return { ok: false, message: 'Missing campaign ID' };

  await supabase
    .from('sourcing_campaigns')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', cid)
    .eq('created_by', params.userId);

  return { ok: true, message: 'Campaign resumed' };
}

async function handleFreeText(params: DispatchParams): Promise<DispatchResult> {
  const text = params.data?.text || params.data?.value || '';
  if (!text) return { ok: false, message: 'No instruction provided' };

  // Classify the instruction
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const classification = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [{
      role: 'user',
      content: `Classify this user instruction into exactly one category: reply_draft, disqualify, snooze, pause_campaign, book_meeting.
Instruction: "${text}"
Reply with just the category name.`
    }]
  });

  const category = (classification.choices?.[0]?.message?.content || '').trim().toLowerCase();
  const validCategories = ['reply_draft', 'disqualify', 'snooze', 'pause_campaign', 'book_meeting'];
  const resolvedAction = validCategories.includes(category) ? category : 'reply_draft';

  // Re-dispatch with the instruction as context
  return dispatchAction({
    ...params,
    actionId: resolvedAction,
    data: { ...params.data, instruction: text }
  });
}

async function handleNavigation(actionId: string, params: DispatchParams): Promise<DispatchResult> {
  const { campaignId } = parseThreadKey(params.threadKey);
  const cid = campaignId || params.data?.campaign_id || params.metadata?.campaign_id;

  const urlMap: Record<string, string> = {
    view_campaign: `/campaigns/${cid || ''}`,
    review_sequence: `/campaigns/${cid || ''}/sequence`,
    schedule_campaign: `/campaigns/${cid || ''}/schedule`
  };

  return { ok: true, message: 'Navigate', result: { url: urlMap[actionId] || '/campaigns' } };
}

async function handleBookMeeting(params: DispatchParams): Promise<DispatchResult> {
  // Dynamic import to avoid circular deps — composeMeetingEmail is in routes/notifications.ts
  // We replicate the core logic here using the same pattern
  const { campaignId, leadId } = parseThreadKey(params.threadKey);
  const replyId = params.data?.reply_id || params.metadata?.reply_id || null;
  const leadEmail = params.data?.lead_email || params.metadata?.lead_email || params.data?.from_email || '';

  if (!leadEmail) {
    return { ok: false, message: 'Missing recipient email for meeting request' };
  }

  // Fetch policy for calendly + strategy
  const { getPolicyForUser, getResponseStrategyForUser } = await import('../services/sales/policy');
  const policy = await getPolicyForUser(params.userId);
  const calendlyEvent = String(policy?.scheduling?.event_type || '').trim();
  const calendlyUrl = calendlyEvent ? `https://calendly.com/${calendlyEvent}` : '';

  if (!calendlyUrl) {
    // No calendly configured — push draft notification instead
    await pushNotification({
      user_id: params.userId,
      source: 'inapp',
      thread_key: params.threadKey,
      title: 'Draft meeting reply (Calendly not configured)',
      body_md: `Configure your Calendly event in Sales Agent Settings to auto-send meeting requests.`,
      type: 'meeting_draft',
      actions: [
        { id: 'reply_draft', type: 'button', label: '🤖 Draft with REX', style: 'primary' },
        { id: 'free_text', type: 'input', placeholder: 'Type an instruction…' }
      ],
      metadata: { lead_id: leadId, campaign_id: campaignId, reason: 'missing_calendly' }
    } as any);
    return { ok: true, message: 'Calendly not configured — draft card pushed instead' };
  }

  // Simple meeting email with calendly link
  const subject = `Let's find a time to connect`;
  const html = `<p>Thanks for your interest! I'd love to find a time to chat.</p><p>Here's my calendar link: <a href="${calendlyUrl}">${calendlyUrl}</a></p>`;

  const { emailQueue } = await import('../queues/redis');
  const headers: Record<string, string> = {};
  if (campaignId) headers['X-Campaign-Id'] = String(campaignId);
  if (leadId) headers['X-Lead-Id'] = String(leadId);

  await emailQueue.add('send', {
    to: leadEmail,
    subject,
    html,
    headers,
    userId: params.userId
  }, { delay: 0 });

  return { ok: true, message: `Meeting request sent to ${leadEmail}` };
}

// ── Main Dispatcher ──

export async function dispatchAction(params: DispatchParams): Promise<DispatchResult> {
  try {
    let result: DispatchResult;

    switch (params.actionId) {
      case 'reply_draft':
        result = await handleReplyDraft(params);
        break;
      case 'send_draft':
        result = await handleSendDraft(params);
        break;
      case 'disqualify':
        result = await handleDisqualify(params);
        break;
      case 'snooze':
        result = await handleSnooze(params);
        break;
      case 'pause_campaign':
        result = await handlePauseCampaign(params);
        break;
      case 'resume_campaign':
        result = await handleResumeCampaign(params);
        break;
      case 'free_text':
        result = await handleFreeText(params);
        break;
      case 'book_meeting':
      case 'book_demo':
        result = await handleBookMeeting(params);
        break;
      case 'view_campaign':
      case 'review_sequence':
      case 'schedule_campaign':
        result = await handleNavigation(params.actionId, params);
        break;
      default:
        result = { ok: false, message: `Unknown action: ${params.actionId}` };
    }

    // Record the outcome
    try {
      await processInteractionResult(params.interactionId, result);
    } catch {}

    return result;
  } catch (err: any) {
    console.error(`[interactionDispatcher] ${params.actionId} failed:`, err?.message);
    return { ok: false, message: err?.message || 'Action failed' };
  }
}
