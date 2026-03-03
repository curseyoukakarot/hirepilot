/**
 * Campaign Ticker Worker
 *
 * Runs every 15 minutes via BullMQ repeatable job.
 * Picks up enrollments whose next_step_at has passed, looks up the next step
 * in the campaign, and either:
 *   - Advances past a 'wait' step (recalculating the next schedule)
 *   - Creates a sniper_job + sniper_job_items for action steps (connect, message, etc.)
 *     and enqueues them to the existing sniper:v1 queue for execution
 *   - Marks the enrollment as 'completed' if no more steps remain
 */

import { Worker, Job } from 'bullmq';
import dayjs from 'dayjs';
import { connection, sniperV1Queue, sniperCampaignTickerQueue } from '../queues/redis';
import {
  fetchDueEnrollments,
  getCampaign,
  getCampaignStep,
  listCampaignSteps,
  updateEnrollment,
  updateCampaignStats,
  type CampaignEnrollmentRow,
  type CampaignStepRow,
  type CampaignRow
} from '../services/sniperV1/campaignDb';
import { createJob, insertJobItems } from '../services/sniperV1/db';
import { fetchSniperV1Settings, isWithinActiveHours } from '../services/sniperV1/settings';

const QUEUE = 'sniper:campaign_ticker';
const TICK_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function computeNextStepAt(fromDate: Date, step: CampaignStepRow): Date {
  const d = dayjs(fromDate);
  return d.add(step.delay_days, 'day').add(step.delay_hours, 'hour').toDate();
}

/**
 * Map campaign step action_type → sniper job_type
 */
function mapActionToJobType(action: string): string | null {
  switch (action) {
    case 'connect':
      return 'send_connect_requests';
    case 'message':
      return 'send_messages';
    case 'profile_visit':
      return 'send_messages'; // Reuse messages worker with profile_visit flag in input_json
    case 'like_post':
      return 'send_messages'; // Same — browser action handled by provider
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Core tick logic for a single enrollment
// ---------------------------------------------------------------------------

async function processEnrollment(enrollment: CampaignEnrollmentRow): Promise<void> {
  const campaign = await getCampaign(enrollment.campaign_id);
  if (!campaign) {
    // Campaign deleted — mark enrollment as error
    await updateEnrollment(enrollment.id, { status: 'error', next_step_at: null });
    return;
  }

  // If campaign is no longer active, pause the enrollment
  if (campaign.status !== 'active') {
    await updateEnrollment(enrollment.id, { status: 'paused', next_step_at: null });
    return;
  }

  // Check active hours — if outside working hours, skip for now (ticker will retry next cycle)
  const settings = await fetchSniperV1Settings(campaign.workspace_id);
  if (!isWithinActiveHours(new Date(), settings)) {
    return; // Don't advance — ticker will retry in 15 min
  }

  const nextStepOrder = enrollment.current_step_order + 1;
  const nextStep = await getCampaignStep(enrollment.campaign_id, nextStepOrder);

  if (!nextStep) {
    // No more steps → mark completed
    await updateEnrollment(enrollment.id, {
      status: 'completed',
      current_step_order: enrollment.current_step_order,
      next_step_at: null,
      last_action_at: nowIso()
    });
    return;
  }

  // Handle 'wait' steps: just advance and schedule next
  if (nextStep.action_type === 'wait') {
    const futureStepOrder = nextStepOrder + 1;
    const futureStep = await getCampaignStep(enrollment.campaign_id, futureStepOrder);
    const nextAt = computeNextStepAt(new Date(), nextStep);

    if (!futureStep) {
      // Wait is the last step — mark completed after the wait
      await updateEnrollment(enrollment.id, {
        status: 'completed',
        current_step_order: nextStepOrder,
        next_step_at: null,
        last_action_at: nowIso()
      });
    } else {
      // Advance past the wait step; schedule for next real step
      await updateEnrollment(enrollment.id, {
        current_step_order: nextStepOrder,
        next_step_at: nextAt.toISOString(),
        last_action_at: nowIso()
      });
    }
    return;
  }

  // Action step: create a sniper job to execute
  const jobType = mapActionToJobType(nextStep.action_type);
  if (!jobType) {
    // Unrecognized action — skip with error
    await updateEnrollment(enrollment.id, { status: 'error', next_step_at: null });
    return;
  }

  const configJson = nextStep.config_json || {};

  // Build input JSON for the sniper job
  const inputJson: any = {
    campaign_id: enrollment.campaign_id,
    enrollment_id: enrollment.id,
    step_id: nextStep.id,
    step_order: nextStepOrder,
    action_type: nextStep.action_type,
    ...configJson
  };

  try {
    // Create the sniper job
    const job = await createJob({
      workspace_id: campaign.workspace_id,
      created_by: campaign.created_by,
      job_type: jobType as any,
      provider: (settings as any).provider_preference || 'airtop',
      input_json: inputJson
    });

    // Create the single job item for this profile
    await insertJobItems([
      {
        job_id: job.id,
        workspace_id: campaign.workspace_id,
        profile_url: enrollment.profile_url,
        action_type: nextStep.action_type === 'connect' ? 'connect' : 'message',
        status: 'queued'
      }
    ]);

    // Enqueue for the sniper v1 worker to execute
    await sniperV1Queue.add('sniper_v1', { jobId: job.id });

    // Advance the enrollment — compute when the *following* step should fire
    const followingStepOrder = nextStepOrder + 1;
    const followingStep = await getCampaignStep(enrollment.campaign_id, followingStepOrder);
    const nextAt = followingStep
      ? computeNextStepAt(new Date(), followingStep)
      : null;

    await updateEnrollment(enrollment.id, {
      current_step_order: nextStepOrder,
      next_step_at: nextAt ? nextAt.toISOString() : null,
      last_action_at: nowIso(),
      last_job_item_id: job.id
    });

    // If no following step, mark completed
    if (!followingStep) {
      await updateEnrollment(enrollment.id, { status: 'completed' });
    }
  } catch (err: any) {
    console.error(`[campaign-ticker] Error processing enrollment ${enrollment.id}:`, err?.message);
    // Don't kill the enrollment on transient errors — retry next tick
    // But if it's a persistent issue, the error will show up in logs
  }
}

// ---------------------------------------------------------------------------
// Worker definition
// ---------------------------------------------------------------------------

async function tick(_job: Job): Promise<void> {
  const startMs = Date.now();
  console.log(`[campaign-ticker] Tick started at ${new Date().toISOString()}`);

  let processed = 0;
  let errors = 0;

  try {
    const enrollments = await fetchDueEnrollments(TICK_BATCH_SIZE);

    if (!enrollments.length) {
      console.log('[campaign-ticker] No due enrollments — done.');
      return;
    }

    console.log(`[campaign-ticker] Processing ${enrollments.length} due enrollments`);

    // Track which campaigns were touched for stats refresh
    const touchedCampaigns = new Set<string>();

    for (const enrollment of enrollments) {
      try {
        await processEnrollment(enrollment);
        touchedCampaigns.add(enrollment.campaign_id);
        processed++;
      } catch (err: any) {
        console.error(`[campaign-ticker] Error on enrollment ${enrollment.id}:`, err?.message);
        errors++;
      }
    }

    // Batch-refresh stats for all affected campaigns
    for (const cid of touchedCampaigns) {
      try {
        await updateCampaignStats(cid);
      } catch {
        // non-critical
      }
    }
  } catch (err: any) {
    console.error('[campaign-ticker] Fatal tick error:', err?.message);
  }

  const durationMs = Date.now() - startMs;
  console.log(`[campaign-ticker] Tick done: ${processed} processed, ${errors} errors, ${durationMs}ms`);
}

export const sniperCampaignTickerWorker = new Worker(
  QUEUE,
  tick,
  {
    connection,
    concurrency: 1,
    limiter: { max: 1, duration: 5000 }
  }
);

// Register the repeatable job (idempotent — BullMQ deduplicates by repeat key)
sniperCampaignTickerQueue
  .add(
    'campaign_tick',
    {},
    {
      repeat: {
        every: 15 * 60 * 1000 // every 15 minutes
      },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 }
    }
  )
  .catch((err: any) => {
    console.error('[campaign-ticker] Failed to register repeatable job:', err?.message);
  });

sniperCampaignTickerWorker.on('failed', (job: any, err: any) => {
  console.error(`[campaign-ticker] Job ${job?.id} failed:`, err?.message);
});

sniperCampaignTickerWorker.on('completed', (job: any) => {
  console.log(`[campaign-ticker] Job ${job?.id} completed`);
});
