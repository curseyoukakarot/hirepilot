import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import {
  emitZapEvent,
  ZAP_EVENT_TYPES,
  generatePipelineStageEvent,
} from '../../lib/zapEventEmitter';

const router = express.Router();

// GET /api/pipelines?jobId=...
router.get('/', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.query.jobId || '');
    const userId = (req as any).user?.id;
    if (!jobId || !userId) return res.status(400).json({ error: 'Missing jobId' });

    const { data, error } = await supabase
      .from('job_requisitions')
      .select('pipeline_id, pipeline:pipelines (id, name, department)')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();
    if (error || !data) return res.json([]);
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

    const { data: job, error: jobErr } = await supabase
      .from('job_requisitions')
      .select('pipeline_id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();
    if (jobErr || !job || String(job.pipeline_id) !== String(pipelineId)) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const { data: stages, error: stageErr } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });
    if (stageErr) throw stageErr;

    const { data: candData, error: candErr } = await supabase
      .from('candidate_jobs')
      .select('id, candidate_id, stage_id, candidates (id, first_name, last_name, email, avatar_url)')
      .eq('job_id', jobId);
    if (candErr) throw candErr;

    const grouped: Record<string, any[]> = {};
    (candData || []).forEach(row => {
      const stage = row.stage_id || 'unassigned';
      if (!grouped[stage]) grouped[stage] = [];
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
    if (!userId || !name || !department || !Array.isArray(stages) || !job_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: pipeline, error: pipelineErr } = await supabase
      .from('pipelines')
      .insert({ user_id: userId, name, department })
      .select()
      .single();
    if (pipelineErr || !pipeline) throw pipelineErr;

    const stageRows = stages.map((s: any, idx: number) => ({
      pipeline_id: pipeline.id,
      title: s.name,
      color: s.color,
      position: idx,
    }));
    const { data: insertedStages, error: stageErr } = await supabase
      .from('pipeline_stages')
      .insert(stageRows)
      .select();
    if (stageErr) throw stageErr;

    await supabase
      .from('job_requisitions')
      .update({ pipeline_id: pipeline.id })
      .eq('id', job_id);

    res.json({ pipeline: { ...pipeline, stages: insertedStages } });
  } catch (err: any) {
    console.error('[POST /api/pipelines] error', err);
    res.status(500).json({ error: err.message });
  }
});

// Move candidate between stages
router.post('/:id/candidates/:candidateId/move', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const pipelineId = req.params.id;
    const candidateId = req.params.candidateId;
    const { jobId, stageId, stageTitle } = req.body || {};
    if (!userId || !pipelineId || !candidateId || !jobId || !stageId) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const { data: cjRow, error: cjErr } = await supabase
      .from('candidate_jobs')
      .select('id, candidate_id, job_id')
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId)
      .maybeSingle();
    if (cjErr || !cjRow) return res.status(404).json({ error: 'Candidate job not found' });

    const { data: cand, error: candErr } = await supabase
      .from('candidates')
      .select('user_id, first_name, last_name, email')
      .eq('id', cjRow.candidate_id)
      .single();
    if (candErr || !cand || cand.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    const now = new Date().toISOString();
    const { error: updError } = await supabase
      .from('candidate_jobs')
      .update({ stage_id: stageId, updated_at: now })
      .eq('id', cjRow.id);
    let finalErr = updError;
    if (finalErr && (finalErr as any).code === '42703') {
      const canonical = (title: string) => {
        const t = String(title || '').toLowerCase();
        if (['sourced','contacted','interviewed','offered','hired','rejected'].includes(t)) return t;
        if (t.includes('offer')) return 'offered';
        if (t.includes('hire')) return 'hired';
        if (t.includes('reject')) return 'rejected';
        if (t.includes('contact')) return 'contacted';
        if (t.includes('interview')) return 'interviewed';
        return 'interviewed';
      };
      const { error } = await supabase
        .from('candidate_jobs')
        .update({ status: canonical(stageTitle), updated_at: now })
        .eq('id', cjRow.id);
      finalErr = error;
    }
    if (finalErr) throw finalErr;

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

    res.json({ success: true, candidate_job_id: cjRow.id });
  } catch (err: any) {
    console.error('[POST /api/pipelines/:id/candidates/:candidateId/move] error', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipelines/:id/stages
router.post('/:id/stages', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const pipelineId = req.params.id;
    const { title, color, position } = req.body || {};
    const userId = (req as any).user?.id;
    if (!pipelineId || !title || !userId) return res.status(400).json({ error: 'Missing fields' });

    const { data: stage, error } = await supabase
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
    const { id, stageId } = req.params;
    const userId = (req as any).user?.id;
    const { title, color } = req.body || {};
    if (!id || !stageId || !userId) return res.status(400).json({ error: 'Missing fields' });

    const { data: stage, error } = await supabase
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
    const { id, stageId } = req.params;
    const userId = (req as any).user?.id;
    if (!id || !stageId || !userId) return res.status(400).json({ error: 'Missing fields' });

    const { error } = await supabase
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

    const { error } = await supabase
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
