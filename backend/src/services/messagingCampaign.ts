import dayjs from 'dayjs';
import businessDays from 'dayjs-business-days';
dayjs.extend(businessDays as any);

import { supabase } from '../lib/supabase';
import { emailQueue } from '../queues/redis';
import { buildThreeStepSequence } from './sequenceBuilder';
import { personalizeMessage } from '../utils/messageUtils';
import { ApiRequest } from '../../types/api';

type Steps = { step1: any; step2?: any; step3?: any; spacingBusinessDays?: number };

const CREDIT_PER_EMAIL = 1;

async function getValidLeads(campaignId: string) {
  const { data: leads, error } = await supabase
    .from('sourcing_leads')
    .select('id,name,email,title,company,outreach_stage')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  return (leads || []).filter(l => !!l.email && !['replied', 'unsubscribed', 'bounced'].includes(l.outreach_stage || ''));
}

function addBusinessDays(d: dayjs.Dayjs, days: number) {
  // @ts-ignore
  return d.businessAdd(days);
}

async function enqueueStepEmail(campaignId: string, lead: any, step: any, when: dayjs.Dayjs) {
  if (!step) return;
  const delayMs = Math.max(0, when.diff(dayjs(), 'millisecond'));
  const headers = await buildSenderHeaders(campaignId, { 'X-Campaign-Id': campaignId, 'X-Lead-Id': lead.id });
  await emailQueue.add('send', {
    to: lead.email,
    subject: personalizeMessage(step.subject, lead),
    html: personalizeMessage(step.body, lead),
    headers
  }, {
    delay: delayMs,
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000
  });
}

async function buildSenderHeaders(campaignId: string, base: Record<string, string>) {
  // Fetch campaign and default sender
  const { data: campaign } = await supabase
    .from('sourcing_campaigns')
    .select('default_sender_id, created_by')
    .eq('id', campaignId)
    .single();

  // Determine behavior from an optional campaign config table or defaults
  // For quick patch, read per-campaign behavior from team/user settings if available; else default to single/default_sender
  let behavior: 'single' | 'rotate' | 'specific' = 'single';
  let explicitEmail: string | null = null;
  let specificEmails: string[] = [];
  try {
    const { data: cfg } = await supabase
      .from('campaign_configs')
      .select('sender_behavior,sender_email,sender_emails')
      .eq('campaign_id', campaignId)
      .maybeSingle();
    if (cfg?.sender_behavior) behavior = cfg.sender_behavior as any;
    if (cfg?.sender_email) explicitEmail = cfg.sender_email;
    if (Array.isArray((cfg as any)?.sender_emails)) specificEmails = (cfg as any).sender_emails as string[];
  } catch {}

  // Fallback to default sender on campaign if single
  if (behavior === 'single') {
    // If explicitEmail provided, use it; otherwise resolve default_sender_id to email
    let fromEmail = explicitEmail || null;
    if (!fromEmail && campaign?.default_sender_id) {
      const { data: sender } = await supabase
        .from('email_senders')
        .select('from_email')
        .eq('id', campaign.default_sender_id)
        .single();
      fromEmail = sender?.from_email || null;
    }
    return { ...base, 'X-From-Override': fromEmail || '' };
  }

  // specific behavior: rotate among selected verified senders
  if (behavior === 'specific' && specificEmails.length > 0) {
    const { data: senders } = await supabase
      .from('user_sendgrid_senders')
      .select('email,verified')
      .in('email', specificEmails)
      .eq('user_id', campaign?.created_by as string);
    const verified = (senders || []).filter(s => s.verified).map(s => s.email);
    if (verified.length) {
      const pick = rotateSenders(verified);
      return { ...base, 'X-From-Override': pick };
    }
  }

  // rotate behavior: pick next verified sender for this user
  const { data: senders } = await supabase
    .from('user_sendgrid_senders')
    .select('email,verified')
    .eq('user_id', campaign?.created_by as string)
    .order('created_at', { ascending: true });
  const verified = (senders || []).filter(s => s.verified);
  if (!verified.length) return base;
  const pick = rotateSenders(verified.map(s => s.email));
  return { ...base, 'X-From-Override': pick };
}

function rotateSenders(emails: string[]) {
  // Simple round-robin using current time to avoid server state
  const idx = Math.floor(Date.now() / 1000) % emails.length;
  return emails[idx];
}

export async function sendTieredTemplateToCampaign(params: { campaignId: string; selectedTemplateId: string; userId: string; }) {
  await ensureAgentModeEnabled(params.userId);
  const { campaignId, selectedTemplateId } = params;
  const leads = await getValidLeads(campaignId);
  if (!leads.length) return { scheduled: 0 };

  // Treat selectedTemplateId as a sourcing_sequences.id containing steps_json
  const { data: seq, error } = await supabase
    .from('sourcing_sequences')
    .select('steps_json')
    .eq('id', selectedTemplateId)
    .single();
  if (error || !seq) throw (error || new Error('Template sequence not found'));

  const steps: Steps = seq.steps_json as Steps;
  const spacing = steps.spacingBusinessDays ?? 2;

  const now = dayjs();
  for (const l of leads) {
    // step1 immediate
    await enqueueStepEmail(campaignId, l, steps.step1, now);
    if (steps.step2) await enqueueStepEmail(campaignId, l, steps.step2, addBusinessDays(now, spacing));
    if (steps.step3) await enqueueStepEmail(campaignId, l, steps.step3, addBusinessDays(now, spacing * 2));
  }

  return { scheduled: leads.length, steps: !!steps.step3 ? 3 : steps.step2 ? 2 : 1 };
}

export async function generateAndSendNewSequenceToCampaign(params: { campaignId: string; userId: string; jobTitle?: string; tone?: string; }) {
  await ensureAgentModeEnabled(params.userId);
  const { campaignId, jobTitle, tone } = params;
  const leads = await getValidLeads(campaignId);
  if (!leads.length) return { scheduled: 0 };

  const gen = await buildThreeStepSequence({
    titleGroups: jobTitle ? [jobTitle] : ['Any'],
    productName: 'HirePilot',
    spacingBusinessDays: 2,
    industry: undefined,
    painPoints: tone ? [tone] : undefined
  });

  const steps: Steps = gen as any;
  const spacing = steps.spacingBusinessDays ?? 2;
  const now = dayjs();

  for (const l of leads) {
    await enqueueStepEmail(campaignId, l, steps.step1, now);
    if (steps.step2) await enqueueStepEmail(campaignId, l, steps.step2, addBusinessDays(now, spacing));
    if (steps.step3) await enqueueStepEmail(campaignId, l, steps.step3, addBusinessDays(now, spacing * 2));
  }

  return { scheduled: leads.length, steps: !!steps.step3 ? 3 : steps.step2 ? 2 : 1 };
}

export async function sendSingleMessageToCampaign(params: { campaignId: string; userId: string; subject?: string; html?: string; templateId?: string; }) {
  await ensureAgentModeEnabled(params.userId);
  const { campaignId, subject, html, templateId } = params;
  const leads = await getValidLeads(campaignId);
  if (!leads.length) return { scheduled: 0 };

  let finalSubject = subject || '';
  let finalHtml = html || '';
  if (templateId) {
    const { data: tpl, error } = await supabase
      .from('email_templates')
      .select('subject, content')
      .eq('id', templateId)
      .single();
    if (error || !tpl) throw (error || new Error('Template not found'));
    finalSubject = tpl.subject;
    finalHtml = tpl.content;
  }

  const now = dayjs();
  for (const l of leads) {
    const headers = { 'X-Campaign-Id': campaignId, 'X-Lead-Id': l.id } as Record<string, string>;
    await emailQueue.add('send', {
      to: l.email,
      subject: personalizeMessage(finalSubject, l),
      html: personalizeMessage(finalHtml, l),
      headers: await buildSenderHeaders(campaignId, headers)
    }, {
      delay: 0,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000
    });
  }

  return { scheduled: leads.length };
}

async function ensureAgentModeEnabled(userId: string) {
  // User-level
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('agent_mode_enabled')
    .eq('user_id', userId)
    .single();
  const userOn = !!userSettings?.agent_mode_enabled;

  // Team-level (best-effort) using team_settings.team_admin_id from team_credit_sharing
  let teamOn = true;
  try {
    const { data: sharing } = await supabase
      .from('team_credit_sharing')
      .select('team_admin_id')
      .eq('team_member_id', userId)
      .single();
    const adminId = sharing?.team_admin_id || userId;
    const { data: team } = await supabase
      .from('team_settings')
      .select('agent_mode_enabled')
      .eq('team_admin_id', adminId)
      .single();
    if (team) teamOn = !!team.agent_mode_enabled;
  } catch {}

  if (!userOn || !teamOn) {
    const reason = !userOn ? 'Agent Mode is disabled in your personal settings.' : 'Agent Mode is disabled for your team.';
    const err = new Error(`Agent Mode is off. ${reason}`);
    // @ts-ignore
    err.status = 403;
    throw err;
  }
}


