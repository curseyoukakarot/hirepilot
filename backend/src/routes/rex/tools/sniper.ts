import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexSniper = Router();
rexSniper.use(requireAuth as any);

function internalBase() {
  return process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
}

const AddTarget = z.object({
  url: z.string().url().optional(),
  post_url: z.string().url().optional(),
  limit: z.number().int().min(1).max(1000).optional()
}).refine((v) => Boolean(v.url || v.post_url), { message: 'url or post_url is required' });
rexSniper.post('/targets', async (req, res) => {
  const parsed = AddTarget.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const auth = String(req.headers.authorization || '');

    const postUrl = parsed.data.post_url || parsed.data.url;
    const resp = await fetch(`${internalBase()}/api/sniper/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify({ post_url: postUrl, auto_run: true, ...(parsed.data.limit ? { limit: parsed.data.limit } : {}) })
    } as any);
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(resp.status).json(body);
    const targetId = body?.target?.id || body?.id || null;
    const jobId = body?.queued_job_id || body?.queued_job?.id || null;
    return res.json({ ok: true, queued: true, target_id: targetId, job_id: jobId });
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'sniper_target_failed' }); }
});

const CaptureNow = z.object({ targetId: z.string().uuid() });
rexSniper.post('/capture-now', async (req, res) => {
  const parsed = CaptureNow.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const auth = String(req.headers.authorization || '');

    const resp = await fetch(`${internalBase()}/api/sniper/targets/${encodeURIComponent(parsed.data.targetId)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify({})
    } as any);
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(resp.status).json(body);
    return res.json({ ok: true, queued_capture: true, targetId: parsed.data.targetId, job_id: body?.job_id || null });
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'sniper_capture_failed' }); }
});

export default rexSniper;


