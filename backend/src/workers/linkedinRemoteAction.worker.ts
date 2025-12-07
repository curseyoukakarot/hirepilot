import { Worker } from 'bullmq';
import { LINKEDIN_REMOTE_ACTION_QUEUE, connection } from '../queues/redis';
import { getLatestLinkedInCookieForUser } from '../services/linkedin/cookieService';
import { runLinkedInRemoteAction, LinkedInRemoteActionType } from '../services/brightdataBrowser';
import { brightDataBrowserConfig } from '../config/brightdata';
import { logLeadOutreachActivities } from '../services/activityLogger';
import { supabaseDb } from '../../lib/supabase';
import { LinkedInRemoteActionJob } from '../services/linkedinRemoteActions';

const CREDIT_COST: Record<LinkedInRemoteActionType, number> = {
  connect_request: 3,
  send_message: 2
};

async function recordLeadActivity(job: LinkedInRemoteActionJob, note: string) {
  if (job.leadId) {
    await logLeadOutreachActivities([job.leadId], job.userId, { note });
    return;
  }

  if (job.candidateId) {
    try {
      await supabaseDb.from('candidate_activities').insert({
        candidate_id: job.candidateId,
        user_id: job.userId,
        activity_type: 'RemoteAction',
        notes: note,
        activity_timestamp: new Date().toISOString()
      } as any);
    } catch (err) {
      console.warn('[LinkedInRemoteAction] Candidate activity insert failed', err);
    }
  }
}

async function deductCredits(userId: string, action: LinkedInRemoteActionType) {
  try {
    const { CreditService } = await import('../../services/creditService');
    const cost = CREDIT_COST[action] || 2;
    await CreditService.deductCredits(
      userId,
      cost,
      'api_usage',
      `LinkedIn remote action: ${action}`
    );
  } catch (err) {
    console.error('[LinkedInRemoteAction] Credit deduction failed (non-fatal)', err);
  }
}

export const linkedinRemoteActionWorker = new Worker<LinkedInRemoteActionJob>(
  LINKEDIN_REMOTE_ACTION_QUEUE,
  async job => {
    const data = job.data;
    console.log('[LinkedInRemoteAction] Job received', {
      jobId: job.id,
      action: data.action,
      userId: data.userId,
      leadId: data.leadId,
      candidateId: data.candidateId
    });

    const cookies = await getLatestLinkedInCookieForUser(data.userId);
    if (!cookies) {
      throw new Error('No LinkedIn cookies on file. Ask user to refresh session.');
    }

    const result = await runLinkedInRemoteAction(
      cookies,
      {
        action: data.action,
        linkedinUrl: data.linkedinUrl,
        message: data.message
      },
      {
        userId: data.userId,
        leadId: data.leadId,
        candidateId: data.candidateId
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Remote action failed');
    }

    await deductCredits(data.userId, data.action);

    const note =
      data.action === 'connect_request'
        ? 'Sent LinkedIn connection request (remote)'
        : 'Sent LinkedIn message (remote)';
    await recordLeadActivity(job.data, note);

    console.log('[LinkedInRemoteAction] Job completed', { jobId: job.id });
    return { success: true };
  },
  {
    connection,
    concurrency: brightDataBrowserConfig.maxConcurrency || 2,
    limiter: {
      max: brightDataBrowserConfig.maxConcurrency || 2,
      duration: 1000
    }
  }
);

if (require.main === module) {
  console.log(
    `[LinkedInRemoteAction] Worker online (queue=${LINKEDIN_REMOTE_ACTION_QUEUE}, concurrency=${brightDataBrowserConfig.maxConcurrency || 2})`
  );
}

