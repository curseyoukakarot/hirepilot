import express, { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

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