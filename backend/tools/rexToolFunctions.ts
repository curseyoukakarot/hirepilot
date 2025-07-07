// rexToolFunctions.ts
// MCP-compatible placeholder implementations for REX tools

import { supabaseDb } from '../lib/supabase';
import { notifySlack } from '../lib/slack';
import sgMail from '@sendgrid/mail';
import { searchAndEnrichPeople } from '../utils/apolloApi';
import { enrichLead as apolloEnrichLead } from '../services/apollo/enrichLead';
import { enrichLead as proxycurlEnrichLead } from '../services/proxycurl/enrichLead';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export async function sourceLeads({
  userId,
  campaignId,
  source,
  filters
}: {
  userId: string;
  campaignId: string;
  source: 'apollo' | 'linkedin';
  filters: Record<string, any>;
}) {
  if (source === 'linkedin') {
    // TODO: Implement LinkedIn sourcing via PhantomBuster
    return { queued: true, message: 'LinkedIn sourcing queued – not yet implemented in REX tool layer.' };
  }

  // 1. Determine Apollo API key
  let apolloApiKey: string | undefined;
  const { data: settingsRow } = await supabaseDb
    .from('user_settings')
    .select('apollo_api_key')
    .eq('user_id', userId)
    .single();

  apolloApiKey = settingsRow?.apollo_api_key ?? process.env.HIREPILOT_APOLLO_API_KEY;

  if (!apolloApiKey) throw new Error('No Apollo API key configured');

  // 2. Build Apollo search params (simple mapping – can be expanded)
  const searchParams: any = {
    api_key: apolloApiKey,
    page: 1,
    per_page: 25
  };
  if (filters?.title) searchParams.person_titles = [filters.title];
  if (filters?.location) searchParams.person_locations = [filters.location];
  if (filters?.keywords) searchParams.q_keywords = filters.keywords;

  // 3. Search & enrich people
  const { leads } = await searchAndEnrichPeople(searchParams as any);

  if (!leads.length) return { imported: 0 };

  // 4. Insert leads into lead table & campaign_leads (dedup by email)
  const uniqueLeads = leads.filter((l: any, idx: number, arr: any[]) => {
    if (!l.email) return false;
    return arr.findIndex(a => a.email === l.email) === idx;
  });

  // Map to DB schema
  const leadRows = uniqueLeads.map((l: any) => ({
    user_id: userId,
    first_name: l.firstName,
    last_name: l.lastName,
    title: l.title,
    company: l.company,
    email: l.email,
    linkedin_url: l.linkedinUrl,
    enrichment_data: { apollo: l },
    status: 'sourced'
  }));

  const { data: insertedLeads, error } = await supabaseDb
    .from('leads')
    .insert(leadRows)
    .select();

  if (error) {
    console.error('[sourceLeads] Lead insert error', error);
    throw new Error('Failed to insert leads');
  }

  // 5. Attach to campaign_leads
  const campaignLeadRows = insertedLeads.map((lead: any) => ({
    campaign_id: campaignId,
    lead_id: lead.id,
    user_id: userId
  }));

  const { error: clErr } = await supabaseDb
    .from('campaign_leads')
    .insert(campaignLeadRows);

  if (clErr) {
    console.error('[sourceLeads] campaign_leads insert error', clErr);
  }

  await notifySlack(`📥 Imported ${insertedLeads.length} leads into campaign ${campaignId}`);

  return { imported: insertedLeads.length };
}

export async function enrichLead({
  userId,
  leadId,
  fields
}: {
  userId: string;
  leadId: string;
  fields: string[];
}) {
  // Fetch minimal lead data
  const { data: leadRow, error: leadErr } = await supabaseDb
    .from('leads')
    .select('first_name, last_name, company, linkedin_url')
    .eq('id', leadId)
    .single();

  if (leadErr || !leadRow) throw new Error('Lead not found');

  // First attempt Apollo enrichment if email requested
  if (fields.includes('email') || fields.includes('phone')) {
    try {
      const resp = await apolloEnrichLead({
        leadId,
        userId,
        firstName: leadRow.first_name,
        lastName: leadRow.last_name,
        company: leadRow.company,
        linkedinUrl: leadRow.linkedin_url
      });
      return { provider: 'apollo', ...resp };
    } catch (e) {
      console.warn('[enrichLead] Apollo enrichment failed – falling back', e);
    }
  }

  // Fallback Proxycurl – uses linkedin_url
  if (!leadRow.linkedin_url) throw new Error('No LinkedIn URL for Proxycurl enrichment');

  const enrichedResp = await proxycurlEnrichLead(leadRow.linkedin_url);
  const enrichedData: any = (enrichedResp as any)?.data || {};

  // Update lead with any new fields if they exist in Proxycurl response
  const patch: any = {};
  if (fields.includes('email') && enrichedData?.personal_emails?.length) {
    patch.email = enrichedData.personal_emails[0].email;
  }
  if (fields.includes('phone') && enrichedData?.personal_numbers?.length) {
    patch.phone = enrichedData.personal_numbers[0].number;
  }

  if (Object.keys(patch).length) {
    await supabaseDb
      .from('leads')
      .update(patch)
      .eq('id', leadId);
  }

  return { provider: 'proxycurl', enrichedFields: Object.keys(patch) };
}

export async function sendMessage({
  userId,
  leadId,
  messageType,
  tone,
  jobDetails
}: {
  userId: string;
  leadId: string;
  messageType: string;
  tone: string;
  jobDetails: Record<string, any>;
}) {
  // Retrieve lead record
  const { data: lead, error: leadErr } = await supabaseDb
    .from('leads')
    .select('first_name,last_name,email')
    .eq('id', leadId)
    .single();

  if (leadErr || !lead?.email) throw new Error('Lead not found or missing email');

  // Get SendGrid credentials for user
  const { data: sgRow, error: sgErr } = await supabaseDb
    .from('user_sendgrid_keys')
    .select('api_key, default_sender')
    .eq('user_id', userId)
    .single();

  if (sgErr || !sgRow?.api_key) throw new Error('No SendGrid API key configured');

  sgMail.setApiKey(sgRow.api_key);

  const greeting = tone === 'casual' ? `Hey ${lead.first_name}` : `Hello ${lead.first_name}`;
  const subject = messageType === 'followup' ? 'Quick follow-up' : `Opportunity at ${jobDetails?.company || 'our team'}`;
  const body = `${greeting},<br/><br/>`+
    `I wanted to reach out regarding ${jobDetails?.title || 'a role'} ${jobDetails?.company ? `at ${jobDetails.company}` : ''}. `+
    `Let me know if you'd like to chat!<br/><br/>Best,<br/>HirePilot Team`;

  await sgMail.send({
    to: lead.email,
    from: sgRow.default_sender,
    subject,
    html: body
  });

  // Log message
  await supabaseDb.from('messages').insert({
    user_id: userId,
    lead_id: leadId,
    to_email: lead.email,
    subject,
    content: body,
    provider: 'sendgrid',
    status: 'sent',
    sent_at: new Date().toISOString()
  });

  return { leadId, status: 'sent', preview: body.slice(0, 120) + '...' };
}

// -----------------------------------------------------------------------------
// Tranche 1: Credits & Pipeline helpers
// -----------------------------------------------------------------------------

/**
 * Return credit usage and remaining balance for a user.
 * The query relies on the materialised `user_credits` table which tracks
 * total / used / remaining values. If the row does not exist we fall back to
 * zeros so the UI remains robust.
 */
export async function fetchCredits({ userId }: { userId: string }) {
  const { data, error } = await supabaseDb
    .from('user_credits')
    .select('total_credits, used_credits, remaining_credits')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[fetchCredits] Supabase error', error);
    throw new Error('Unable to fetch credits');
  }

  return {
    totalCredits: data?.total_credits ?? 0,
    creditsUsedThisMonth: data?.used_credits ?? 0,
    creditsRemaining: data?.remaining_credits ?? 0
  };
}

/**
 * Return list of candidates in a specific stage for the campaign's job.
 */
export async function getPipelineStats({
  campaignId,
  stage
}: {
  campaignId: string;
  stage: string;
}) {
  // Resolve the job attached to the campaign
  const { data: campaignRow, error: campErr } = await supabaseDb
    .from('campaigns')
    .select('job_id')
    .eq('id', campaignId)
    .single();

  if (campErr) {
    console.error('[getPipelineStats] Campaign lookup failed', campErr);
    throw new Error('Campaign not found');
  }

  const jobId = campaignRow.job_id;

  // Fetch candidates in the requested stage
  const { data: candidates, error } = await supabaseDb
    .from('candidate_jobs')
    .select(
      'candidate_id, status, candidates(id, first_name, last_name, email, status)' // nested select
    )
    .eq('job_id', jobId)
    .eq('status', stage);

  if (error) {
    console.error('[getPipelineStats] Supabase error', error);
    throw new Error('Unable to fetch pipeline stats');
  }

  // Shape for UI
  return (candidates || []).map((row: any) => ({
    candidateId: row.candidate_id,
    name: `${row.candidates.first_name} ${row.candidates.last_name}`.trim(),
    email: row.candidates.email,
    stage: row.status
  }));
}

/**
 * Move a candidate to a new pipeline stage and optionally send a Slack note.
 */
export async function moveCandidate({
  candidateId,
  newStage
}: {
  candidateId: string;
  newStage: string;
}) {
  // Update the status in candidate_jobs (all linked jobs)
  const { data: updatedRows, error } = await supabaseDb
    .from('candidate_jobs')
    .update({ status: newStage, updated_at: new Date().toISOString() })
    .eq('candidate_id', candidateId)
    .select();

  if (error) {
    console.error('[moveCandidate] Supabase error', error);
    throw new Error('Failed to move candidate');
  }

  // Grab candidate details for notification (use first row)
  if (updatedRows && updatedRows.length > 0) {
    try {
      const { data: candidate, error: candErr } = await supabaseDb
        .from('candidates')
        .select('first_name, last_name')
        .eq('id', candidateId)
        .single();

      const name = candErr || !candidate ? candidateId : `${candidate.first_name} ${candidate.last_name}`;
      await notifySlack(`🛫 Candidate *${name}* moved to *${newStage}*`);
    } catch (e) {
      console.warn('[moveCandidate] Slack notify failed', e);
    }
  }

  return { candidateId, movedTo: newStage, success: true };
}

// -----------------------------------------------------------------------------
// Tranche 3: Automations & utilities
// -----------------------------------------------------------------------------

/**
 * Trigger a Zapier webhook by name. Expects env var ZAPIER_WEBHOOK_BASE like
 * https://hooks.zapier.com/hooks/catch/XXXXXXX.
 */
export async function triggerZapier({
  webhookName,
  payload
}: {
  webhookName: string;
  payload: Record<string, any>;
}) {
  const base = process.env.ZAPIER_WEBHOOK_BASE;
  if (!base) throw new Error('ZAPIER_WEBHOOK_BASE env not configured');

  const url = `${base}/${webhookName}`;

  const resp = await axios.post(url, payload, { timeout: 10000 }).catch(e => {
    console.error('[triggerZapier] HTTP error', e.response?.data || e.message);
    throw new Error('Zapier webhook call failed');
  });

  return { webhookName, status: resp.status, triggered: true };
}

/**
 * Trigger a Make.com workflow via its public webhook ID.
 */
export async function triggerMakeWorkflow({
  workflowId,
  payload
}: {
  workflowId: string;
  payload: Record<string, any>;
}) {
  const url = `https://hook.integromat.com/${workflowId}`;

  const resp = await axios.post(url, payload, { timeout: 10000 }).catch(e => {
    console.error('[triggerMakeWorkflow] HTTP error', e.response?.data || e.message);
    throw new Error('Make.com webhook failed');
  });

  return { workflowId, status: resp.status, triggered: true };
}

/**
 * Fetch a help article markdown from Supabase storage bucket `help-center` or
 * return not found.
 */
export async function openHelpArticle({ topic }: { topic: string }) {
  try {
    const { data, error } = await supabaseDb.storage.from('help-center').download(`${topic}.md`);
    if (error || !data) {
      return {
        topic,
        title: `Help article: ${topic}`,
        content: 'Article not found.'
      };
    }

    const buffer = await data.arrayBuffer();
    const content = Buffer.from(buffer).toString('utf-8');

    return { topic, title: `Help article: ${topic}`, content };
  } catch (e) {
    console.error('[openHelpArticle] error', e);
    return { topic, title: `Help article: ${topic}`, content: 'Failed to load article.' };
  }
}

/**
 * Check SendGrid delivery/open status for an email message.
 */
export async function getEmailStatus({ emailId }: { emailId: string }) {
  // 1. Locate message row
  const { data: msgRow, error } = await supabaseDb
    .from('messages')
    .select('id, sg_message_id, user_id, status, opened, clicked, sent_at')
    .or(`id.eq.${emailId},sg_message_id.eq.${emailId}`)
    .maybeSingle();

  if (error || !msgRow) {
    throw new Error('Message not found');
  }

  const msgId = msgRow.sg_message_id || emailId;

  // 2. Fetch SendGrid key
  const { data: keyRow, error: keyErr } = await supabaseDb
    .from('user_sendgrid_keys')
    .select('api_key')
    .eq('user_id', msgRow.user_id)
    .single();

  if (keyErr || !keyRow?.api_key) {
    return { emailId: msgId, status: msgRow.status, opened: msgRow.opened, clicked: msgRow.clicked };
  }

  // 3. Call SendGrid messages API
  try {
    const sg = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      headers: { Authorization: `Bearer ${keyRow.api_key}` }
    });

    const query = encodeURIComponent(`msg_id='${msgId}'`);
    const resp = await sg.get(`/messages?query=${query}`);

    const events = resp.data.messages?.[0] || {};

    return {
      emailId: msgId,
      status: events.event || msgRow.status,
      opened: events.opens_count ? events.opens_count > 0 : msgRow.opened,
      clicked: events.clicks_count ? events.clicks_count > 0 : msgRow.clicked,
      lastEventTime: events.last_event_time || null
    };
  } catch (e) {
    console.error('[getEmailStatus] SendGrid API error', e.response?.data || e.message);
    // Fallback to DB values
    return { emailId: msgId, status: msgRow.status, opened: msgRow.opened, clicked: msgRow.clicked };
  }
}

// -----------------------------------------------------------------------------
// Zapier / Make setup helpers
// -----------------------------------------------------------------------------

/**
 * Ensure the user has an API key (creates one if absent) and return it.
 */
export async function generateApiKey({ userId }: { userId: string }) {
  // Check existing
  const { data: existing } = await supabaseDb
    .from('api_keys')
    .select('key')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.key) return { apiKey: existing.key };

  const apiKey = uuidv4();
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const { error } = await supabaseDb
    .from('api_keys')
    .insert({ user_id: userId, key: apiKey, environment });

  if (error) throw new Error('Failed to create API key');
  return { apiKey };
}

/**
 * Save a webhook URL + event for the user and return the generated secret.
 */
export async function registerWebhook({
  userId,
  url,
  event
}: {
  userId: string;
  url: string;
  event: string;
}) {
  const secret = uuidv4();
  const { data, error } = await supabaseDb
    .from('webhooks')
    .insert({ user_id: userId, url, event, secret })
    .select('id, secret')
    .single();

  if (error) throw new Error('Failed to save webhook');
  return { webhookId: data.id, secret: data.secret };
}

export function listZapierEndpoints() {
  const base = process.env.BACKEND_URL || 'https://api.thehirepilot.com';
  return {
    actions: {
      createOrUpdateLead: `${base}/api/zapier/leads`,
      enrichLead: `${base}/api/zapier/enrich`
    },
    triggers: {
      newLead: `${base}/api/zapier/triggers/new-leads`,
      pipelineStageChanged: `${base}/api/zapier/triggers/pipeline-stage-changes`
    },
    events: ['lead.created', 'lead.updated', 'lead.stage_changed']
  };
} 