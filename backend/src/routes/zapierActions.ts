import express, { Request, Response } from 'express';
import { z } from 'zod';
import { verifyZapier } from '../middleware/verifyZapier';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { createZapEvent, EVENT_TYPES } from '../lib/events';
import crypto from 'crypto';

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
  logger.info({ route: '/api/zapier/actions/moveOpportunityStage', action: 'update', ok: true, opportunityId });
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
  logger.info({ route: '/api/zapier/actions/updateDeal', action: 'update', ok: true, id: data?.id });
  res.json({ ok: true, id: data?.id });
});

// createOpportunity (external)
const createOpportunitySchema = z.object({
  idempotency_key: z.string(),
  userId: z.string().uuid(),
  title: z.string(),
  clientId: z.string().uuid().optional(),
  value: z.number().optional(),
  billingType: z.string().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  tag: z.string().optional()
});
router.post('/actions/createOpportunity', verifyZapier, async (req: Request, res: Response) => {
  const parse = createOpportunitySchema.safeParse(req.body || {});
  if (!parse.success) { res.status(400).json({ error: 'invalid_payload', details: parse.error.flatten() }); return; }
  const { idempotency_key, userId, title, clientId, value, billingType, stage, status, tag } = parse.data;
  if (!(await ensureIdempotent(idempotency_key))) { res.json({ deduped: true }); return; }
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      title,
      client_id: clientId ?? null,
      value: value ?? null,
      billing_type: billingType ?? null,
      stage: stage ?? null,
      status: status ?? 'open',
      tag: tag ?? null,
      owner_id: userId,
      created_at: nowIso,
      updated_at: nowIso as any
    })
    .select('id')
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  logger.info({ route: '/api/zapier/actions/createOpportunity', action: 'create', ok: true, id: data?.id, owner_id: userId });
  res.json({ ok: true, id: data?.id });
});

// updateOpportunityStatusTag (external) — update stage/status/tag and emit workflow event when applicable
const updateOpportunityStatusTagSchema = z.object({
  idempotency_key: z.string(),
  userId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  stage: z.string().optional(),
  status: z.string().optional(),
  tag: z.string().optional()
});
router.post('/actions/updateOpportunityStatusTag', async (req: Request, res: Response) => {
  // Allow dev or valid API key to bypass signature; otherwise verify HMAC
  try {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const env = process.env.NODE_ENV;
    let skipVerification = false;

    if (env === 'development') {
      skipVerification = true;
      console.log('[Zapier] Skipping signature verification (development mode)');
    } else if (apiKey) {
      const { data: apiKeyRow } = await supabase
        .from('api_keys')
        .select('id')
        .eq('key', apiKey)
        .maybeSingle();
      if (apiKeyRow) {
        skipVerification = true;
        console.log('[Zapier] Skipping signature verification (valid API key)');
      }
    }

    if (!skipVerification) {
      const secret = process.env.ZAPIER_HMAC_SECRET;
      if (!secret) { res.status(500).json({ error: 'Zapier secret not configured' }); return; }

      const signature = String(req.headers['x-hp-signature'] || '');
      const timestamp = String(req.headers['x-hp-timestamp'] || '');
      if (!signature || !timestamp) { res.status(401).json({ error: 'Missing signature headers' }); return; }

      // Replay guard: 5 minutes
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - Number(timestamp)) > 300) { res.status(401).json({ error: 'stale request' }); return; }

      const rawBody = typeof (req as any).rawBody === 'string' ? (req as any).rawBody : JSON.stringify(req.body || {});
      const base = `${timestamp}.${rawBody}`;
      const expected = crypto.createHmac('sha256', secret).update(base).digest('hex');
      const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      if (!ok) { res.status(401).json({ error: 'bad signature' }); return; }
    }
  } catch (e) {
    res.status(401).json({ error: 'verification_failed' });
    return;
  }

  const parse = updateOpportunityStatusTagSchema.safeParse(req.body || {});
  if (!parse.success) { res.status(400).json({ error: 'invalid_payload', details: parse.error.flatten() }); return; }
  const { idempotency_key, userId, opportunityId, stage, status, tag } = parse.data;
  if (!(await ensureIdempotent(idempotency_key))) { res.json({ deduped: true }); return; }
  const patch: any = { updated_at: new Date().toISOString() as any };
  if (stage !== undefined) patch.stage = stage;
  if (status !== undefined) patch.status = status;
  if (tag !== undefined) patch.tag = tag;
  const { error } = await supabase.from('opportunities').update(patch).eq('id', opportunityId);
  if (error) { res.status(500).json({ error: error.message }); return; }

  try {
    // Re-fetch current opportunity state for accurate checks and enrichment
    const { data: opp } = await supabase
      .from('opportunities')
      .select('id,title,value,stage,status,tag,client_id,owner_id')
      .eq('id', opportunityId)
      .maybeSingle();

    const afterStage = String(opp?.stage || stage || '').toLowerCase();
    const afterStatus = String(opp?.status || status || '').toLowerCase();
    const afterTagLc = String((opp?.tag ?? tag ?? '')).toLowerCase();
    const isCloseWon = /close\s*won/.test(afterStage) || ['close_won','closed_won','won'].includes(afterStatus);
    const isJobSeeker = afterTagLc === 'job seeker' || afterTagLc === 'job_seeker';

    if (isCloseWon && isJobSeeker) {
      // Enrich with client and primary contact (decision maker) if available
      let client: any = null;
      let contact: any = null;
      if (opp?.client_id) {
        const [{ data: clientRow }, { data: contactRow }] = await Promise.all([
          supabase.from('clients').select('id,name,domain').eq('id', opp.client_id as any).maybeSingle(),
          supabase.from('contacts').select('id,name,email').eq('client_id', opp.client_id as any).limit(1).maybeSingle()
        ] as any);
        client = clientRow || null;
        contact = contactRow || null;
      }

      const payload = {
        id: opp?.id || opportunityId,
        name: opp?.title || 'Unknown Opportunity',
        amount: opp?.value ?? null,
        tag: opp?.tag ?? tag ?? null,
        stage: opp?.stage || stage || null,
        status: opp?.status || 'won',
        company_name: client?.name || null,
        decision_maker_name: contact?.name || null,
        decision_maker_email: contact?.email || null,
        owner_user_id: userId
      };

      // Log for debugging visibility
      console.log('[Zapier] opportunity_closed_won enriched payload', {
        id: payload.id,
        name: payload.name,
        amount: payload.amount,
        company_name: payload.company_name,
        decision_maker_name: payload.decision_maker_name,
        decision_maker_email: payload.decision_maker_email,
        stage: payload.stage,
        status: payload.status,
        tag: payload.tag
      });

      await createZapEvent({
        event_type: EVENT_TYPES.opportunity_closed_won as any,
        user_id: userId,
        entity: 'opportunity',
        entity_id: opportunityId,
        payload
      });
    }
  } catch {}

  logger.info({ route: '/api/zapier/actions/updateOpportunityStatusTag', action: 'update', ok: true, id: opportunityId });
  res.json({ ok: true, id: opportunityId });
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
    logger.info({ route: '/api/zapier/actions/addOrUpdateNote', action: 'update', ok: true, id: data?.id });
    res.json({ ok: true, id: data?.id, updated: true });
  } else {
    const col = entityType === 'lead' ? 'lead_id' : (entityType === 'candidate' ? 'candidate_id' : (entityType === 'opportunity' ? 'opportunity_id' : 'contact_id'));
    const { data, error } = await supabase.from(table).insert({ [col]: entityId, note_text: body, title: title || null }).select('id').maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    logger.info({ route: '/api/zapier/actions/addOrUpdateNote', action: 'create', ok: true, id: data?.id });
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
  logger.info({ route: '/api/zapier/actions/sendInvoice', action: 'create', ok: true, id: data.id });
  res.json({ ok: true, invoiceId: data.id });
});

export default router;


