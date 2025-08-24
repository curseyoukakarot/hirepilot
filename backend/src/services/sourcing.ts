import dayjs from 'dayjs';
import businessDays from 'dayjs-business-days';
dayjs.extend(businessDays as any);

import { supabase } from '../lib/supabase';
import { sendEmail } from './sendgrid';
import { buildThreeStepSequence } from './sequenceBuilder';
import { emailQueue } from '../queues/redis';

type Steps = { step1: any; step2: any; step3: any; spacingBusinessDays: number };

export async function createCampaign(payload: {
  title: string;
  audience_tag?: string;
  sender_id?: string;
  created_by?: string;
}) {
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

  // Optional: deduct credits if these leads originated from Apollo via REX
  try {
    if (options?.source === 'apollo' && options?.userId) {
      const { CreditService } = await import('../services/creditService');
      await CreditService.useCreditsEffective(options.userId, payload.length);
      await CreditService.logCreditUsage(
        options.userId,
        payload.length,
        'api_usage',
        `REX Apollo import: ${payload.length} leads added to sourcing campaign ${campaignId}`
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
