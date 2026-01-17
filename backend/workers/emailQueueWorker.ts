import { Worker } from 'bullmq';
import { connection } from '../src/queues/redis';
import { sendEmail as sendgridSend } from '../src/services/sendgrid';
import { supabase as db } from '../src/lib/supabase';
import { GmailTrackingService } from '../services/gmailTrackingService';
import { OutlookTrackingService } from '../services/outlookTrackingService';

// Cache campaign-id → isSourcing to avoid hammering DB
const campaignTypeCache = new Map<string, { isSourcing: boolean; at: number }>();
const CAMPAIGN_TYPE_TTL_MS = 5 * 60 * 1000;

async function isSourcingCampaignId(id?: string): Promise<boolean> {
  const cid = String(id || '').trim();
  if (!cid) return false;
  const cached = campaignTypeCache.get(cid);
  if (cached && (Date.now() - cached.at) < CAMPAIGN_TYPE_TTL_MS) return cached.isSourcing;
  try {
    // If it exists in sourcing_campaigns, treat as sourcing
    const { data: sc } = await db.from('sourcing_campaigns').select('id').eq('id', cid).maybeSingle();
    const isSourcing = !!sc?.id;
    campaignTypeCache.set(cid, { isSourcing, at: Date.now() });
    return isSourcing;
  } catch {
    campaignTypeCache.set(cid, { isSourcing: false, at: Date.now() });
    return false;
  }
}

// Email queue worker to process scheduled emails
async function resolveProvider(userId?: string): Promise<'sendgrid'|'google'|'outlook'|'none'> {
  try {
    if (userId) {
      // 1) Explicit user preference
      try {
        const { data: pref } = await db
          .from('user_settings')
          .select('preferred_email_provider')
          .eq('user_id', userId)
          .maybeSingle();
        const p = String(pref?.preferred_email_provider || '').toLowerCase();
        if (['sendgrid','google','outlook'].includes(p)) {
          return p as any;
        }
      } catch {}
      const { data: sg } = await db
        .from('user_sendgrid_keys')
        .select('api_key')
        .eq('user_id', userId)
        .maybeSingle();
      if (sg?.api_key) return 'sendgrid';
      const { data: g } = await db
        .from('integrations')
        .select('status')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .maybeSingle();
      if (g && ['on','enabled','connected','true'].includes(String(g.status).toLowerCase())) return 'google';
      const { data: o } = await db
        .from('integrations')
        .select('status')
        .eq('user_id', userId)
        .eq('provider', 'outlook')
        .maybeSingle();
      if (o && ['on','enabled','connected','true'].includes(String(o.status).toLowerCase())) return 'outlook';
    }
  } catch {}
  return 'none';
}

const emailWorker = new Worker('emailQueue', async (job) => {
  const { to, subject, html, headers, userId } = job.data as { to:string; subject:string; html:string; headers?:Record<string,string>; userId?:string };
  
  try {
    const provider = await resolveProvider(userId);
    if (provider === 'sendgrid') {
      await sendgridSend(to, subject, html, headers, { userId });
    } else if (provider === 'google') {
      const campaignId = headers?.['X-Campaign-Id'];
      const leadId = headers?.['X-Lead-Id'];
      const isSourcing = await isSourcingCampaignId(campaignId);
      await GmailTrackingService.sendEmail(
        userId!,
        to,
        subject,
        html,
        isSourcing ? undefined : campaignId,
        isSourcing ? undefined : leadId,
        undefined,
        isSourcing ? { sourcingCampaignId: campaignId, sourcingLeadId: leadId } : undefined
      );
    } else if (provider === 'outlook') {
      const campaignId = headers?.['X-Campaign-Id'];
      const leadId = headers?.['X-Lead-Id'];
      const isSourcing = await isSourcingCampaignId(campaignId);
      await OutlookTrackingService.sendEmail(
        userId!,
        to,
        subject,
        html,
        isSourcing ? undefined : campaignId,
        isSourcing ? undefined : leadId,
        undefined,
        isSourcing ? { sourcingCampaignId: campaignId, sourcingLeadId: leadId } : undefined
      );
    } else {
      throw new Error('NO_EMAIL_PROVIDER');
    }
    // After sending, update sourcing_leads outreach_stage progression if available
    const campaignId = headers?.['X-Campaign-Id'];
    const leadId = headers?.['X-Lead-Id'];
    if (campaignId && leadId) {
      try {
        const { data: lead } = await db
          .from('sourcing_leads')
          .select('outreach_stage')
          .eq('id', leadId)
          .maybeSingle();
        const cur = (lead?.outreach_stage || 'queued') as string;
        let next: string | null = null;
        if (cur === 'queued') next = 'step1_sent';
        else if (cur === 'step1_sent') next = 'step2_sent';
        else if (cur === 'step2_sent') next = 'step3_sent';
        if (next) {
          await db
            .from('sourcing_leads')
            .update({ outreach_stage: next })
            .eq('id', leadId);
        }
      } catch (e) {
        console.warn('[emailQueueWorker] failed to update outreach_stage for lead', leadId, e);
      }
    }
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return { success: true, to, subject };
  } catch (error: any) {
    if (String(error?.message || '').includes('NO_EMAIL_PROVIDER')) {
      console.error('❌ No email provider connected for user; cannot send. userId=', userId);
    } else {
      console.error(`❌ Failed to send email to ${to}:`, error);
    }
    throw error;
  }
}, { connection });

emailWorker.on('completed', (job) => {
  console.log(`📧 Email job ${job.id} completed for ${job.data.to}`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`💥 Email job ${job?.id} failed:`, err);
});

console.log('🚀 Email queue worker started');

export default emailWorker;
