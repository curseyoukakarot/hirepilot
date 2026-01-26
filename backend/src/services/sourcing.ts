import dayjs from 'dayjs';
import businessDays from 'dayjs-business-days';
dayjs.extend(businessDays as any);

import { supabase } from '../lib/supabase';
import { sendEmail } from './sendgrid';
import { updateLeadOutreachStage } from './sourcingUtils';
import { buildThreeStepSequence } from './sequenceBuilder';
import { emailQueue } from '../queues/redis';

type Steps = { step1: any; step2?: any; step3?: any; spacingBusinessDays: number };

type MirrorMetadata = {
  lead_source?: string;
  tags?: string[];
  scheduler_run_id?: string;
};

export async function createCampaign(
  payload: {
  title: string;
  audience_tag?: string;
  sender_id?: string;
  created_by?: string;
  },
  workspaceId?: string | null
) {
  // Free plan limit: max 3 active campaigns per user
  try {
    if (payload.created_by) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_tier')
        .eq('user_id', payload.created_by)
        .maybeSingle();
      const planTier = (sub?.plan_tier || '').toLowerCase();
      if (planTier === 'free') {
        const { data: countData } = await supabase
          .from('sourcing_campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', payload.created_by)
          .in('status', ['running','active','draft']);
        const activeCount = (countData as any) || 0;
        if (Number(activeCount) >= 3) {
          throw new Error('Free plan limit reached: maximum 3 active campaigns.');
        }
      }
    }
  } catch (e: any) {
    // Surface gating errors
    if (e?.message?.includes('Free plan limit')) throw e;
  }
  const { data, error } = await supabase.from('sourcing_campaigns')
    .insert({
      title: payload.title,
      audience_tag: payload.audience_tag || null,
      default_sender_id: payload.sender_id || null,
      created_by: payload.created_by || null,
      workspace_id: workspaceId || null
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function saveSequence(campaignId: string, steps: Steps) {
  const { data, error } = await supabase.from('sourcing_sequences')
    .insert({
      campaign_id: campaignId,
      steps_json: steps
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function addLeads(
  campaignId: string,
  leads: any[],
  options?: { source?: string; userId?: string; mirrorMetadata?: MirrorMetadata; workspaceId?: string | null }
) {
  if (!leads?.length) return { inserted: 0 };
  const payload = leads.map(l => ({
    campaign_id: campaignId,
    ...l,
    enriched: !!l.email,
    scheduler_run_id: options?.mirrorMetadata?.scheduler_run_id || null,
    workspace_id: options?.workspaceId || null
  }));
  const { data, error } = await supabase.from('sourcing_leads').insert(payload).select('*');
  if (error) throw error;

  // Mirror into base leads for visibility in /leads (All Campaigns) view
  // Non-fatal; ignore errors to avoid blocking sourcing flow
  try {
    // Resolve campaign owner to attribute leads to correct user in base leads table
    const { data: campOwner } = await supabase
      .from('sourcing_campaigns')
      .select('created_by')
      .eq('id', campaignId)
      .maybeSingle();

    const ownerUserId = (campOwner as any)?.created_by as string | undefined;
    if (ownerUserId) {
      // Collect unique, valid emails from incoming payload
      const emails = Array.from(new Set((payload || [])
        .map((p: any) => (p?.email ? String(p.email).trim().toLowerCase() : ''))
        .filter(Boolean)));

      if (emails.length > 0) {
        // Find existing leads for this user to avoid duplicates by (user_id,email)
        const { data: existing } = await supabase
          .from('leads')
          .select('email')
          .eq('user_id', ownerUserId)
          .in('email', emails);

        const existingEmails = new Set((existing || []).map((r: any) => String(r.email || '').toLowerCase()));

        const toInsert = (payload || [])
          .filter((p: any) => p?.email && !existingEmails.has(String(p.email).toLowerCase()))
          .map((p: any) => {
            const insertRow: any = {
            user_id: ownerUserId,
            name: p.name || p.email,
            email: p.email,
            title: p.title || null,
            company: p.company || null,
            linkedin_url: p.linkedin_url || null,
              // Important: base leads.campaign_id references classic campaigns. Leave null to avoid FK issues.
              campaign_id: null,
              source: options?.mirrorMetadata?.lead_source || 'sourcing_campaign',
              scheduler_run_id: options?.mirrorMetadata?.scheduler_run_id || null
            };
            const tags = Array.isArray(options?.mirrorMetadata?.tags) ? options!.mirrorMetadata!.tags! : [];
            const runId = options?.mirrorMetadata?.scheduler_run_id;
            const runTag = runId ? [`scheduler_run:${runId}`] : [];
            const mergedTags = Array.from(new Set([...(tags || []), ...runTag].filter(Boolean)));
            if (mergedTags.length) insertRow.tags = mergedTags;
            return insertRow;
          });

        if (toInsert.length > 0) {
          await supabase.from('leads').insert(toInsert);
        }
      }
    }
  } catch (mirrorErr) {
    console.warn('[sourcing.addLeads] non-fatal base leads mirror error:', mirrorErr);
  }

  // If campaign is in draft, flip to running after adding leads
  try {
    const { data: campaign, error: fetchErr } = await supabase
      .from('sourcing_campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .single();
    if (!fetchErr && campaign && (campaign as any).status === 'draft') {
      const { error: updateErr } = await supabase
        .from('sourcing_campaigns')
        .update({ status: 'running' })
        .eq('id', campaignId);
      if (updateErr) {
        console.warn('[sourcing.addLeads] failed to auto-activate campaign:', updateErr);
      }
    }
  } catch (e) {
    console.warn('[sourcing.addLeads] non-fatal activation error:', e);
  }

  // Optional: deduct credits if these leads originated from Apollo or LinkedIn via REX or campaign wizard
  try {
    if (options?.source === 'apollo' && options?.userId) {
      const { CreditService } = await import('../../services/creditService');
      // Charge 1 credit per lead for Apollo-sourced leads
      await CreditService.useCreditsEffective(options.userId, payload.length * 1);
      await CreditService.logCreditUsage(
        options.userId,
        payload.length * 1,
        'api_usage',
        `${String(options.source).toUpperCase()} import: ${payload.length} leads added to sourcing campaign ${campaignId} (1 credit/lead)`
      );
    }
  } catch (e) {
    console.error('[sourcing.addLeads] credit deduction failed (non-fatal):', e);
  }

  return { inserted: payload.length, leads: data || [] };
}

export async function scheduleCampaign(campaignId: string) {
  // fetch sequence & leads
  const { data: seq } = await supabase.from('sourcing_sequences')
    .select('*')
    .eq('campaign_id', campaignId)
    .single();
  const { data: leads } = await supabase.from('sourcing_leads')
    .select('*')
    .eq('campaign_id', campaignId);
    
  if (!seq || !leads?.length) throw new Error('Missing sequence or leads');
  
  const steps: Steps = seq.steps_json;
  const now = dayjs();

  for (const l of leads) {
    if (!l.email) continue;
    // immediate step1
    await sendStepEmail(campaignId, l, steps.step1, 0);
    // step2 & step3 scheduled
    await enqueueStepEmail(campaignId, l, steps.step2, addBusinessDays(now, steps.spacingBusinessDays));
    const s3 = addBusinessDays(now, steps.spacingBusinessDays * 2);
    await enqueueStepEmail(campaignId, l, steps.step3, s3);
  }
  
  await supabase.from('sourcing_campaigns')
    .update({ status: 'running' })
    .eq('id', campaignId);
  // One-time launch notification
  try {
    const { sendSourcingCampaignNotification } = await import('./sourcingNotifications');
    await sendSourcingCampaignNotification('launched', campaignId, { leadsScheduled: leads.length });
  } catch (e) {
    console.warn('[sourcing.scheduleCampaign] launch notification failed (non-fatal):', e);
  }
    
  return { scheduled: leads.length };
}

function addBusinessDays(d: dayjs.Dayjs, days: number) {
  // @ts-ignore
  return d.businessAdd(days);
}

export async function sendSequenceForLeads(params: {
  campaignId: string;
  leadIds: string[];
  sendDelayMinutes?: number | null;
  dailySendCap?: number | null;
}) {
  const { campaignId, leadIds, sendDelayMinutes, dailySendCap } = params;
  if (!leadIds.length) return { scheduled: 0, skipped: 0 };

  const { data: seq } = await supabase
    .from('sourcing_sequences')
    .select('steps_json')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (!seq?.steps_json) throw new Error('campaign_missing_sequence');

  const steps: Steps = seq.steps_json as Steps;
  const spacing = steps.spacingBusinessDays ?? 2;

  const { data: leadRows } = await supabase
    .from('sourcing_leads')
    .select('id,name,email,title,company')
    .in('id', leadIds);

  const validLeads = (leadRows || []).filter(l => !!l?.email);
  if (!validLeads.length) return { scheduled: 0, skipped: leadIds.length };

  const cap = typeof dailySendCap === 'number' && dailySendCap > 0 ? dailySendCap : null;
  const targetLeads = cap ? validLeads.slice(0, cap) : validLeads;
  const anchor = dayjs().add(sendDelayMinutes || 0, 'minute');

  for (const lead of targetLeads) {
    const delayMs = Math.max(0, anchor.diff(dayjs(), 'millisecond'));
    try {
      await sendStepEmail(campaignId, lead, steps.step1, delayMs);
      if (steps.step2) await enqueueStepEmail(campaignId, lead, steps.step2, addBusinessDays(anchor, spacing));
      if (steps.step3) await enqueueStepEmail(campaignId, lead, steps.step3, addBusinessDays(anchor, spacing * 2));
    } catch (err) {
      console.warn('[sourcing.sendSequenceForLeads] failed to queue lead', lead.id, err);
    }
  }

  return { scheduled: targetLeads.length, skipped: validLeads.length - targetLeads.length };
}

/**
 * Deterministic, queue-only kickoff for scheduler-sourced leads.
 * Never sends inline (even when "immediate") to keep scheduler ticks fast and reliable.
 * Also skips leads already marked as sent/scheduled/etc.
 */
export async function queueInitialOutreachForNewLeads(params: {
  campaignId: string;
  leadIds: string[];
  sendDelayMinutes?: number | null;
  dailySendCap?: number | null;
}) {
  const { campaignId, leadIds, sendDelayMinutes, dailySendCap } = params;
  if (!leadIds.length) return { queued: 0, skipped: 0 };

  const { data: seq } = await supabase
    .from('sourcing_sequences')
    .select('steps_json')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (!seq?.steps_json) throw new Error('campaign_missing_sequence');

  const steps: Steps = seq.steps_json as Steps;
  const spacing = steps.spacingBusinessDays ?? 2;

  const { data: leadRows } = await supabase
    .from('sourcing_leads')
    .select('id,name,email,title,company,outreach_stage')
    .in('id', leadIds);

  const alreadyMessaged = new Set(
    (leadRows || [])
      .filter((l: any) => ['sent','scheduled','replied','bounced','unsubscribed'].includes(String(l?.outreach_stage || '').toLowerCase()))
      .map((l: any) => l.id)
  );
  const validLeads = (leadRows || [])
    .filter((l: any) => !!l?.email)
    .filter((l: any) => !alreadyMessaged.has(l.id));
  if (!validLeads.length) return { queued: 0, skipped: leadIds.length };

  const cap = typeof dailySendCap === 'number' && dailySendCap > 0 ? dailySendCap : null;
  const targetLeads = cap ? validLeads.slice(0, cap) : validLeads;
  const anchor = dayjs().add(sendDelayMinutes || 0, 'minute');

  for (const lead of targetLeads) {
    try {
      // Step 1: queue even if delay is 0 (queue-only behavior)
      const delayMs = Math.max(0, anchor.diff(dayjs(), 'millisecond'));
      await queueStepEmailAlways(campaignId, lead, steps.step1, delayMs);
      if (steps.step2) await queueStepEmailAlways(campaignId, lead, steps.step2, Math.max(0, addBusinessDays(anchor, spacing).diff(dayjs(), 'millisecond')));
      if (steps.step3) await queueStepEmailAlways(campaignId, lead, steps.step3, Math.max(0, addBusinessDays(anchor, spacing * 2).diff(dayjs(), 'millisecond')));
    } catch (err) {
      console.warn('[sourcing.queueInitialOutreachForNewLeads] failed to queue lead', lead.id, err);
    }
  }

  return { queued: targetLeads.length, skipped: validLeads.length - targetLeads.length };
}

async function sendStepEmail(campaignId: string, lead: any, step: any, delayMs: number) {
  const headers = {
    'X-Campaign-Id': campaignId,
    'X-Lead-Id': lead.id,
  };
  
  if (delayMs === 0) {
    // Resolve created_by to use per-user SendGrid credentials
    let sendUserId: string | undefined = undefined;
    try {
      const { data: camp } = await supabase
        .from('sourcing_campaigns')
        .select('created_by')
        .eq('id', campaignId)
        .maybeSingle();
      sendUserId = (camp as any)?.created_by || undefined;
    } catch {}
    await sendEmail(
      lead.email,
      personalize(step.subject, lead),
      personalize(step.body, lead),
      headers,
      { userId: sendUserId }
    );
    try { await updateLeadOutreachStage(lead.id, 'sent'); } catch {}
  } else {
    // Ensure we also include userId for queued emails
    let payloadUserId: string | undefined = undefined;
    try {
      const { data: camp } = await supabase
        .from('sourcing_campaigns')
        .select('created_by')
        .eq('id', campaignId)
        .maybeSingle();
      payloadUserId = (camp as any)?.created_by || undefined;
    } catch {}
    await emailQueue.add('send', {
      to: lead.email,
      subject: personalize(step.subject, lead),
      html: personalize(step.body, lead),
      headers,
      userId: payloadUserId
    }, {
      delay: delayMs,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000
    });
    try { await updateLeadOutreachStage(lead.id, 'scheduled'); } catch {}
  }
}

async function queueStepEmailAlways(campaignId: string, lead: any, step: any, delayMs: number) {
  const headers = {
    'X-Campaign-Id': campaignId,
    'X-Lead-Id': lead.id,
  };
  // Ensure we include userId for queued emails
  let payloadUserId: string | undefined = undefined;
  try {
    const { data: camp } = await supabase
      .from('sourcing_campaigns')
      .select('created_by')
      .eq('id', campaignId)
      .maybeSingle();
    payloadUserId = (camp as any)?.created_by || undefined;
  } catch {}
  await emailQueue.add('send', {
    to: lead.email,
    subject: personalize(step.subject, lead),
    html: personalize(step.body, lead),
    headers,
    userId: payloadUserId
  }, {
    delay: Math.max(0, delayMs),
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000
  });
  try { await updateLeadOutreachStage(lead.id, 'scheduled'); } catch {}
}

async function enqueueStepEmail(campaignId: string, lead: any, step: any, when: dayjs.Dayjs) {
  const delayMs = Math.max(0, when.diff(dayjs(), 'millisecond'));
  return sendStepEmail(campaignId, lead, step, delayMs);
}

function personalize(text: string, lead: any) {
  return (text || '')
    .replace(/\{\{name\}\}/gi, lead.name || '')
    .replace(/\{\{company\}\}/gi, lead.company || '')
    .replace(/\{\{title\}\}/gi, lead.title || '');
}

export async function generateSequenceForCampaign(
  campaignId: string,
  params: {
    title_groups: string[];
    industry?: string;
    product_name: string;
    spacing_business_days?: number;
  }
) {
  const steps = await buildThreeStepSequence({
    titleGroups: params.title_groups,
    industry: params.industry,
    painPoints: ['save recruiter time', 'improve reply rate', 'book more interviews'],
    productName: params.product_name,
    spacingBusinessDays: params.spacing_business_days ?? 2
  });
  return saveSequence(campaignId, steps as any);
}
