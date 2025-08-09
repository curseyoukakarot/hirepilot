import express, { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();

// Get all pipelines for a user
export async function getPipelines(req: Request, res: Response) {
  const { user_id } = req.query;

  if (!user_id) {
    res.status(400).json({ error: 'User ID is required' });
    return;
  }

  try {
    const { data: pipelines, error } = await supabaseDb
      .from('pipelines')
      .select('*')
      .eq('user_id', user_id);

    if (error) {
      console.error('[getPipelines] Error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ pipelines });
    return;
  } catch (err: any) {
    console.error('[getPipelines] Server Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
    return;
  }
}

// POST /api/pipelines
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('[POST /api/pipelines] Body:', req.body);
    const { user_id, name, department, stages } = req.body;
    if (!user_id || !name || !department || !Array.isArray(stages) || stages.length === 0) {
      console.error('[POST /api/pipelines] Missing required fields:', req.body);
      res.status(400).json({ error: 'Missing required fields or stages' });
      return;
    }
    // Insert pipeline
    const { data: pipeline, error: pipelineError } = await supabaseDb
      .from('pipelines')
      .insert({ user_id, name, department })
      .select()
      .single();
    if (pipelineError || !pipeline) {
      console.error('[POST /api/pipelines] Pipeline insert error:', pipelineError);
      res.status(500).json({ error: pipelineError?.message || 'Failed to create pipeline' });
      return;
    }
    // Log the pipeline id before inserting stages
    console.log('[POST /api/pipelines] Using pipeline id for stages:', pipeline.id);
    // Insert stages
    const stageRows = stages.map((stage, idx) => ({
      pipeline_id: pipeline.id,
      name: stage.name,
      title: stage.name,
      icon: stage.icon,
      color: stage.color || 'blue',
      position: idx
    }));
    const { data: insertedStages, error: stagesError } = await supabaseDb
      .from('pipeline_stages')
      .insert(stageRows)
      .select();
    console.log('[POST /api/pipelines] Inserted stages:', insertedStages, 'Error:', stagesError);
    if (stagesError) {
      console.error('[POST /api/pipelines] Stages insert error:', stagesError);
      res.status(500).json({ error: stagesError.message });
      return;
    }
    // Return pipeline with stages
    res.status(200).json({ pipeline: { ...pipeline, stages: insertedStages } });
    return;
  } catch (error: any) {
    console.error('[POST /api/pipelines] Create pipeline error:', error);
    res.status(500).json({ error: error.message || 'Failed to create pipeline' });
    return;
  }
});

export default router; 

// --- New: Move candidate between stages (service role; validates ownership) ---
router.post('/move-candidate', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { candidate_job_id, candidate_id, job_id, dest_stage_id, stage_title } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
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
      const { data, error } = await supabaseDb
        .from('candidate_jobs')
        .select('id, candidate_id, job_id')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Candidate job not found' });
      cjRow = data;
    }

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
    if (dest_stage_id) {
      const { error } = await supabaseDb
        .from('candidate_jobs')
        .update({ stage_id: dest_stage_id, updated_at: now })
        .eq('id', cjRow.id);
      updErr = error;
    }
    if (updErr && (updErr as any).code === '42703') {
      // stage_id column missing; use status text
      // Derive canonical enum from provided stage_title if present
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
      console.error('[move-candidate] update error', updErr);
      return res.status(500).json({ error: 'Failed to move candidate' });
    }

    return res.json({ success: true, candidate_job_id: cjRow.id, dest_stage_id, stage_title: stage_title || null });
  } catch (e: any) {
    console.error('[move-candidate] unexpected', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
});