import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexMessaging = Router();
rexMessaging.use(requireAuth as any);

const BulkSchema = z.object({
  template_id: z.string(),
  lead_ids: z.array(z.string()).min(1),
  scheduled_at: z.string(),
  sender: z.any()
});

rexMessaging.post('/bulk-schedule', async (req, res) => {
  const parsed = BulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/messages/bulk-schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data)
    });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'bulk_schedule_failed' }); }
});

const MassSchema = z.object({ messages: z.array(z.any()).min(1) });
rexMessaging.post('/schedule-mass', async (req, res) => {
  const parsed = MassSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/scheduleMassMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data)
    });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'schedule_mass_failed' }); }
});

export default rexMessaging;


