import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexCRM = Router();
rexCRM.use(requireAuth as any);

const CreateClient = z.object({ name: z.string(), domain: z.string().optional() });
rexCRM.post('/client', async (req, res) => {
  const parsed = CreateClient.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data) });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'client_create_failed' }); }
});

const UpdateClient = z.object({ id: z.string(), update: z.record(z.any()) });
rexCRM.post('/client/update', async (req, res) => {
  const parsed = UpdateClient.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/clients/${parsed.data.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data.update) });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'client_update_failed' }); }
});

const EnrichClient = z.object({ id: z.string() });
rexCRM.post('/client/enrich', async (req, res) => {
  const parsed = EnrichClient.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/clients/${parsed.data.id}/sync-enrichment`, { method: 'POST', headers: { Authorization: req.headers.authorization as string } });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'client_enrich_failed' }); }
});

const CreateContact = z.object({ client_id: z.string(), name: z.string().optional(), email: z.string().email(), title: z.string().optional() });
rexCRM.post('/contact', async (req, res) => {
  const parsed = CreateContact.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data) });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'contact_create_failed' }); }
});

export default rexCRM;


