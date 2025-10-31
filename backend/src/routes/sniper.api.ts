import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { Queue } from 'bullmq';
import { connection } from '../queues/redis';

const router = Router();
const sniperJobsQueue = new Queue('sniper:jobs', { connection });

function authUser(req: Request): string | null {
  const uid = (req as any)?.user?.id || req.headers['x-user-id'];
  if (!uid) return null;
  return Array.isArray(uid) ? uid[0] : String(uid);
}

// POST /api/sniper/trigger
router.post('/sniper/trigger', async (req: Request, res: Response) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const schema = z.object({
      accountId: z.string().min(3).nullable().optional(),
      userId: z.string().min(3),
      campaignId: z.string().min(3).optional(),
      sessionId: z.string().min(3),
      source: z.enum(['linkedin']).default('linkedin'),
      action: z.enum(['sourcing','view','invite','message']),
      query: z.string().min(3),
      sampleSize: z.number().int().min(1).max(10000).default(50)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    if (parsed.data.userId !== userId) return res.status(403).json({ error: 'forbidden' });

    // RBAC: user must own the session (team-admin support can be added later)
    const { data: rs, error: rsErr } = await supabase
      .from('remote_sessions')
      .select('id,user_id,account_id')
      .eq('id', parsed.data.sessionId)
      .maybeSingle();
    if (rsErr) throw rsErr;
    if (!rs || rs.user_id !== userId) return res.status(403).json({ error: 'not_allowed_for_session' });

    // TODO: compute resolvedSettings (campaign override → team → account)
    const resolvedSettings = { placeholder: true };

    // Persist activity log in sniper_jobs
    const insert = {
      account_id: parsed.data.accountId || rs.account_id || null,
      user_id: userId,
      campaign_id: parsed.data.campaignId || null,
      session_id: parsed.data.sessionId,
      source: parsed.data.source,
      action: parsed.data.action,
      payload: { query: parsed.data.query, sampleSize: parsed.data.sampleSize, resolvedSettings },
      status: 'queued'
    } as any;
    const { data: jobRow, error: jobErr } = await supabase
      .from('sniper_jobs')
      .insert(insert)
      .select('id')
      .single();
    if (jobErr) throw jobErr;

    const activityLogId = jobRow.id as string;
    // Enqueue to BullMQ
    const job = await sniperJobsQueue.add('sniper_job', {
      activityLogId,
      sessionId: parsed.data.sessionId,
      source: parsed.data.source,
      action: parsed.data.action,
      query: parsed.data.query,
      resolvedSettings
    });

    return res.json({ queued: true, jobId: job.id, activityLogId });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue' });
  }
});

// GET /api/sniper/activity
router.get('/sniper/activity', async (req: Request, res: Response) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const q = supabase
      .from('sniper_jobs')
      .select('id,account_id,user_id,campaign_id,session_id,source,action,status,payload,created_at,updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    const { data, error } = sessionId ? await q.eq('session_id', sessionId) : await q;
    if (error) throw error;
    return res.json({ activities: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list' });
  }
});

// POST /api/sniper/test (dry-run)
router.post('/sniper/test', async (req: Request, res: Response) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const schema = z.object({
      accountId: z.string().optional(),
      userId: z.string().min(3),
      sessionId: z.string().optional(),
      source: z.enum(['linkedin']).default('linkedin').optional(),
      action: z.enum(['sourcing','view','invite','message']).default('sourcing').optional(),
      sampleSize: z.number().int().min(1).max(10000).default(50)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    if (parsed.data.userId !== userId) return res.status(403).json({ error: 'forbidden' });

    // Very basic estimation: clamp by a notional daily cap from settings placeholder
    const dailyCap = 100; // replace with computed resolved settings
    const expectedDailyTotal = Math.min(dailyCap, parsed.data.sampleSize);
    return res.json({ expectedDailyTotal, notes: 'Estimated with placeholder limits' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_compute' });
  }
});

export default router;


