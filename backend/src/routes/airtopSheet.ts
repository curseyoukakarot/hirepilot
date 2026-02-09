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
  const supplied = String(req.headers['x-airtop-secret'] || '').trim();
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

const statusSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  z.enum([
    'SENT',
    'ALREADY_PENDING',
    'ALREADY_CONNECTED',
    'FAILED',
    'AUTH_REQUIRED',
    'RESTRICTED',
    'NOTE_BLOCKED'
  ])
);

const payloadSchema = z.object({
  profile_url: z.string().url(),
  status: statusSchema,
  result_message: z.string().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  batch_run_id: z.string().uuid(),
  task_id: z.string().uuid()
});

router.get('/ping', (_req: Request, res: Response) => {
  return res.json({ ok: true });
});

router.post('/', async (req: Request, res: Response) => {
  if (!requireSheetSecret(req, res)) return;
  const parsed = payloadSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

  const { profile_url, status, result_message, updated_at, batch_run_id, task_id } = parsed.data;
  console.log('[airtop-sheet] incoming', {
    source: 'zapier',
    task_id,
    batch_run_id,
    profile_url,
    status
  });

  try {
    const { data: item } = await sniperSupabaseDb
      .from('sniper_job_items')
      .select('id, job_id, profile_url, result_json, status, error_message')
      .eq('id', task_id)
      .eq('job_id', batch_run_id)
      .maybeSingle();

    if (!item) {
      console.log('[airtop-sheet] not_found', { task_id, batch_run_id });
      return res.status(202).json({ ok: false, reason: 'not_found' });
    }

    const itemAny: any = item;
    const prevStatus = String(itemAny?.status || '');
    const prevResultMessage = String(itemAny?.result_json?.result_message || '');
    if (prevStatus === status && prevResultMessage === String(result_message || '')) {
      return res.json({ ok: true, dedup: true });
    }

    const job = await getJob(String(batch_run_id));
    if (!job) return res.status(404).json({ error: 'job_not_found' });

    const normalized = normalizeStatus(status);
    const itemStatus =
      normalized.status === 'SENT' ? 'succeeded_verified' :
      normalized.status === 'ALREADY_CONNECTED' ? 'succeeded_noop_already_connected' :
      normalized.status === 'ALREADY_PENDING' ? 'succeeded_noop_already_pending' :
      normalized.status === 'AUTH_REQUIRED' ? 'paused_cooldown' :
      'failed';

    const errorCode =
      normalized.status === 'AUTH_REQUIRED'
        ? 'auth_required'
        : normalized.ok
          ? null
          : String(normalized.status || 'failed').toLowerCase();

    await updateJobItem(item.id, {
      status: itemStatus as any,
      result_json: {
        ...(itemAny?.result_json || {}),
        status: normalized.status,
        result_message: result_message || null,
        updated_at: updated_at || null,
        finished_at: new Date().toISOString(),
        source: 'airtop_sheet'
      },
      error_code: errorCode,
      error_message: normalized.ok ? null : (result_message || 'Airtop connect failed')
    } as any);

    if (normalized.status === 'AUTH_REQUIRED') {
      await updateJob(String(batch_run_id), {
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
          jobId: String(batch_run_id),
          profileUrl: profile_url,
          finalStatus: normalized.status,
          message: result_message || null,
          note: itemAny?.result_json?.note || job?.input_json?.note || null
        });
      } catch (e: any) {
        console.warn('[airtop-sheet] connect success notify failed (non-fatal):', e?.message || e);
      }
    }

    const summary = await summarizeJobItems(String(batch_run_id));
    const finalStatus =
      summary.total === 0 ? 'failed' :
      (summary.failed > 0 && summary.success > 0) ? 'partially_succeeded' :
      (summary.failed > 0 && summary.success === 0) ? 'failed' :
      'succeeded';
    const allDone = summary.total > 0 && (summary.success + summary.failed + summary.skipped) >= summary.total;
    if (allDone) {
      await updateJob(String(batch_run_id), {
        status: finalStatus as any,
        finished_at: new Date().toISOString()
      } as any);
      try {
        await notifyConnectBulkSummary(String(batch_run_id), job.created_by, job.workspace_id);
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
