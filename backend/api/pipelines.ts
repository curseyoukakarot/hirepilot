import express, { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { requireAuth } from '../middleware/authMiddleware';
import {
  emitZapEvent,
  ZAP_EVENT_TYPES,
  generatePipelineStageEvent,
} from '../lib/zapEventEmitter';
import { createPipelineWithDefaultStages } from '../lib/pipelineHelpers';
import { notifySlack } from '../lib/slack';

const router = express.Router();

// GET /api/pipelines?jobId=... (or all pipelines for current user if no jobId)
router.get('/', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.query.jobId || '');
    const userId = (req as any).user?.id;
    if (!userId) return res.json({ pipelines: [] });

    // If no jobId provided, return all pipelines owned by this user
    if (!jobId) {
      const { data, error } = await supabaseDb
        .from('pipelines')
        .select('id, name, department')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json({ pipelines: data || [] });
    }

    let { data, error } = await supabaseDb
      .from('job_requisitions')
      .select('pipeline_id, title')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();
    if (error || !data) {
      const retry = await supabaseDb
        .from('job_requisitions')
        .select('pipeline_id, title')
        .eq('id', jobId)
        .maybeSingle();
      data = retry.data as any;
    }
    if (!data) {
      console.warn('[pipelines] job not found for', jobId, 'user', userId);
      return res.json([]);
    }

    const pipelineId = data.pipeline_id;
    if (!pipelineId) {
      console.warn('[pipelines] no pipeline_id on job', jobId);
      return res.json([]);
    }

    const { data: pipelineRow, error: pErr } = await supabaseDb
      .from('pipelines')
      .select('id, name, department')
      .eq('id', pipelineId)
      .maybeSingle();
    if (pErr) console.error('[pipelines] pipeline fetch error', pErr.message);
    if (pipelineRow) return res.json({ pipelines: [pipelineRow] });
    return res.json({ pipelines: [{ id: pipelineId, name: data.title || 'Pipeline', department: '' }] });
  } catch (err: any) {
    console.error('[GET /api/pipelines] error', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipelines/:id/stages?jobId=...
router.get('/:id/stages', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const pipelineId = req.params.id;
    const jobId = String(req.query.jobId || '');
    const userId = (req as any).user?.id;
    if (!pipelineId || !jobId || !userId) return res.json({ stages: [], candidates: {} });

    // Verify job ownership
    let { data: job, error: jobErr } = await supabaseDb
      .from('job_requisitions')
      .select('id, pipeline_id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();
    if (jobErr || !job) {
      const retry = await supabaseDb
        .from('job_requisitions')
        .select('id, pipeline_id')
        .eq('id', jobId)
        .maybeSingle();
      job = retry.data as any;
    }
    if (!job || String(job.pipeline_id) !== String(pipelineId)) {
      console.warn('[pipelines:stages] job-pipeline mismatch', { jobId, pipelineId, job });
      return res.json({ stages: [], candidates: {} });
    }

    const { data: stages, error: stageErr } = await supabaseDb
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });
    if (stageErr) throw stageErr;

    const { data: candData, error: candErr } = await supabaseDb
      .from('candidate_jobs')
      .select('id, candidate_id, stage_id, candidates (id, first_name, last_name, email, avatar_url)')
      .eq('job_id', jobId);
    if (candErr) throw candErr;

    const grouped: Record<string, any[]> = {};
    (candData || []).forEach(row => {
      const stage = row.stage_id || 'unassigned';
      if (!grouped[stage]) grouped[stage] = [];

      // Normalize candidate object
      const candidate = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;

      grouped[stage].push({
        id: row.id,
        candidate_id: row.candidate_id,
        name: `${candidate?.first_name || ''} ${candidate?.last_name || ''}`.trim(),
        email: candidate?.email || '',
        avatar_url: candidate?.avatar_url || '',
      });
    });

    res.json({ stages: stages || [], candidates: grouped });
  } catch (err: any) {
    console.error('[GET /api/pipelines/:id/stages] error', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipelines/job/:jobId/recent - last 3 candidates for a job (public: guest-friendly)
router.get('/job/:jobId/recent', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    if (!jobId) return res.json({ candidates: [] });

    const { data, error } = await supabaseDb
      .from('candidate_jobs')
      .select('created_at, updated_at, status, candidates ( first_name, last_name, email, avatar_url, title ), pipeline_stages ( title )')
      .eq('job_id', jobId)
      .order('updated_at', { ascending: false })
      .limit(3);
    if (error) throw error;

    const mapped = (data || []).map((row: any) => ({
      name: `${row?.candidates?.first_name || ''} ${row?.candidates?.last_name || ''}`.trim(),
      first_name: row?.candidates?.first_name || '',
      last_name: row?.candidates?.last_name || '',
      title: row?.candidates?.title || '',
      email: row?.candidates?.email || '',
      avatar_url: row?.candidates?.avatar_url || '',
      status: row?.pipeline_stages?.title || row?.status || 'sourced',
      created_at: row?.created_at || row?.updated_at || null,
    }));

    res.json({ candidates: mapped });
  } catch (err: any) {
    console.error('[GET /api/pipelines/job/:jobId/recent] error', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipelines
router.post('/', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { job_id, user_id, name, department, stages } = req.body || {};
    
    if (!userId || !name) {
      return res.status(400).json({ error: 'Missing required fields: userId and name' });
    }

    // Use the provided job_id or fallback to user_id for legacy support
    const targetJobId = job_id;
    const targetUserId = user_id || userId;

    if (!targetJobId) {
      return res.status(400).json({ error: 'Missing required field: job_id' });
    }

    // Verify job ownership
    const { data: job, error: jobError } = await supabaseDb
      .from('job_requisitions')
      .select('title, user_id')
      .eq('id', targetJobId)
      .eq('user_id', targetUserId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    // Start transaction (pseudo since Supabase JS has no native transaction)
    const { data: pipeline, error: pipelineError } = await supabaseDb
      .from("pipelines")
      .insert([
        {
          job_id: targetJobId,
          user_id: targetUserId,
          name,
          department: department || null,
        },
      ])
      .select()
      .single();

    if (pipelineError) {
      console.error("Pipeline insert failed:", pipelineError);
      return res.status(500).json({ error: "Pipeline creation failed" });
    }

    // Define stages: use provided or default
    const stageList =
      stages && stages.length > 0
        ? stages.map((s: any, idx: number) => ({
            pipeline_id: pipeline.id,
            title: s.title || s.name,
            position: idx + 1,
            color: s.color || '#3B82F6',
            icon: s.icon || null,
          }))
        : [
            { pipeline_id: pipeline.id, title: "Sourced", position: 1, color: '#3B82F6', icon: null },
            { pipeline_id: pipeline.id, title: "Contacted", position: 2, color: '#10B981', icon: null },
            { pipeline_id: pipeline.id, title: "Interviewed", position: 3, color: '#F59E0B', icon: null },
            { pipeline_id: pipeline.id, title: "Offered", position: 4, color: '#8B5CF6', icon: null },
            { pipeline_id: pipeline.id, title: "Hired", position: 5, color: '#059669', icon: null },
          ];

    const { data: insertedStages, error: stageError } = await supabaseDb
      .from("pipeline_stages")
      .insert(stageList)
      .select();

    if (stageError) {
      console.error("Stage insert failed:", stageError);

      // Rollback pipeline if stages fail
      await supabaseDb.from("pipelines").delete().eq("id", pipeline.id);

      return res.status(500).json({ error: "Failed to create pipeline stages" });
    }

    // Update job with pipeline_id
    const { error: updateError } = await supabaseDb
      .from('job_requisitions')
      .update({ pipeline_id: pipeline.id })
      .eq('id', targetJobId);

    if (updateError) {
      console.error('[POST /api/pipelines] Job update error:', updateError);
      // Don't fail the request, just log the error
    }

    console.log(`✅ Created pipeline ${pipeline.id} with ${insertedStages?.length || 0} stages for job ${targetJobId}`);

    // Fetch the complete pipeline with stages for consistent response
    const { data: fullPipeline, error: fetchError } = await supabaseDb
      .from("pipelines")
      .select(`
        *,
        pipeline_stages(*)
      `)
      .eq("id", pipeline.id)
      .single();

    if (fetchError) {
      console.error('Failed to fetch complete pipeline:', fetchError);
      // Fallback to basic response
      return res.status(200).json({ 
        success: true, 
        pipeline: { ...pipeline, stages: insertedStages || [] },
        message: 'Pipeline created and stages set!'
      });
    }

    // Fire-and-forget Slack notification
    try {
      const userEmail = (req as any).user?.email || '';
      await notifySlack(`🧩 Pipeline created: ${fullPipeline?.name || name} for job ${job.title} by ${userEmail || 'unknown user'}`);
    } catch (e) {
      console.warn('[pipelines POST] Slack notify failed (non-fatal):', (e as any)?.message || e);
    }

    return res.status(200).json({ 
      success: true, 
      pipeline: fullPipeline,
      message: 'Pipeline created and stages set!'
    });
  } catch (error: any) {
    console.error('[POST /api/pipelines] Create pipeline error', error);
    return res.status(500).json({ error: error.message });
  }
});

// Move candidate between stages
router.post('/:id/candidates/:candidateId/move', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const pipelineId = req.params.id;
    const candidateId = req.params.candidateId;
    const { jobId, stageId, stageTitle } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!pipelineId || !candidateId || !jobId || !stageId) return res.status(400).json({ error: 'Missing fields' });

    // Resolve candidate_jobs row
    const { data: cjRow, error: cjErr } = await supabaseDb
      .from('candidate_jobs')
      .select('id, candidate_id, job_id')
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId)
      .maybeSingle();
    if (cjErr || !cjRow) return res.status(404).json({ error: 'Candidate job not found' });

    // Validate ownership via candidates.user_id
    const { data: cand, error: candErr } = await supabaseDb
      .from('candidates')
      .select('user_id, first_name, last_name, email')
      .eq('id', cjRow.candidate_id)
      .single();
    if (candErr || !cand || cand.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Attempt update via stage_id; fallback to status (enum) mapping
    let updErr = null;
    const now = new Date().toISOString();
    const { error: updError } = await supabaseDb
      .from('candidate_jobs')
      .update({ stage_id: stageId, updated_at: now })
      .eq('id', cjRow.id);
    updErr = updError;
    if (updErr && (updErr as any).code === '42703') {
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
      const canonical = canonicalFrom(stageTitle || 'Interviewed');
      const { error } = await supabaseDb
        .from('candidate_jobs')
        .update({ status: canonical, updated_at: now })
        .eq('id', cjRow.id);
      updErr = error;
    }
    if (updErr) {
      console.error('[move-candidate] update error', updErr);
      return res.status(500).json({ error: 'Failed to move candidate' });
    }
    // Emit events
    await emitZapEvent({
      userId,
      eventType: ZAP_EVENT_TYPES.CANDIDATE_MOVED_TO_STAGE,
      eventData: { job_id: jobId, candidate_id: candidateId, stage_id: stageId },
    });
    if (stageTitle) {
      const dyn = generatePipelineStageEvent(stageTitle, 'moved_to');
      await emitZapEvent({ userId, eventType: dyn as any, eventData: { job_id: jobId, candidate_id: candidateId, stage_id: stageId } });
      if (/interview/i.test(stageTitle)) {
        await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.CANDIDATE_INTERVIEWED, eventData: { job_id: jobId, candidate_id: candidateId } });
      } else if (/offer/i.test(stageTitle)) {
        await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.CANDIDATE_OFFERED, eventData: { job_id: jobId, candidate_id: candidateId } });
      }
    }

    // Log to job_activity_log
    try {
      await supabaseDb.from('job_activity_log').insert({
        job_id: jobId,
        actor_id: userId,
        type: 'candidate_moved',
        metadata: { candidate_id: candidateId, stage_id: stageId, stage_title: stageTitle || null },
        created_at: new Date().toISOString(),
      });
    } catch {}

    return res.json({ success: true, candidate_job_id: cjRow.id, dest_stage_id: stageId, stage_title: stageTitle || null });
  } catch (e: any) {
    console.error('[move-candidate] unexpected', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/pipelines/:id/stages
router.post('/:id/stages', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const pipelineId = req.params.id;
    const { title, color, position } = req.body || {};
    const userId = (req as any).user?.id;
    if (!pipelineId || !title || userId == null) return res.status(400).json({ error: 'Missing fields' });

    const { data: stage, error } = await supabaseDb
      .from('pipeline_stages')
      .insert({ pipeline_id: pipelineId, title, color, position })
      .select()
      .single();
    if (error) throw error;

    await emitZapEvent({
      userId,
      eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED,
      eventData: { pipeline_id: pipelineId, stage_id: stage.id, action: 'created' },
    });

    res.json(stage);
  } catch (err: any) {
    console.error('[POST /api/pipelines/:id/stages] error', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pipelines/:id/stages/:stageId
router.patch('/:id/stages/:stageId', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const { id, stageId } = req.params as any;
    const userId = (req as any).user?.id;
    const { title, color } = req.body || {};
    if (!id || !stageId || !userId) return res.status(400).json({ error: 'Missing fields' });

    const { data: updated, error } = await supabaseDb
      .from('pipeline_stages')
      .update({ title, color })
      .eq('id', stageId)
      .eq('pipeline_id', id)
      .select();
    if (error) throw error;
    if (!updated || updated.length === 0) {
      // No-op to avoid breaking UI; stage might not belong to this pipeline or was already updated
      return res.json({ success: true, updated: 0 });
    }

    await emitZapEvent({
      userId,
      eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED,
      eventData: { pipeline_id: id, stage_id: stageId, action: 'updated' },
    });

    res.json(updated[0]);
  } catch (err: any) {
    console.error('[PATCH /api/pipelines/:id/stages/:stageId] error', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pipelines/:id/stages/:stageId
router.delete('/:id/stages/:stageId', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const { id, stageId } = req.params as any;
    const userId = (req as any).user?.id;
    if (!id || !stageId || !userId) return res.status(400).json({ error: 'Missing fields' });

    const { error } = await supabaseDb
      .from('pipeline_stages')
      .delete()
      .eq('id', stageId);
    if (error) throw error;

    await emitZapEvent({
      userId,
      eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED,
      eventData: { pipeline_id: id, stage_id: stageId, action: 'deleted' },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/pipelines/:id/stages/:stageId] error', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pipelines/:id/stages/reorder
router.patch('/:id/stages/reorder', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { stages } = req.body || {};
    if (!id || !Array.isArray(stages) || !userId) return res.status(400).json({ error: 'Missing fields' });

    console.info('[reorder] start', {
      pipelineId: id,
      count: Array.isArray(stages) ? stages.length : 0,
      sampleIds: Array.isArray(stages) ? (stages.slice(0, 3).map((s: any) => s.id)) : [],
      accept: req.headers['accept'],
      prefer: req.headers['prefer'],
    });

    // Attempt RPC first (transactional, VOID return)
    const { error } = await supabaseDb.rpc('reorder_pipeline_stages', {
      p_pipeline_id: id,
      p_stages: stages,
    });
    if (error) {
      console.warn('[reorder] RPC failed, falling back to per-row updates', error);

      // Fallback mirrors candidate move. First, resolve actual pipeline_id from provided stage ids
      const providedIds = (Array.isArray(stages) ? stages : []).map((s: any) => s.id);
      const { data: foundRows, error: foundErr } = await supabaseDb
        .from('pipeline_stages')
        .select('id,pipeline_id')
        .in('id', providedIds);
      if (foundErr) throw foundErr;
      const actualPipelineId = foundRows && foundRows.length > 0 ? String(foundRows[0].pipeline_id) : id;
      if (actualPipelineId !== id) {
        console.warn('[reorder] pipelineId mismatch; using resolved pipeline_id from stages', { requested: id, resolved: actualPipelineId });
      }

      // Limit updates to ids we actually found
      const valid = new Set((foundRows || []).map((r: any) => String(r.id)));
      const toUpdate = (Array.isArray(stages) ? stages : []).filter((s: any) => valid.has(String(s.id)));
      console.info('[reorder] foundRows', { foundCount: (foundRows || []).length });
      console.info('[reorder] toUpdate ids', { ids: toUpdate.map((s: any) => s.id) });

      if (!toUpdate.length) {
        console.warn('[reorder] no stages matched pipeline filter; attempting id-only updates');
        const looseUpdates = (Array.isArray(stages) ? stages : []).map((s: any) =>
          supabaseDb
            .from('pipeline_stages')
            .update({ position: s.position })
            .eq('id', s.id)
            .select('id')
        );
        const looseResults = await Promise.all(looseUpdates);
        const looseErr = looseResults.find(r => r.error)?.error as any;
        if (looseErr) throw looseErr;
        const updatedCount = looseResults.reduce((acc, r) => acc + (((r.data as any[]) || []).length), 0);
        console.info('[reorder] id-only updates applied', { updatedCount });
        await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED, eventData: { pipeline_id: id, action: 'reordered' } });
        return res.status(200).json({ success: true, updated: updatedCount });
      }

      const updates = toUpdate.map((s: any) =>
        supabaseDb
          .from('pipeline_stages')
          .update({ position: s.position })
          .eq('id', s.id)
          .eq('pipeline_id', actualPipelineId)
          .select('id')
      );
      const results = await Promise.all(updates);
      const firstErr = results.find(r => r.error)?.error as any;
      if (firstErr) throw firstErr;
      const updatedCount = results.reduce((acc, r) => acc + (((r.data as any[]) || []).length), 0);
      console.info('[reorder] pipeline-scoped updates applied', { updatedCount });
      await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED, eventData: { pipeline_id: actualPipelineId, action: 'reordered' } });
      // Return fresh stages so frontend can reflect ordering immediately
      const { data: freshStages } = await supabaseDb
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', actualPipelineId)
        .order('position', { ascending: true });
      return res.status(200).json({ success: true, updated: updatedCount, stages: freshStages || [] });
    }

    await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED, eventData: { pipeline_id: id, action: 'reordered' } });
    const { data: freshStages } = await supabaseDb
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', id)
      .order('position', { ascending: true });
    res.status(200).json({ success: true, updated: (Array.isArray(stages) ? stages.length : 0), stages: freshStages || [] });
  } catch (err: any) {
    console.error('[PATCH /api/pipelines/:id/stages/reorder] error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
