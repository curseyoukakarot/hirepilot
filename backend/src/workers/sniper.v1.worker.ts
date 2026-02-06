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
import { applyCooldown, getUsageSnapshot, isCooldownActive, recordActionUsage } from '../services/sniperV1/throttle';
import { getProvider } from '../services/sniperV1/providers';
import { notifySniperJobFinished } from '../services/sniperV1/notifications';

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

function nextThrottleRunAt(): string {
  return dayjs().add(24, 'hour').toISOString();
}

function isConnectCapExceeded(usage: any, settings: any): boolean {
  return usage.user_connects >= settings.max_connects_per_day ||
    usage.workspace_connects >= settings.max_workspace_connects_per_day ||
    usage.user_profiles >= settings.max_page_interactions_per_day ||
    usage.workspace_profiles >= settings.max_workspace_page_interactions_per_day;
}

function isMessageCapExceeded(usage: any, settings: any): boolean {
  return usage.user_messages >= settings.max_messages_per_day ||
    usage.workspace_messages >= settings.max_workspace_messages_per_day ||
    usage.user_profiles >= settings.max_page_interactions_per_day ||
    usage.workspace_profiles >= settings.max_workspace_page_interactions_per_day;
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
    if (!settings.cloud_engine_enabled) {
      await updateJob(jobId, {
        status: 'failed',
        error_code: 'cloud_engine_disabled',
        error_message: 'Cloud Engine is disabled. Use Chrome Extension.',
        finished_at: new Date().toISOString()
      } as any);
      await decrementConcurrency(jobRow.workspace_id, 'linkedin');
      return { skipped: true, reason: 'cloud_engine_disabled' };
    }
    // Cloud Engine ON means: Airtop only. No local_playwright fallback.
    const provider = getProvider('airtop');

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
        try {
          await recordActionUsage({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings, actionType: 'job_page' });
        } catch {}

        await insertJobItems(
          profiles.map((p) => ({
            job_id: jobId,
            workspace_id: jobRow.workspace_id,
            profile_url: p.profile_url,
            action_type: 'extract',
            status: 'succeeded_verified',
            result_json: { name: p.name || null, headline: p.headline || null }
          }))
        );

        await updateJob(jobId, { status: 'succeeded', finished_at: new Date().toISOString() } as any);
        try { await notifySniperJobFinished(jobId); } catch {}
        return { ok: true, discovered: profiles.length };
      }

      if (jobRow.job_type === 'people_search') {
        const searchUrl = String(jobRow.input_json?.search_url || jobRow.input_json?.url || '').trim();
        if (!searchUrl) throw new Error('missing_search_url');
        const limit = clamp(Number(jobRow.input_json?.limit || 200), 1, 2000);

        const profiles = await provider.prospectPeopleSearch({
          userId: jobRow.created_by,
          workspaceId: jobRow.workspace_id,
          searchUrl,
          limit
        });
        try {
          await recordActionUsage({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings, actionType: 'job_page' });
        } catch {}

        await insertJobItems(
          profiles.map((p) => ({
            job_id: jobId,
            workspace_id: jobRow.workspace_id,
            profile_url: p.profile_url,
            action_type: 'extract',
            status: 'succeeded_verified',
            result_json: { name: p.name || null, headline: p.headline || null, source: 'people_search', search_url: searchUrl }
          }))
        );

        await updateJob(jobId, { status: 'succeeded', finished_at: new Date().toISOString() } as any);
        try { await notifySniperJobFinished(jobId); } catch {}
        return { ok: true, extracted: profiles.length };
      }

      if (jobRow.job_type === 'jobs_intent') {
        const searchUrl = String(jobRow.input_json?.search_url || jobRow.input_json?.url || '').trim();
        if (!searchUrl) throw new Error('missing_search_url');
        const limit = clamp(Number(jobRow.input_json?.limit || 100), 1, 2000);

        const jobs = await provider.prospectJobsIntent({
          userId: jobRow.created_by,
          workspaceId: jobRow.workspace_id,
          searchUrl,
          limit
        });
        try {
          await recordActionUsage({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings, actionType: 'job_page' });
        } catch {}

        await insertJobItems(
          jobs.map((j) => ({
            job_id: jobId,
            workspace_id: jobRow.workspace_id,
            // job_url stored in profile_url for now; results view will interpret by job_type
            profile_url: String(j.job_url || ''),
            action_type: 'extract',
            status: 'succeeded_verified',
            result_json: {
              source: 'jobs_intent',
              search_url: searchUrl,
              title: j.title || null,
              company: j.company || null,
              company_url: j.company_url || null,
              location: j.location || null
            }
          }))
        );

        await updateJob(jobId, { status: 'succeeded', finished_at: new Date().toISOString() } as any);
        try { await notifySniperJobFinished(jobId); } catch {}
        return { ok: true, extracted: jobs.length };
      }

      if (jobRow.job_type === 'send_connect_requests') {
        const note = (jobRow.input_json?.note ?? null) as string | null;
        const debug = { jobId, enabled: Boolean(jobRow.input_json?.debug) };
        const items = await listJobItems(jobId, 5000);
        let paused = false;
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

          // cap enforcement (per-user + per-workspace + hourly guardrail)
          const hourSince = dayjs().subtract(1, 'hour').toISOString();
          const daySince = dayjs().startOf('day').toISOString();
          const usedHour = await countActionsSince(jobRow.workspace_id, hourSince);
          const usedDay = await countActionsSince(jobRow.workspace_id, daySince);
          if (usedHour >= settings.max_actions_per_hour || usedDay >= settings.max_actions_per_day) {
            const deferMinutes = usedHour >= settings.max_actions_per_hour ? 60 : 30;
            await updateJobItem(it.id, { status: 'queued', scheduled_for: dayjs().add(deferMinutes, 'minute').toISOString(), error_message: 'throttled: cap reached' } as any);
            continue;
          }

          const usage = await getUsageSnapshot({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings });
          if (isCooldownActive(usage.cooldown_until)) {
            const nextRun = usage.cooldown_until || nextThrottleRunAt();
            await updateJob(jobId, {
              status: 'paused_cooldown',
              next_run_at: nextRun,
              error_code: 'cooldown_active',
              error_message: `Cooldown active until ${nextRun}`
            } as any);
            await updateJobItem(it.id, { status: 'queued', scheduled_for: nextRun, error_message: 'cooldown_active' } as any);
            await sniperV1Queue.add('sniper_v1', { jobId }, { delay: Math.max(60_000, new Date(nextRun).getTime() - Date.now()) });
            paused = true;
            break;
          }
          if (isConnectCapExceeded(usage, settings)) {
            const nextRun = nextThrottleRunAt();
            await updateJob(jobId, {
              status: 'paused_throttled',
              next_run_at: nextRun,
              error_code: 'throttled_daily_limit',
              error_message: 'Daily cap reached'
            } as any);
            await updateJobItem(it.id, { status: 'queued', scheduled_for: nextRun, error_message: 'throttled: cap reached' } as any);
            await sniperV1Queue.add('sniper_v1', { jobId }, { delay: 24 * 60 * 60_000 });
            paused = true;
            break;
          }

          await updateJobItem(it.id, { status: 'running', error_message: null } as any);
          try {
            const itemNote = (it.result_json && typeof it.result_json === 'object' ? (it.result_json as any).note : null) as string | null;
            const effectiveNote = (itemNote ?? note) || null;
            const res = await provider.sendConnectionRequest({
              userId: jobRow.created_by,
              workspaceId: jobRow.workspace_id,
              profileUrl: it.profile_url,
              note: effectiveNote,
              debug
            });
            try {
              if (res.status === 'sent_verified') {
                await recordActionUsage({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings, actionType: 'connect' });
              } else {
                await recordActionUsage({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings, actionType: 'profile_visit' });
              }
            } catch {}

            if (res.details?.block_reason) {
              const cooldownUntil = dayjs().add(settings.cooldown_minutes, 'minute').toISOString();
              await applyCooldown({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings, cooldownUntil });
            }

            const status =
              res.status === 'sent_verified' ? 'succeeded_verified' :
              res.status === 'already_connected' ? 'succeeded_noop_already_connected' :
              res.status === 'already_pending' ? 'succeeded_noop_already_pending' :
              res.status === 'restricted' ? 'failed_restricted' :
              res.status === 'failed_verification' ? 'failed_verification' :
              (res.status === 'skipped' ? 'skipped' : 'failed');
            await updateJobItem(it.id, {
              status,
              result_json: { ...res, note_used: effectiveNote },
              error_message: String((res as any)?.details?.reason || (res as any)?.details?.error || '') || null,
              error_code: (res as any)?.details?.error_code || null,
              last_step: (res as any)?.details?.last_step || null,
              strategy_used: (res as any)?.details?.strategyUsed || null,
              screenshot_path: (res as any)?.details?.screenshot || null
            } as any);

            if (res.details?.block_reason) {
              const nextRun = dayjs().add(settings.cooldown_minutes, 'minute').toISOString();
              await updateJob(jobId, {
                status: 'paused_cooldown',
                next_run_at: nextRun,
                error_code: 'cooldown_blocked',
                error_message: `LinkedIn block detected (${res.details.block_reason})`
              } as any);
              await updateJobItem(it.id, { status, error_message: `LinkedIn block detected (${res.details.block_reason})` } as any);
              await sniperV1Queue.add('sniper_v1', { jobId }, { delay: Math.max(60_000, new Date(nextRun).getTime() - Date.now()) });
              paused = true;
              break;
            }
          } catch (e: any) {
            await updateJobItem(it.id, { status: 'failed', error_message: String(e?.message || e) } as any);
          }

          // Safety: enforce a minimum delay for connect requests to avoid LinkedIn rate limits.
          const minDelay = Math.max(settings.min_delay_seconds, 60);
          const maxDelay = Math.max(settings.max_delay_seconds, minDelay);
          const delaySec = clamp(
            minDelay + Math.floor(Math.random() * (maxDelay - minDelay + 1)),
            1,
            3600
          );
          await sleep(delaySec * 1000);
        }

        if (paused) {
          return { ok: true, paused: true };
        }

        const summary = await summarizeJobItems(jobId);
        const finalStatus: any =
          summary.total === 0 ? 'failed' :
          (summary.failed > 0 && summary.success > 0) ? 'partially_succeeded' :
          (summary.failed > 0 && summary.success === 0) ? 'failed' :
          'succeeded';
        await updateJob(jobId, { status: finalStatus, finished_at: new Date().toISOString() } as any);
        try { await notifySniperJobFinished(jobId); } catch {}
        return { ok: true, summary };
      }

      if (jobRow.job_type === 'send_messages') {
        const message = String(jobRow.input_json?.message || '').trim();
        if (!message) throw new Error('missing_message');
        const items = await listJobItems(jobId, 5000);
        const debug = { jobId, enabled: Boolean(jobRow.input_json?.debug) };
        let paused = false;
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

          const usage = await getUsageSnapshot({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings });
          if (isCooldownActive(usage.cooldown_until)) {
            const nextRun = usage.cooldown_until || nextThrottleRunAt();
            await updateJob(jobId, {
              status: 'paused_cooldown',
              next_run_at: nextRun,
              error_code: 'cooldown_active',
              error_message: `Cooldown active until ${nextRun}`
            } as any);
            await updateJobItem(it.id, { status: 'queued', scheduled_for: nextRun, error_message: 'cooldown_active' } as any);
            await sniperV1Queue.add('sniper_v1', { jobId }, { delay: Math.max(60_000, new Date(nextRun).getTime() - Date.now()) });
            paused = true;
            break;
          }
          if (isMessageCapExceeded(usage, settings)) {
            const nextRun = nextThrottleRunAt();
            await updateJob(jobId, {
              status: 'paused_throttled',
              next_run_at: nextRun,
              error_code: 'throttled_daily_limit',
              error_message: 'Daily cap reached'
            } as any);
            await updateJobItem(it.id, { status: 'queued', scheduled_for: nextRun, error_message: 'throttled: cap reached' } as any);
            await sniperV1Queue.add('sniper_v1', { jobId }, { delay: 24 * 60 * 60_000 });
            paused = true;
            break;
          }

          await updateJobItem(it.id, { status: 'running', error_message: null } as any);
          try {
            const res = await provider.sendMessage({
              userId: jobRow.created_by,
              workspaceId: jobRow.workspace_id,
              profileUrl: it.profile_url,
              message,
              debug
            });
            try {
              if (res.status === 'sent_verified') {
                await recordActionUsage({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings, actionType: 'message' });
              } else {
                await recordActionUsage({ userId: jobRow.created_by, workspaceId: jobRow.workspace_id, settings, actionType: 'profile_visit' });
              }
            } catch {}

            const status =
              res.status === 'sent_verified' ? 'succeeded_verified' :
              res.status === 'not_1st_degree' ? 'skipped' :
              res.status === 'failed_verification' ? 'failed_verification' :
              (res.status === 'skipped' ? 'skipped' : 'failed');
            await updateJobItem(it.id, {
              status,
              result_json: res,
              error_message: status === 'failed' ? (res as any)?.details?.reason || null : null,
              error_code: (res as any)?.details?.error_code || null,
              last_step: (res as any)?.details?.last_step || null,
              strategy_used: (res as any)?.details?.strategyUsed || null,
              screenshot_path: (res as any)?.details?.screenshot || null
            } as any);
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

        if (paused) {
          return { ok: true, paused: true };
        }

        const summary = await summarizeJobItems(jobId);
        const finalStatus: any =
          summary.total === 0 ? 'failed' :
          (summary.failed > 0 && summary.success > 0) ? 'partially_succeeded' :
          (summary.failed > 0 && summary.success === 0) ? 'failed' :
          'succeeded';
        await updateJob(jobId, { status: finalStatus, finished_at: new Date().toISOString() } as any);
        try { await notifySniperJobFinished(jobId); } catch {}
        return { ok: true, summary };
      }

      throw new Error(`unsupported_job_type:${jobRow.job_type}`);
    } catch (e: any) {
      if (isNeedsReauthError(e)) {
        await updateJob(jobId, { status: 'failed', error_code: 'needs_reauth', error_message: String(e?.message || e), finished_at: new Date().toISOString() } as any);
        try { await notifySniperJobFinished(jobId); } catch {}
        return { ok: false, needs_reauth: true };
      }
      if (attempts < 3) {
        const delay = await nextRetryDelayMs(attempts - 1);
        await updateJob(jobId, { status: 'queued', error_code: 'retrying', error_message: String(e?.message || e) } as any);
        await sniperV1Queue.add('sniper_v1', { jobId }, { delay });
        return { requeued: true, delay };
      }
      await updateJob(jobId, { status: 'failed', error_code: 'failed', error_message: String(e?.message || e), finished_at: new Date().toISOString() } as any);
      try { await notifySniperJobFinished(jobId); } catch {}
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


