import { Worker } from 'bullmq';
import { LINKEDIN_REMOTE_ACTION_QUEUE, connection, linkedinRemoteActionQueue } from '../queues/redis';
import { getLatestLinkedInCookieForUser } from '../services/linkedin/cookieService';
import { runLinkedInRemoteAction, LinkedInRemoteActionType } from '../services/brightdataBrowser';
import { brightDataBrowserConfig } from '../config/brightdata';
import { logLeadOutreachActivities } from '../services/activityLogger';
import { supabaseDb } from '../../lib/supabase';
import { LinkedInRemoteActionJob } from '../services/linkedinRemoteActions';
import { fetchSniperSettings, formatDateKey, getDailyCounters, saveCounters, DayNumber } from '../services/sniperSettings';
import { updateLinkedInRemoteActionLog } from '../services/linkedinRemoteActionLogs';

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

    const settings = await fetchSniperSettings(data.accountId || null);
    const tzNow = new Date(new Date().toLocaleString('en-US', { timeZone: settings.timezone || 'UTC' }));
    const withinWindow = data.testRun ? true : isWithinWorkingWindow(settings, tzNow);

    if (!withinWindow) {
      const nextWindow = findNextWindowStart(settings, tzNow);
      if (nextWindow) {
        const delayMs = nextWindow.getTime() - tzNow.getTime();
        await deferJob(job, delayMs, 'outside_working_hours');
        return { delayed: true };
      }
    }

    let counters: any = null;
    let dateKey = '';
    if (!data.testRun && data.accountId) {
      dateKey = formatDateKey(new Date(), settings.timezone || 'UTC');
      counters = await getDailyCounters(data.accountId, dateKey);
      const limit = data.action === 'connect_request'
        ? settings.sources.linkedin.connectionInvitesPerDay
        : settings.sources.linkedin.messagesPerDay;
      const used = data.action === 'connect_request'
        ? counters.linkedin_connection_invites_used
        : counters.linkedin_messages_used;
      if (used >= limit) {
        const nextWindow = findNextWindowStart(settings, new Date(tzNow.getTime() + 60 * 1000));
        if (nextWindow) {
          const delayMs = nextWindow.getTime() - tzNow.getTime();
          await deferJob(job, delayMs, 'daily_limit');
          return { delayed: true };
        }
        throw new Error('Daily limit reached');
      }
    }

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

    if (data.accountId && counters && dateKey) {
      const updatedCounters = { ...counters };
      if (data.action === 'connect_request') {
        updatedCounters.linkedin_connection_invites_used += 1;
      } else {
        updatedCounters.linkedin_messages_used += 1;
      }
      await saveCounters(updatedCounters);
    }

    const note =
      data.action === 'connect_request'
        ? 'Sent LinkedIn connection request (remote)'
        : 'Sent LinkedIn message (remote)';
    await recordLeadActivity(job.data, note);

    if (data.testRun && data.testLogId) {
      try {
        await updateLinkedInRemoteActionLog(data.testLogId, { status: 'success', error: null, job_id: String(job.id) });
      } catch (err) {
        console.warn('[LinkedInRemoteAction] Failed to update test log (success)', err);
      }
    }

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
  console.log('[LinkedInRemoteAction] Worker started');
  console.log(
    `[LinkedInRemoteAction] Worker online (queue=${LINKEDIN_REMOTE_ACTION_QUEUE}, concurrency=${brightDataBrowserConfig.maxConcurrency || 2})`
  );
  try {
    connection.on('ready', () => console.log('[LinkedInRemoteAction] Redis connection ready'));
    connection.on('error', (err: any) => console.error('[LinkedInRemoteAction] Redis connection error', err?.message || err));
  } catch {}
}

// Write failure status for test runs
linkedinRemoteActionWorker.on('failed', async (job, err) => {
  try {
    const data = (job as any)?.data as LinkedInRemoteActionJob | undefined;
    if (data?.testRun && data?.testLogId) {
      await updateLinkedInRemoteActionLog(data.testLogId, {
        status: 'failed',
        error: String(err?.message || err || 'Remote action failed'),
        job_id: job?.id ? String(job.id) : null
      });
    }
  } catch (e) {
    console.warn('[LinkedInRemoteAction] Failed to update test log (failed)', e);
  }
});

function parseMinutes(input: string) {
  const [h, m] = input.split(':').map(Number);
  return (h * 60) + (m || 0);
}

function normalizeDay(day: number): DayNumber {
  const normalized = day === 0 ? 7 : day;
  return normalized as DayNumber;
}

function isWithinWorkingWindow(settings, tzNow: Date) {
  const currentDay = normalizeDay(tzNow.getDay());
  if (!settings.workingHours.days.includes(currentDay)) return false;
  const minutes = tzNow.getHours() * 60 + tzNow.getMinutes();
  const start = parseMinutes(settings.workingHours.start);
  const end = parseMinutes(settings.workingHours.end);
  return minutes >= start && minutes < end;
}

function findNextWindowStart(settings, from: Date): Date | null {
  const startMinutes = parseMinutes(settings.workingHours.start);
  for (let i = 0; i < 7; i++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + i);
    const day = normalizeDay(candidate.getDay());
    if (!settings.workingHours.days.includes(day)) continue;
    candidate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    if (candidate.getTime() > from.getTime()) {
      return candidate;
    }
  }
  return null;
}

async function deferJob(job, delayMs: number, reason: string) {
  const delay = Math.max(delayMs, 60 * 1000);
  await linkedinRemoteActionQueue.add(
    'linkedin_remote_action',
    job.data,
    {
      delay,
      removeOnComplete: true,
      attempts: 1
    }
  );
  await job.remove();
  console.log('[LinkedInRemoteAction] Job deferred', {
    jobId: job.id,
    reason,
    delayMs: delay
  });
}


