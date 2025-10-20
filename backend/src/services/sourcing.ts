import dayjs from 'dayjs';
import businessDays from 'dayjs-business-days';
dayjs.extend(businessDays as any);

import { supabase } from '../lib/supabase';
import { sendEmail } from './sendgrid';
import { updateLeadOutreachStage } from './sourcingUtils';
import { buildThreeStepSequence } from './sequenceBuilder';
import { emailQueue } from '../queues/redis';

type Steps = { step1: any; step2: any; step3: any; spacingBusinessDays: number };

export async function createCampaign(payload: {
  title: string;
  audience_tag?: string;
  sender_id?: string;
  created_by?: string;
}) {
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
      created_by: payload.created_by || null
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

export async function addLeads(campaignId: string, leads: any[], options?: { source?: string; userId?: string }) {
  if (!leads?.length) return { inserted: 0 };
  const payload = leads.map(l => ({
    campaign_id: campaignId,
    ...l,
    enriched: !!l.email
  }));
  const { error } = await supabase.from('sourcing_leads').insert(payload);
  if (error) throw error;

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

  return { inserted: payload.length };
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

async function sendStepEmail(campaignId: string, lead: any, step: any, delayMs: number) {
  const headers = {
    'X-Campaign-Id': campaignId,
    'X-Lead-Id': lead.id,
  };
  
  if (delayMs === 0) {
    await sendEmail(
      lead.email,
      personalize(step.subject, lead),
      personalize(step.body, lead),
      headers
    );
    try { await updateLeadOutreachStage(lead.id, 'sent'); } catch {}
  } else {
    await emailQueue.add('send', {
      to: lead.email,
      subject: personalize(step.subject, lead),
      html: personalize(step.body, lead),
      headers
    }, {
      delay: delayMs,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000
    });
    try { await updateLeadOutreachStage(lead.id, 'scheduled'); } catch {}
  }
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
