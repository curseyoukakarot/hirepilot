import express, { Request, Response } from 'express';
import { z } from 'zod';
import { verifyZapier } from '../middleware/verifyZapier';
import { supabase } from '../lib/supabase';

const router = express.Router();

async function ensureIdempotent(key: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('webhook_idem')
    .insert({ idem_key: key })
    .select('idem_key')
    .maybeSingle();
  if (error && (error as any).code === '23505') return false; // duplicate
  if (error) throw error;
  return !!data?.idem_key;
}

// moveOpportunityStage
const moveStageSchema = z.object({ idempotency_key: z.string(), opportunityId: z.string().uuid(), stageId: z.string().uuid() });
router.post('/actions/moveOpportunityStage', verifyZapier, async (req: Request, res: Response) => {
  const parse = moveStageSchema.safeParse(req.body || {});
  if (!parse.success) { res.status(400).json({ error: 'invalid_payload', details: parse.error.flatten() }); return; }
  const { idempotency_key, opportunityId, stageId } = parse.data;
  if (!(await ensureIdempotent(idempotency_key))) { res.json({ deduped: true }); return; }
  const { error } = await supabase.from('opportunities').update({ stage: stageId, updated_at: new Date().toISOString() as any }).eq('id', opportunityId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// updateDeal (patch arbitrary columns on opportunities)
const updateDealSchema = z.object({ idempotency_key: z.string(), dealId: z.string().uuid(), patch: z.record(z.any()) });
router.post('/actions/updateDeal', verifyZapier, async (req: Request, res: Response) => {
  const parse = updateDealSchema.safeParse(req.body || {});
  if (!parse.success) { res.status(400).json({ error: 'invalid_payload', details: parse.error.flatten() }); return; }
  const { idempotency_key, dealId, patch } = parse.data;
  if (!(await ensureIdempotent(idempotency_key))) { res.json({ deduped: true }); return; }
  const { data, error } = await supabase.from('opportunities').update({ ...patch, updated_at: new Date().toISOString() as any }).eq('id', dealId).select('id').maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true, id: data?.id });
});

// addOrUpdateNote for lead/candidate/decision_maker/opportunity
const addOrUpdateNoteSchema = z.object({
  idempotency_key: z.string(),
  entityType: z.enum(['lead','candidate','decision_maker','opportunity']),
  entityId: z.string().uuid(),
  noteId: z.string().uuid().optional(),
  body: z.string(),
  title: z.string().optional()
});
router.post('/actions/addOrUpdateNote', verifyZapier, async (req: Request, res: Response) => {
  const parse = addOrUpdateNoteSchema.safeParse(req.body || {});
  if (!parse.success) { res.status(400).json({ error: 'invalid_payload', details: parse.error.flatten() }); return; }
  const { idempotency_key, entityType, entityId, noteId, body, title } = parse.data;
  if (!(await ensureIdempotent(idempotency_key))) { res.json({ deduped: true }); return; }

  // Route to appropriate notes table
  const tableMap: Record<string, string> = {
    lead: 'lead_notes',
    candidate: 'candidate_notes',
    decision_maker: 'contact_notes',
    opportunity: 'opportunity_notes'
  };
  const table = tableMap[entityType];
  if (!table) { res.status(400).json({ error: 'unsupported_entity' }); return; }

  if (noteId) {
    const { data, error } = await supabase.from(table).update({ note_text: body, title: title || null, updated_at: new Date().toISOString() }).eq('id', noteId).select('id').maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, id: data?.id, updated: true });
  } else {
    const col = entityType === 'lead' ? 'lead_id' : (entityType === 'candidate' ? 'candidate_id' : (entityType === 'opportunity' ? 'opportunity_id' : 'contact_id'));
    const { data, error } = await supabase.from(table).insert({ [col]: entityId, note_text: body, title: title || null }).select('id').maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, id: data?.id, created: true });
  }
});

// sendInvoice (skeleton)
const sendInvoiceSchema = z.object({ idempotency_key: z.string(), clientId: z.string().uuid(), amount: z.number().positive(), currency: z.string().default('usd'), memo: z.string().optional() });
router.post('/actions/sendInvoice', verifyZapier, async (req: Request, res: Response) => {
  const parse = sendInvoiceSchema.safeParse(req.body || {});
  if (!parse.success) { res.status(400).json({ error: 'invalid_payload', details: parse.error.flatten() }); return; }
  const { idempotency_key, clientId, amount, currency, memo } = parse.data;
  if (!(await ensureIdempotent(idempotency_key))) { res.json({ deduped: true }); return; }

  // Minimal DB insert to invoices table; integration with Stripe handled elsewhere
  const { data, error } = await supabase
    .from('invoices')
    .insert({ client_id: clientId, amount, status: 'unbilled', notes: memo || null, created_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true, invoiceId: data.id });
});

export default router;


