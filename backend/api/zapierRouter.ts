import { Router, Response } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { ApiRequest } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import enrichLead from './enrichLead';
import zapierTestRouter from './zapierTestEvent';

const router = Router();

/**
 * Create or update a lead via Zapier / Make.
 * If a lead with the provided email already exists, update it;
 * otherwise insert a new one. Requires X-API-Key header.
 */
router.post('/leads', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[Zapier] Incoming /leads payload:', req.body);
    const userId = req.user!.id;
    const lead = req.body;
    // Normalize and validate status to satisfy DB check constraint
    const ALLOWED_STATUS = ['sourced','contacted','responded','interviewed','offered','hired','rejected'];
    if (lead.status) {
      const s = String(lead.status).toLowerCase();
      if (!ALLOWED_STATUS.includes(s)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUS.join(', ')}` });
      }
      lead.status = s;
    }

    if (!lead || !lead.email) {
      return res.status(400).json({ error: 'Lead email is required' });
    }

    // Manual upsert by (user_id, email) to avoid DB constraint requirement
    const { data: existing, error: findErr } = await supabaseDb
      .from('leads')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('email', lead.email)
      .maybeSingle();
    if (findErr) throw findErr;

    let data: any;
    if (existing && existing.id) {
      const { data: upd, error: updErr } = await supabaseDb
        .from('leads')
        .update({ ...lead, user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (updErr) throw updErr;
      data = upd;
    } else {
      const { data: ins, error: insErr } = await supabaseDb
        .from('leads')
        .insert([{ ...lead, user_id: userId }])
        .select('*')
        .single();
      if (insErr) throw insErr;
      data = ins;
    }

    // Emit events to both new and legacy systems
    await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData }) => {
      const eventType = existing ? ZAP_EVENT_TYPES.LEAD_UPDATED : ZAP_EVENT_TYPES.LEAD_CREATED;
      emitZapEvent({
        userId,
        eventType,
        eventData: createLeadEventData(data),
        sourceTable: 'leads',
        sourceId: data.id
      });
    });

    return res.status(200).json({ lead: data });
  } catch (err: any) {
    console.error('[Zapier] /leads error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Enrich an existing lead. Expects { lead_id } in body. Runs the same
 * enrichment logic used internally and returns the enriched data.
 */
router.post('/enrich', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[Zapier] Incoming /enrich payload:', req.body);
  } catch {}
  // Reuse existing enrichLead handler for DRYness
  return enrichLead(req as any, res);
});

/**
 * Polling trigger for new leads. Zapier will hit this with a `since` ISO timestamp.
 * Returns leads created after that timestamp (default: last 15 minutes).
 */
router.get('/triggers/new-leads', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[Zapier] Poll /triggers/new-leads since=', req.query.since);
    const userId = req.user!.id;
    const since = req.query.since as string | undefined;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 15 * 60 * 1000);

    const { data, error } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .gt('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    return res.status(200).json({ leads: data });
  } catch (err: any) {
    console.error('[Zapier] /triggers/new-leads error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * New comprehensive events trigger endpoint 
 * This replaces the need for multiple specific polling endpoints
 * Supports filtering by event_type, since timestamp, and pagination
 */
router.get('/triggers/events', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[Zapier] Poll /triggers/events query=', req.query);
    const userId = req.user!.id;
    const eventType = req.query.event_type as string | undefined;
    const since = req.query.since as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string || '50'), 100);
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 15 * 60 * 1000);

    let query = supabaseDb
      .from('zap_events')
      .select('*')
      .eq('user_id', userId)
      .gt('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ events: data });
  } catch (err: any) {
    console.error('[Zapier] /triggers/events error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Polling trigger: leads whose status was updated (pipeline stage change)
 * after a provided `since` ISO timestamp. Zapier can use this to fire
 * workflows when a lead moves stages. Optional query param `stage`
 * can filter to a specific status value.
 * 
 * @deprecated Use /triggers/events with event_type=lead_stage_changed instead
 */
router.get('/triggers/pipeline-stage-changes', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const since = req.query.since as string | undefined;
    const stageFilter = req.query.stage as string | undefined;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 15 * 60 * 1000);

    let query = supabaseDb
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', sinceDate.toISOString())
      .order('updated_at', { ascending: true })
      .limit(50);

    if (stageFilter) {
      query = query.eq('status', stageFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ leads: data });
  } catch (err: any) {
    console.error('[Zapier] /triggers/pipeline-stage-changes error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Mount test endpoints
router.use('/', zapierTestRouter);

export default router; 