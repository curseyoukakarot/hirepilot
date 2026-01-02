import { Worker } from 'bullmq';
import dayjs from 'dayjs';
import { connection, sniperV1Queue } from '../queues/redis';
import { decrementConcurrency, incrementConcurrency } from '../lib/throttle';
import {
  getJob,
  getTarget,
  insertJobItems,
  listJobItems,
  summarizeJobItems,
  updateJob,
  updateJobItem
} from '../services/sniperV1/db';
import { fetchSniperV1Settings, countActionsSince, isWithinActiveHours } from '../services/sniperV1/settings';
import { getProvider } from '../services/sniperV1/providers';

const QUEUE = 'sniper:v1';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function isNeedsReauthError(err: any): boolean {
  const m = String(err?.message || err || '');
  return m.includes('needs_reauth') || m.includes('LINKEDIN_AUTH_REQUIRED') || m.includes('checkpoint');
}

async function nextRetryDelayMs(attempts: number): Promise<number> {
  // 10s, 30s, 2m
  const seq = [10_000, 30_000, 120_000];
  return seq[Math.max(0, Math.min(attempts, seq.length - 1))];
}

export const sniperV1Worker = new Worker(
  QUEUE,
  async (bullJob) => {
    const jobId = String((bullJob.data as any)?.jobId || '');
    if (!jobId) throw new Error('missing_jobId');

    const jobRow = await getJob(jobId);
    if (!jobRow) return { skipped: true, reason: 'job_not_found' };
    if (jobRow.status === 'canceled') return { skipped: true, reason: 'canceled' };

    const acquired = await incrementConcurrency(jobRow.workspace_id, 'linkedin', 1, 300);
    if (!acquired) {
      await sniperV1Queue.add('sniper_v1', { jobId }, { delay: 10_000 });
      return { requeued: true, reason: 'workspace_concurrency' };
    }

    const settings = await fetchSniperV1Settings(jobRow.workspace_id);
    const provider = getProvider(jobRow.provider || settings.provider_preference);

    // Guardrail: global active hours
    if (!isWithinActiveHours(new Date(), settings)) {
      await updateJob(jobId, { status: 'queued', error_code: 'outside_active_hours', error_message: 'Outside active hours window' } as any);
      await sniperV1Queue.add('sniper_v1', { jobId }, { delay: 15 * 60_000 });
      await decrementConcurrency(jobRow.workspace_id, 'linkedin');
      return { requeued: true, reason: 'active_hours' };
    }

    const attempts = Number(jobRow.attempts || 0) + 1;
    await updateJob(jobId, { status: 'running', attempts, started_at: new Date().toISOString(), error_code: null, error_message: null } as any);

    try {
      if (jobRow.job_type === 'prospect_post_engagers') {
        const postUrl = String(jobRow.input_json?.post_url || '');
        const targetId = jobRow.target_id;
        const target = targetId ? await getTarget(targetId) : null;
        const effectivePostUrl = postUrl || (target?.post_url || '');
        if (!effectivePostUrl) throw new Error('missing_post_url');
        const limit = clamp(Number(jobRow.input_json?.limit || 200), 1, 1000);

        const profiles = await provider.prospectPostEngagers({
          userId: jobRow.created_by,
          workspaceId: jobRow.workspace_id,
          postUrl: effectivePostUrl,
          limit
        });

        await insertJobItems(
          profiles.map((p) => ({
            job_id: jobId,
            workspace_id: jobRow.workspace_id,
            profile_url: p.profile_url,
            action_type: 'extract',
            status: 'success',
            result_json: { name: p.name || null, headline: p.headline || null }
          }))
        );

        await updateJob(jobId, { status: 'succeeded', finished_at: new Date().toISOString() } as any);
        return { ok: true, discovered: profiles.length };
      }

      if (jobRow.job_type === 'send_connect_requests') {
        const note = (jobRow.input_json?.note ?? null) as string | null;
        const items = await listJobItems(jobId, 5000);
        for (const it of items) {
          if (!['queued', 'running'].includes(it.status)) continue;

          // honor per-item scheduling
          if (it.scheduled_for) {
            const due = new Date(it.scheduled_for).getTime();
            if (Number.isFinite(due) && Date.now() < due) continue;
          }

          // Active-hours guardrail (re-check inside long jobs)
          if (!isWithinActiveHours(new Date(), settings)) {
            break;
          }

          // cap enforcement (hour/day)
          const hourSince = dayjs().subtract(1, 'hour').toISOString();
          const daySince = dayjs().startOf('day').toISOString();
          const usedHour = await countActionsSince(jobRow.workspace_id, hourSince);
          const usedDay = await countActionsSince(jobRow.workspace_id, daySince);
          if (usedHour >= settings.max_actions_per_hour || usedDay >= settings.max_actions_per_day) {
            // Reschedule remaining items
            const deferMinutes = usedHour >= settings.max_actions_per_hour ? 60 : 30;
            await updateJobItem(it.id, { status: 'queued', scheduled_for: dayjs().add(deferMinutes, 'minute').toISOString(), error_message: 'throttled: cap reached' } as any);
            continue;
          }

          await updateJobItem(it.id, { status: 'running', error_message: null } as any);
          try {
            const res = await provider.sendConnectionRequest({
              userId: jobRow.created_by,
              workspaceId: jobRow.workspace_id,
              profileUrl: it.profile_url,
              note
            });
            const status = res.status === 'sent' || res.status === 'pending' || res.status === 'already_connected' ? 'success' : (res.status === 'skipped' ? 'skipped' : 'failed');
            await updateJobItem(it.id, { status, result_json: res, error_message: status === 'failed' ? (res as any)?.details?.reason || null : null } as any);
          } catch (e: any) {
            await updateJobItem(it.id, { status: 'failed', error_message: String(e?.message || e) } as any);
          }

          const delaySec = clamp(
            settings.min_delay_seconds + Math.floor(Math.random() * (settings.max_delay_seconds - settings.min_delay_seconds + 1)),
            1,
            3600
          );
          await sleep(delaySec * 1000);
        }

        const summary = await summarizeJobItems(jobId);
        const finalStatus: any =
          summary.total === 0 ? 'failed' :
          (summary.failed > 0 && summary.success > 0) ? 'partially_succeeded' :
          (summary.failed > 0 && summary.success === 0) ? 'failed' :
          'succeeded';
        await updateJob(jobId, { status: finalStatus, finished_at: new Date().toISOString() } as any);
        return { ok: true, summary };
      }

      if (jobRow.job_type === 'send_messages') {
        const message = String(jobRow.input_json?.message || '').trim();
        if (!message) throw new Error('missing_message');
        const items = await listJobItems(jobId, 5000);
        for (const it of items) {
          if (!['queued', 'running'].includes(it.status)) continue;
          if (it.scheduled_for) {
            const due = new Date(it.scheduled_for).getTime();
            if (Number.isFinite(due) && Date.now() < due) continue;
          }
          if (!isWithinActiveHours(new Date(), settings)) break;

          const hourSince = dayjs().subtract(1, 'hour').toISOString();
          const daySince = dayjs().startOf('day').toISOString();
          const usedHour = await countActionsSince(jobRow.workspace_id, hourSince);
          const usedDay = await countActionsSince(jobRow.workspace_id, daySince);
          if (usedHour >= settings.max_actions_per_hour || usedDay >= settings.max_actions_per_day) {
            const deferMinutes = usedHour >= settings.max_actions_per_hour ? 60 : 30;
            await updateJobItem(it.id, { status: 'queued', scheduled_for: dayjs().add(deferMinutes, 'minute').toISOString(), error_message: 'throttled: cap reached' } as any);
            continue;
          }

          await updateJobItem(it.id, { status: 'running', error_message: null } as any);
          try {
            const res = await provider.sendMessage({
              userId: jobRow.created_by,
              workspaceId: jobRow.workspace_id,
              profileUrl: it.profile_url,
              message
            });
            const status = res.status === 'sent' ? 'success' : (res.status === 'not_1st_degree' || res.status === 'skipped' ? 'skipped' : 'failed');
            await updateJobItem(it.id, { status, result_json: res, error_message: status === 'failed' ? (res as any)?.details?.reason || null : null } as any);
          } catch (e: any) {
            await updateJobItem(it.id, { status: 'failed', error_message: String(e?.message || e) } as any);
          }

          const delaySec = clamp(
            settings.min_delay_seconds + Math.floor(Math.random() * (settings.max_delay_seconds - settings.min_delay_seconds + 1)),
            1,
            3600
          );
          await sleep(delaySec * 1000);
        }

        const summary = await summarizeJobItems(jobId);
        const finalStatus: any =
          summary.total === 0 ? 'failed' :
          (summary.failed > 0 && summary.success > 0) ? 'partially_succeeded' :
          (summary.failed > 0 && summary.success === 0) ? 'failed' :
          'succeeded';
        await updateJob(jobId, { status: finalStatus, finished_at: new Date().toISOString() } as any);
        return { ok: true, summary };
      }

      throw new Error(`unsupported_job_type:${jobRow.job_type}`);
    } catch (e: any) {
      if (isNeedsReauthError(e)) {
        await updateJob(jobId, { status: 'failed', error_code: 'needs_reauth', error_message: String(e?.message || e), finished_at: new Date().toISOString() } as any);
        return { ok: false, needs_reauth: true };
      }
      if (attempts < 3) {
        const delay = await nextRetryDelayMs(attempts - 1);
        await updateJob(jobId, { status: 'queued', error_code: 'retrying', error_message: String(e?.message || e) } as any);
        await sniperV1Queue.add('sniper_v1', { jobId }, { delay });
        return { requeued: true, delay };
      }
      await updateJob(jobId, { status: 'failed', error_code: 'failed', error_message: String(e?.message || e), finished_at: new Date().toISOString() } as any);
      throw e;
    } finally {
      await decrementConcurrency(jobRow.workspace_id, 'linkedin');
    }
  },
  { connection, concurrency: Number(process.env.SNIPER_V1_WORKER_CONCURRENCY || 3) }
);

if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log('✅ Sniper v1 worker online (queue: sniper:v1)');
}


