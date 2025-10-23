import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexTeam = Router();
rexTeam.use(requireAuth as any);

const InviteSchema = z.object({ email: z.string().email(), role: z.string().optional() });
rexTeam.post('/invite', async (req, res) => {
  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/team/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data) });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'invite_failed' }); }
});

const RoleSchema = z.object({ memberId: z.string(), role: z.string() });
rexTeam.post('/role', async (req, res) => {
  const parsed = RoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/team/member/${parsed.data.memberId}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify({ role: parsed.data.role }) });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'role_update_failed' }); }
});

export default rexTeam;


