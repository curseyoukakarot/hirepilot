import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexNotifications = Router();
rexNotifications.use(requireAuth as any);

const CreateSchema = z.object({ title: z.string().optional(), body: z.string().optional(), type: z.string().optional() });
rexNotifications.post('/create', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/notifications`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data) });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'notification_failed' }); }
});

export default rexNotifications;


