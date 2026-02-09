import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sniperSupabaseDb } from '../services/sniperV1/supabase';
import { getJob, summarizeJobItems, updateJob, updateJobItem } from '../services/sniperV1/db';
import { canAttemptLinkedinConnect } from '../services/sniperV1/connectThrottle';
import { recordActionUsage } from '../services/sniperV1/throttle';
import { notifyConnectBulkSummary, notifyConnectResult } from '../services/sniperV1/connectNotifications';

const router = Router();

function requireSheetSecret(req: Request, res: Response): boolean {
  const expected = String(process.env.AIRTOP_SHEET_WEBHOOK_SECRET || '').trim();
  if (!expected) return true;
  const supplied = String(req.headers['x-api-key'] || '').trim();
  if (!supplied || supplied !== expected) {
    res.status(401).json({ error: 'invalid_api_key' });
    return false;
  }
  return true;
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

const payloadSchema = z.object({
  profile_url: z.string().url(),
  status: z.string().min(1),
  result_message: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  batch_run_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable()
});

router.post('/', async (req: Request, res: Response) => {
  if (!requireSheetSecret(req, res)) return;
  const parsed = payloadSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

  const { profile_url, status, result_message, updated_at, batch_run_id, task_id } = parsed.data;
  if (!task_id && !batch_run_id) {
    return res.status(400).json({ error: 'batch_run_id_or_task_id_required' });
  }

  try {
    let item: any = null;
    let jobId = batch_run_id ? String(batch_run_id) : null;
    if (task_id) {
      const { data } = await sniperSupabaseDb
        .from('sniper_job_items')
        .select('id, job_id, profile_url, result_json')
        .eq('id', task_id)
        .maybeSingle();
      item = data as any;
      jobId = item?.job_id ? String(item.job_id) : jobId;
    }

    if (!item && jobId) {
      const { data } = await sniperSupabaseDb
        .from('sniper_job_items')
        .select('id, job_id, profile_url, result_json')
        .eq('job_id', jobId)
        .eq('profile_url', profile_url)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      item = data as any;
    }

    if (!item || !jobId) {
      return res.status(404).json({ error: 'job_item_not_found' });
    }

    const job = await getJob(String(jobId));
    if (!job) return res.status(404).json({ error: 'job_not_found' });

    const normalized = normalizeStatus(status);
    const itemStatus =
      normalized.status === 'SENT' ? 'succeeded_verified' :
      normalized.status === 'ALREADY_CONNECTED' ? 'succeeded_noop_already_connected' :
      normalized.status === 'ALREADY_PENDING' ? 'succeeded_noop_already_pending' :
      normalized.status === 'AUTH_REQUIRED' ? 'paused_cooldown' :
      'failed';

    await updateJobItem(item.id, {
      status: itemStatus as any,
      result_json: {
        ...(item?.result_json || {}),
        status: normalized.status,
        result_message: result_message || null,
        updated_at: updated_at || null,
        finished_at: new Date().toISOString(),
        source: 'airtop_sheet'
      },
      error_code: normalized.status === 'AUTH_REQUIRED' ? 'auth_required' : null,
      error_message: normalized.ok ? null : (result_message || 'Airtop connect failed')
    } as any);

    if (normalized.status === 'AUTH_REQUIRED') {
      await updateJob(String(jobId), {
        status: 'paused_cooldown' as any,
        error_code: 'needs_reauth',
        error_message: 'LinkedIn auth required',
        next_run_at: null
      } as any);
    } else {
      try {
        const throttle = await canAttemptLinkedinConnect({ workspaceId: job.workspace_id, userId: job.created_by });
        await recordActionUsage({ userId: job.created_by, workspaceId: job.workspace_id, settings: throttle.settings, actionType: 'connect' });
      } catch (e: any) {
        console.warn('[airtop-sheet] failed to record usage', e?.message || e);
      }
    }

    if (normalized.ok) {
      try {
        await notifyConnectResult({
          userId: job.created_by,
          workspaceId: job.workspace_id,
          jobId: String(jobId),
          profileUrl: profile_url,
          finalStatus: normalized.status,
          message: result_message || null,
          note: item?.result_json?.note || job?.input_json?.note || null
        });
      } catch (e: any) {
        console.warn('[airtop-sheet] connect success notify failed (non-fatal):', e?.message || e);
      }
    }

    const summary = await summarizeJobItems(String(jobId));
    const finalStatus =
      summary.total === 0 ? 'failed' :
      (summary.failed > 0 && summary.success > 0) ? 'partially_succeeded' :
      (summary.failed > 0 && summary.success === 0) ? 'failed' :
      'succeeded';
    const allDone = summary.total > 0 && (summary.success + summary.failed + summary.skipped) >= summary.total;
    if (allDone) {
      await updateJob(String(jobId), {
        status: finalStatus as any,
        finished_at: new Date().toISOString()
      } as any);
      try {
        await notifyConnectBulkSummary(String(jobId), job.created_by, job.workspace_id);
      } catch (e: any) {
        console.warn('[airtop-sheet] bulk summary notify failed (non-fatal):', e?.message || e);
      }
    }

    return res.json({ ok: true, status: itemStatus });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_store_result' });
  }
});

export default router;
