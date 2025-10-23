import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';
import { createZapEvent, EVENT_TYPES } from '../../../lib/events';

export const rexOpportunity = Router();
rexOpportunity.use(requireAuth as any);

const SubmitSchema = z.object({
  opportunityId: z.string(),
  candidateId: z.string(),
  message: z.string().optional(),
});

rexOpportunity.post('/submit-to-client', async (req, res) => {
  const parsed = SubmitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  const { opportunityId, candidateId, message } = parsed.data;
  const userId = (req as any)?.user?.id as string;
  try {
    // Reuse existing submission path via HTTP to keep behavior identical
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const resp = await fetch(`${base}/api/opportunities/${opportunityId}/submit-to-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string },
      body: JSON.stringify({ submission: { candidate_id: candidateId, message } })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);

    await createZapEvent({
      event_type: EVENT_TYPES.opportunity_submitted,
      user_id: userId,
      entity: 'opportunity',
      entity_id: opportunityId,
      payload: { candidateId, message }
    });
    return res.json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'submit_failed' });
  }
});

const NoteSchema = z.object({ opportunityId: z.string(), text: z.string().min(1) });
rexOpportunity.post('/notes', async (req, res) => {
  const parsed = NoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  const { opportunityId, text } = parsed.data;
  const userId = (req as any)?.user?.id as string;
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const resp = await fetch(`${base}/api/opportunities/${opportunityId}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify({ text })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);
    await createZapEvent({ event_type: EVENT_TYPES.opportunity_note_added, user_id: userId, entity: 'opportunity', entity_id: opportunityId, payload: { text } });
    return res.json({ ok: true, data });
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'notes_failed' }); }
});

const CollabSchema = z.object({ opportunityId: z.string(), email: z.string().email(), role: z.string().optional() });
rexOpportunity.post('/collaborators', async (req, res) => {
  const parsed = CollabSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  const { opportunityId, email, role } = parsed.data;
  const userId = (req as any)?.user?.id as string;
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const resp = await fetch(`${base}/api/opportunities/${opportunityId}/collaborators`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify({ email, role })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);
    await createZapEvent({ event_type: EVENT_TYPES.opportunity_collaborator_added, user_id: userId, entity: 'opportunity', entity_id: opportunityId, payload: { email, role: role || 'collaborator' } });
    return res.json({ ok: true, data });
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'collab_failed' }); }
});

export default rexOpportunity;


