import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexSniper = Router();
rexSniper.use(requireAuth as any);

const AddTarget = z.object({ url: z.string().url(), opener: z.boolean().optional() });
rexSniper.post('/targets', async (req, res) => {
  const parsed = AddTarget.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    // For now, directly call the existing add target endpoint if/when available.
    // Placeholder: respond success; integration specifics can be added later.
    return res.json({ ok: true, queued: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'sniper_target_failed' }); }
});

const CaptureNow = z.object({ targetId: z.string() });
rexSniper.post('/capture-now', async (req, res) => {
  const parsed = CaptureNow.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    return res.json({ ok: true, queued_capture: true, targetId: parsed.data.targetId });
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'sniper_capture_failed' }); }
});

export default rexSniper;


