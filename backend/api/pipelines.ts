import express, { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { requireAuth } from '../middleware/authMiddleware';
import {
  emitZapEvent,
  ZAP_EVENT_TYPES,
  generatePipelineStageEvent,
} from '../lib/zapEventEmitter';

const router = express.Router();

// GET /api/pipelines?jobId=...
router.get('/', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.query.jobId || '');
    const userId = (req as any).user?.id;
    if (!jobId || !userId) return res.status(400).json({ error: 'Missing jobId' });

    const { data, error } = await supabaseDb
      .from('job_requisitions')
      .select('pipeline_id, title, pipeline:pipelines (id, name, department)')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Job not found' });

    const pipeline = data.pipeline_id && data.pipeline ? [data.pipeline] : [];
    res.json(pipeline);
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
    if (!pipelineId || !jobId || !userId) return res.status(400).json({ error: 'Missing ids' });

    // Verify job ownership
    const { data: job, error: jobErr } = await supabaseDb
      .from('job_requisitions')
      .select('id, pipeline_id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();
    if (jobErr || !job || String(job.pipeline_id) !== String(pipelineId)) {
      return res.status(404).json({ error: 'Job not found' });
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

// POST /api/pipelines
router.post('/', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { name, department, stages, job_id } = req.body || {};
    if (!userId || !name || !department || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or stages' });
    }

    const { data: pipeline, error: pipelineError } = await supabaseDb
      .from('pipelines')
      .insert({ user_id: userId, name, department })
      .select()
      .single();
    if (pipelineError || !pipeline) {
      return res.status(500).json({ error: pipelineError?.message || 'Failed to create pipeline' });
    }

    const stageRows = stages.map((stage: any, idx: number) => ({
      pipeline_id: pipeline.id,
      title: stage.name || stage.title,
      color: stage.color || 'blue',
      position: idx,
    }));
    const { data: insertedStages, error: stagesError } = await supabaseDb
      .from('pipeline_stages')
      .insert(stageRows)
      .select();
    if (stagesError) {
      return res.status(500).json({ error: stagesError.message });
    }

    if (job_id) {
      await supabaseDb
        .from('job_requisitions')
        .update({ pipeline_id: pipeline.id })
        .eq('id', job_id);
    }

    return res.json({ pipeline: { ...pipeline, stages: insertedStages } });
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

    const { data: stage, error } = await supabaseDb
      .from('pipeline_stages')
      .update({ title, color })
      .eq('id', stageId)
      .select()
      .single();
    if (error) throw error;

    await emitZapEvent({
      userId,
      eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED,
      eventData: { pipeline_id: id, stage_id: stageId, action: 'updated' },
    });

    res.json(stage);
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

    const { error } = await supabaseDb
      .from('pipeline_stages')
      .upsert(stages.map((s: any) => ({ id: s.id, position: s.position })));
    if (error) throw error;

    await emitZapEvent({
      userId,
      eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED,
      eventData: { pipeline_id: id, action: 'reordered' },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /api/pipelines/:id/stages/reorder] error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
=======
import express, { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { requireAuth } from '../middleware/authMiddleware';
import {
  emitZapEvent,
  ZAP_EVENT_TYPES,
  generatePipelineStageEvent,
} from '../lib/zapEventEmitter';

const router = express.Router();

/**
 * GET /api/pipelines?jobId=...
 */
router.get('/', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.query.jobId || '');
    const userId = (req as any).user?.id;
    if (!jobId || !userId) {
      return res.status(400).json({ error: 'Missing jobId' });
    }

    const { data, error } = await supabaseDb
      .from('job_requisitions')
      .select(
        'pipeline_id, title, pipeline:pipelines (id, name, department)'
      )
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const pipeline =
      data.pipeline_id && data.pipeline ? [data.pipeline] : [];
    res.json(pipeline);
  } catch (err: any) {
    console.error('[GET /api/pipelines] error', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pipelines/:id/stages?jobId=...
 */
router.get('/:id/stages', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const pipelineId = req.params.id;
    const jobId = String(req.query.jobId || '');
    const userId = (req as any).user?.id;
    if (!pipelineId || !jobId || !userId) {
      return res.status(400).json({ error: 'Missing ids' });
    }

    // Verify job ownership
    const { data: job, error: jobErr } = await supabaseDb
      .from('job_requisitions')
      .select('id, pipeline_id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobErr || !job || String(job.pipeline_id) !== String(pipelineId)) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Fetch stages
    const { data: stages, error: stageErr } = await supabaseDb
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });
    if (stageErr) throw stageErr;

    // Fetch candidates linked to this job
    const { data: candData, error: candErr } = await supabaseDb
      .from('candidate_jobs')
      .select(
        'id, candidate_id, stage_id, candidates (id, first_name, last_name, email, avatar_url)'
      )
      .eq('job_id', jobId);
    if (candErr) throw candErr;

    // Group candidates by stage
    const grouped: Record<string, any[]> = {};
    (candData || []).forEach((row) => {
      const stage = row.stage_id || 'unassigned';
      if (!grouped[stage]) grouped[stage] = [];

      const candidate = Array.isArray(row.candidates)
        ? row.candidates[0]
        : row.candidates;

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

/**
 * POST /api/pipelines
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, name, department, stages, job_id } = req.body;
    if (!user_id || !name || !department || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or stages' });
    }

    // Insert pipeline
    const { data: pipeline, error: pipelineError } = await supabaseDb
      .from('pipelines')
      .insert({ user_id, name, department })
      .select()
      .single();
    if (pipelineError || !pipeline) {
      return res.status(500).json({ error: pipelineError?.message || 'Failed to create pipeline' });
    }

    // Insert stages
    const stageRows = stages.map((stage, idx) => ({
      pipeline_id: pipeline.id,
      name: stage.name,
      title: stage.name,
      icon: stage.icon,
      color: stage.color || 'blue',
      position: idx,
    }));
    const { data: insertedStages, error: stagesError } = await supabaseDb
      .from('pipeline_stages')
      .insert(stageRows)
      .select();
    if (stagesError) {
      return res.status(500).json({ error: stagesError.message });
    }

    // Link pipeline to job if provided
    if (job_id) {
      await supabaseDb
        .from('job_requisitions')
        .update({ pipeline_id: pipeline.id })
        .eq('id', job_id);
    }

    res.status(200).json({ pipeline: { ...pipeline, stages: insertedStages } });
  } catch (error: any) {
    console.error('[POST /api/pipelines] error', error);
    res.status(500).json({ error: error.message || 'Failed to create pipeline' });
  }
});

/**
 * POST /api/pipelines/:id/candidates/:candidateId/move
 */
router.post('/:id/candidates/:candidateId/move', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const pipelineId = req.params.id;
    const candidateId = req.params.candidateId;
    const { jobId, stageId, stageTitle } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!pipelineId || !candidateId || !jobId || !stageId) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Resolve candidate_jobs row
    const { data: cjRow, error: cjErr } = await supabaseDb
      .from('candidate_jobs')
      .select('id, candidate_id, job_id')
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId)
      .maybeSingle();
    if (cjErr || !cjRow) {
      return res.status(404).json({ error: 'Candidate job not found' });
    }

    // Validate ownership
    const { data: cand, error: candErr } = await supabaseDb
      .from('candidates')
      .select('user_id, first_name, last_name, email')
      .eq('id', cjRow.candidate_id)
      .single();
    if (candErr || !cand || cand.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Update stage_id
    const now = new Date().toISOString();
    let { error: updError } = await supabaseDb
      .from('candidate_jobs')
      .update({ stage_id: stageId, updated_at: now })
      .eq('id', cjRow.id);

    // Fallback to status enum if needed
    if (updError && (updError as any).code === '42703') {
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
      updError = error;
    }

    if (updError) {
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

    return res.json({ success: true, candidate_job_id: cjRow.id, dest_stage_id: stageId, stage_title: stageTitle || null });
  } catch (e: any) {
    console.error('[move-candidate] unexpected', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
});

/**
 * POST /api/pipelines/:id/stages
 */
router.post('/:id/stages', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const pipelineId = req.params.id;
    const { title, color, position } = req.body || {};
    const userId = (req as any).user?.id;
    if (!pipelineId || !title || !userId) {
      return res.status(400).json({ error: 'Missing fields' });
    }

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

/**
 * PATCH /api/pipelines/:id/stages/:stageId
 */
router.patch('/:id/stages/:stageId', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const { id, stageId } = req.params as any;
    const userId = (req as any).user?.id;
    const { title, color } = req.body || {};
    if (!id || !stageId || !userId) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const { data: stage, error } = await supabaseDb
      .from('pipeline_stages')
      .update({ title, color })
      .eq('id', stageId)
      .select()
      .single();
    if (error) throw error;

    await emitZapEvent({
      userId,
      eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED,
      eventData: { pipeline_id: id, stage_id: stageId, action: 'updated' },
    });

    res.json(stage);
  } catch (err: any) {
    console.error('[PATCH /api/pipelines/:id/stages/:stageId] error', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/pipelines/:id/stages/:stageId
 */
router.delete('/:id/stages/:stageId', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const { id, stageId } = req.params as any;
    const userId = (req as any).user?.id;
    if (!id || !stageId || !userId) {
      return res.status(400).json({ error: 'Missing fields' });
    }

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

/**
 * PATCH /api/pipelines/:id/stages/reorder
 */
router.patch('/:id/stages/reorder', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { stages } = req.body || {};
    if (!id || !Array.isArray(stages) || !userId) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const { error } = await supabaseDb
      .from('pipeline_stages')
      .upsert(stages.map((s: any) => ({ id: s.id, position: s.position })));
    if (error) throw error;

    await emitZapEvent({
      userId,
      eventType: ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED,
      eventData: { pipeline_id: id, action: 'reordered' },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /api/pipelines/:id/stages/reorder] error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

