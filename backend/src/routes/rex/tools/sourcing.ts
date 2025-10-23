import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexSourcing = Router();
rexSourcing.use(requireAuth as any);

const RelaunchSchema = z.object({ campaignId: z.string() });
rexSourcing.post('/relaunch', async (req, res) => {
  const parsed = RelaunchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/sourcing/campaigns/${parsed.data.campaignId}/relaunch`, { method: 'POST', headers: { Authorization: req.headers.authorization as string } });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'relaunch_failed' }); }
});

const ScheduleSchema = z.object({ campaignId: z.string() });
rexSourcing.post('/schedule', async (req, res) => {
  const parsed = ScheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/sourcing/campaigns/${parsed.data.campaignId}/schedule`, { method: 'POST', headers: { Authorization: req.headers.authorization as string } });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'schedule_failed' }); }
});

const StatsSchema = z.object({ campaignId: z.string(), emit: z.boolean().optional() });
rexSourcing.post('/stats', async (req, res) => {
  const parsed = StatsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/sourcing/campaigns/${parsed.data.campaignId}/stats?emit=${parsed.data.emit ? 'true' : 'false'}`, { headers: { Authorization: req.headers.authorization as string } });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'stats_failed' }); }
});

export default rexSourcing;


