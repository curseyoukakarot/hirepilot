import { Router, Request, Response } from 'express';
import { sniperSupabaseDb } from '../services/sniperV1/supabase';
import { getJob, summarizeJobItems, updateJob, updateJobItem } from '../services/sniperV1/db';
import { safeOutputParse } from '../services/airtop/agentWebhooks';
import { canAttemptLinkedinConnect } from '../services/sniperV1/connectThrottle';
import { recordActionUsage } from '../services/sniperV1/throttle';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireBatchApiKey(req: Request, res: Response): string | null {
  const expected = String(process.env.AIRTOP_BATCH_API_KEY || '').trim();
  if (!expected) {
    res.status(503).json({ error: 'AIRTOP_BATCH_API_KEY missing' });
    return null;
  }
  const supplied = String(req.headers['x-api-key'] || '').trim();
  if (!supplied || supplied !== expected) {
    res.status(401).json({ error: 'invalid_api_key' });
    return null;
  }
  return supplied;
}

function normalizeStatus(raw: string): { ok: boolean; status: string } {
  const s = String(raw || '').toUpperCase();
  if (['SENT', 'ALREADY_PENDING', 'ALREADY_CONNECTED'].includes(s)) {
    return { ok: true, status: s };
  }
  if (s === 'AUTH_REQUIRED') {
    return { ok: false, status: s };
  }
  return { ok: false, status: s || 'FAILED' };
}

async function claimNextQueuedItem(jobId: string) {
  if (!UUID_RE.test(jobId)) return null;
  const sql = `
    with next_item as (
      select id
      from public.sniper_job_items
      where job_id = '${jobId}'
        and status = 'queued'
        and (scheduled_for is null or scheduled_for <= now())
      order by created_at asc
      for update skip locked
      limit 1
    )
    update public.sniper_job_items
    set status = 'running',
        result_json = coalesce(result_json, '{}'::jsonb) || jsonb_build_object('started_at', now())
    where id in (select id from next_item)
    returning *;
  `;
  const { data, error } = await sniperSupabaseDb.rpc('exec_sql', { sql } as any);
  if (error) throw error;
  if (Array.isArray(data) && data.length > 0) return data[0];
  return null;
}

router.get('/:batch_run_id/next', async (req: Request, res: Response) => {
  if (!requireBatchApiKey(req, res)) return;
  try {
    const batchRunId = String(req.params.batch_run_id || '');
    if (!UUID_RE.test(batchRunId)) return res.status(400).json({ error: 'invalid_batch_run_id' });

    const job = await getJob(batchRunId);
    if (!job) return res.status(404).json({ error: 'not_found' });

    if (job.error_code === 'needs_reauth') {
      return res.json({ has_work: false, cooldown_seconds: 3600, reason: 'auth_required' });
    }
    if (job.status === 'paused_cooldown' || job.status === 'paused_throttled') {
      const cooldownSeconds = job.next_run_at ? Math.max(1, Math.ceil((new Date(job.next_run_at).getTime() - Date.now()) / 1000)) : 60;
      return res.json({ has_work: false, cooldown_seconds: cooldownSeconds, reason: job.status });
    }
    if (['succeeded', 'failed', 'partially_succeeded', 'canceled'].includes(job.status)) {
      return res.json({ has_work: false });
    }

    const throttle = await canAttemptLinkedinConnect({ workspaceId: job.workspace_id, userId: job.created_by });
    if (!throttle.ok) {
      console.log('[airtop-batch] throttle block', { jobId: batchRunId, reason: throttle.reason, cooldownSeconds: throttle.cooldownSeconds });
      return res.json({ has_work: false, cooldown_seconds: throttle.cooldownSeconds, reason: throttle.reason });
    }

    const item = await claimNextQueuedItem(batchRunId);
    if (!item) {
      return res.json({ has_work: false });
    }

    const note = item?.result_json?.note || job?.input_json?.note || null;

    return res.json({
      has_work: true,
      task: {
        task_id: item.id,
        profile_url: item.profile_url,
        note,
        send_without_note_if_blocked: true,
        max_attempts: 3,
        dry_run: false,
        verification_mode: 'either',
        timeout_seconds: 180
      }
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_claim_task' });
  }
});

router.post('/:batch_run_id/result', async (req: Request, res: Response) => {
  if (!requireBatchApiKey(req, res)) return;
  try {
    const batchRunId = String(req.params.batch_run_id || '');
    if (!UUID_RE.test(batchRunId)) return res.status(400).json({ error: 'invalid_batch_run_id' });
    const { task_id, output, invocationId } = req.body || {};
    if (!task_id) return res.status(400).json({ error: 'task_id required' });

    const job = await getJob(batchRunId);
    if (!job) return res.status(404).json({ error: 'not_found' });

    const parsedOutput = safeOutputParse(output);
    const normalized = normalizeStatus(parsedOutput?.status);
    const itemStatus =
      normalized.status === 'SENT' ? 'succeeded_verified' :
      normalized.status === 'ALREADY_CONNECTED' ? 'succeeded_noop_already_connected' :
      normalized.status === 'ALREADY_PENDING' ? 'succeeded_noop_already_pending' :
      normalized.status === 'AUTH_REQUIRED' ? 'paused_cooldown' :
      'failed';

    await updateJobItem(task_id, {
      status: itemStatus as any,
      result_json: {
        ...(typeof parsedOutput === 'object' && parsedOutput ? parsedOutput : { output: parsedOutput }),
        invocationId: invocationId || null,
        finished_at: new Date().toISOString()
      },
      error_code: normalized.status === 'AUTH_REQUIRED' ? 'auth_required' : null,
      error_message: normalized.ok ? null : (parsedOutput?.error || parsedOutput?.message || 'Airtop connect failed')
    } as any);

    if (normalized.status !== 'AUTH_REQUIRED') {
      try {
        const throttle = await canAttemptLinkedinConnect({ workspaceId: job.workspace_id, userId: job.created_by });
        await recordActionUsage({ userId: job.created_by, workspaceId: job.workspace_id, settings: throttle.settings, actionType: 'connect' });
      } catch (e: any) {
        console.warn('[airtop-batch] failed to record usage', e?.message || e);
      }
    }

    if (normalized.status === 'AUTH_REQUIRED') {
      await updateJob(batchRunId, {
        status: 'paused_cooldown' as any,
        error_code: 'needs_reauth',
        error_message: 'LinkedIn auth required',
        next_run_at: null
      } as any);
      return res.json({ ok: true, status: 'auth_required' });
    }

    const summary = await summarizeJobItems(batchRunId);
    const finalStatus =
      summary.total === 0 ? 'failed' :
      (summary.failed > 0 && summary.success > 0) ? 'partially_succeeded' :
      (summary.failed > 0 && summary.success === 0) ? 'failed' :
      'succeeded';
    const allDone = summary.total > 0 && (summary.success + summary.failed + summary.skipped) >= summary.total;
    if (allDone) {
      await updateJob(batchRunId, {
        status: finalStatus as any,
        finished_at: new Date().toISOString()
      } as any);
    }

    return res.json({ ok: true, status: itemStatus });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_store_result' });
  }
});

export default router;
