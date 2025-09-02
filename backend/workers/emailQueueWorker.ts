import { Worker } from 'bullmq';
import { connection } from '../src/queues/redis';
import { sendEmail } from '../src/services/sendgrid';
import { supabase as db } from '../src/lib/supabase';

// Email queue worker to process scheduled emails
const emailWorker = new Worker('emailQueue', async (job) => {
  const { to, subject, html, headers } = job.data;
  
  try {
    await sendEmail(to, subject, html, headers);
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
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
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
