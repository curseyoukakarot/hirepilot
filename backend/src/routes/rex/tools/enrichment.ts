import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexEnrichment = Router();
rexEnrichment.use(requireAuth as any);

const LeadSchema = z.object({ leadId: z.string() });
rexEnrichment.post('/lead', async (req, res) => {
  const parsed = LeadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/leads/${parsed.data.leadId}/enrich`, { method: 'POST', headers: { Authorization: req.headers.authorization as string } });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'lead_enrich_failed' }); }
});

const CandidateSchema = z.object({ candidateId: z.string() });
rexEnrichment.post('/candidate', async (req, res) => {
  const parsed = CandidateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/candidates/${parsed.data.candidateId}/enrich`, { method: 'POST', headers: { Authorization: req.headers.authorization as string } });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'candidate_enrich_failed' }); }
});

export default rexEnrichment;


