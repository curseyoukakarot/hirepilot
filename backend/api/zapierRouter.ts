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

/**
 * Move a candidate to a pipeline stage (Zapier/Make action)
 * Body can include either candidate_job_id OR (candidate_id + job_id)
 * Destination can be dest_stage_id OR stage_title (we'll map to enum if needed)
 */
router.post('/move-candidate', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { candidate_job_id, candidate_id, job_id, dest_stage_id, stage_title } = req.body || {};
    if (!dest_stage_id && !stage_title) return res.status(400).json({ error: 'Missing destination stage' });
    if (!candidate_job_id && !(candidate_id && job_id)) return res.status(400).json({ error: 'Missing candidate reference' });

    // Resolve candidate_jobs row
    let cjRow: any = null;
    if (candidate_job_id) {
      const { data, error } = await supabaseDb
        .from('candidate_jobs')
        .select('id, candidate_id, job_id')
        .eq('id', candidate_job_id)
        .maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Candidate job not found' });
      cjRow = data;
    } else {
      let { data, error } = await supabaseDb
        .from('candidate_jobs')
        .select('id, candidate_id, job_id')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      // If candidate is not attached to the job yet, create the link
      if (!data) {
        // Validate ownership first
        const { data: candOwn, error: ownErr } = await supabaseDb
          .from('candidates')
          .select('user_id')
          .eq('id', candidate_id)
          .single();
        if (ownErr || !candOwn || candOwn.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

        // Attempt to resolve stage_id from stage_title using pipeline_id or job_id
        let resolvedStageId: string | null = null;
        if (stage_title) {
          const { data: jobRow } = await supabaseDb
            .from('job_requisitions')
            .select('pipeline_id')
            .eq('id', job_id)
            .maybeSingle();
          if (jobRow?.pipeline_id) {
            const resId = await supabaseDb
              .from('pipeline_stages')
              .select('id')
              .eq('pipeline_id', jobRow.pipeline_id)
              .ilike('title', stage_title)
              .maybeSingle();
            resolvedStageId = (resId.data as any)?.id || null;
          }
          if (!resolvedStageId) {
            const resId = await supabaseDb
              .from('pipeline_stages')
              .select('id')
              .eq('job_id', job_id)
              .ilike('title', stage_title)
              .maybeSingle();
            resolvedStageId = (resId.data as any)?.id || null;
          }
        }

        const canonicalFrom = (title: string) => {
          const t = String(title || '').toLowerCase();
          if (['sourced','contacted','interviewed','offered','hired','rejected'].includes(t)) return t;
          if (t.includes('offer')) return 'offered';
          if (t.includes('hire')) return 'hired';
          if (t.includes('reject')) return 'rejected';
          if (t.includes('contact')) return 'contacted';
          if (t.includes('interview')) return 'interviewed';
          return 'sourced';
        };

        const insertPayload: any = {
          candidate_id,
          job_id
        };
        if (resolvedStageId || dest_stage_id) insertPayload.stage_id = dest_stage_id || resolvedStageId;
        else if (stage_title) insertPayload.status = canonicalFrom(stage_title);

        const { data: inserted, error: insErr } = await supabaseDb
          .from('candidate_jobs')
          .insert(insertPayload)
          .select('id, candidate_id, job_id')
          .single();
        if (insErr || !inserted) return res.status(500).json({ error: insErr?.message || 'Failed to attach candidate to job' });
        data = inserted;
      }
      cjRow = data;
    }

    // Validate ownership
    const { data: cand, error: candErr } = await supabaseDb
      .from('candidates')
      .select('user_id')
      .eq('id', cjRow.candidate_id)
      .single();
    if (candErr || !cand || cand.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    // Resolve stage_id from title if provided
    let resolvedStageId: string | null = null;
    if (stage_title && !dest_stage_id) {
      // Prefer pipeline_id path if available
      const { data: jobRow } = await supabaseDb
        .from('job_requisitions')
        .select('pipeline_id')
        .eq('id', cjRow.job_id)
        .maybeSingle();
      // Helper to attempt resolution by various strategies
      const tryResolve = async (filterCol: 'pipeline_id' | 'job_id', filterVal: string) => {
        // Exact ilike on title
        let q = await supabaseDb
          .from('pipeline_stages')
          .select('id, title, name')
          .eq(filterCol, filterVal)
          .ilike('title', stage_title)
          .maybeSingle();
        if (q.data?.id) return q.data.id as string;
        // Exact ilike on name
        q = await supabaseDb
          .from('pipeline_stages')
          .select('id, title, name')
          .eq(filterCol, filterVal)
          .ilike('name', stage_title)
          .maybeSingle();
        if (q.data?.id) return q.data.id as string;
        // Contains match on title/name
        const all = await supabaseDb
          .from('pipeline_stages')
          .select('id, title, name')
          .eq(filterCol, filterVal);
        const lc = String(stage_title).toLowerCase();
        const hit = (all.data || []).find((s: any) => (s.title || s.name || '').toLowerCase().includes(lc));
        return hit?.id || null;
      };
      if (jobRow?.pipeline_id) {
        resolvedStageId = await tryResolve('pipeline_id', jobRow.pipeline_id);
      }
      if (!resolvedStageId) {
        resolvedStageId = await tryResolve('job_id', cjRow.job_id);
      }
    }

    // Try stage_id first
    const now = new Date().toISOString();
    let updErr = null;
    if (dest_stage_id || resolvedStageId) {
      const { error } = await supabaseDb
        .from('candidate_jobs')
        .update({ stage_id: dest_stage_id || resolvedStageId, updated_at: now })
        .eq('id', cjRow.id);
      updErr = error;
    }
    if (!(dest_stage_id || resolvedStageId) || (updErr && (updErr as any).code === '42703')) {
      // Fallback to status enum mapping from stage_title
      const canonicalFrom = (title: string) => {
        const t = String(title || '').toLowerCase();
        if (['sourced','contacted','interviewed','offered','hired','rejected'].includes(t)) return t;
        if (t.includes('offer')) return 'offered';
        if (t.includes('hire')) return 'hired';
        if (t.includes('reject')) return 'rejected';
        if (t.includes('contact')) return 'contacted';
        if (t.includes('interview')) return 'interviewed';
        return 'interviewed';
      };
      const canonical = canonicalFrom(stage_title || 'Interviewed');
      const { error } = await supabaseDb
        .from('candidate_jobs')
        .update({ status: canonical, updated_at: now })
        .eq('id', cjRow.id);
      updErr = error;
    }
    if (updErr) {
      console.error('[Zapier] move-candidate error', updErr);
      return res.status(500).json({ error: 'Failed to move candidate' });
    }

    return res.json({ success: true, candidate_job_id: cjRow.id, dest_stage_id, stage_title: stage_title || null });
  } catch (err: any) {
    console.error('[Zapier] /move-candidate error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Mount test endpoints
router.use('/', zapierTestRouter);

export default router; 