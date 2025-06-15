import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// Get stages for a job
router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify job ownership
    const { data: job, error: jobError } = await supabase
      .from('job_requisitions')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get stages
    const { data: stages, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('job_id', jobId)
      .order('position', { ascending: true });

    if (error) throw error;

    res.json(stages);
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stages' });
  }
});

// Create a new stage
router.post('/', async (req: Request, res: Response) => {
  try {
    const { jobId, title, color, position } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify job ownership
    const { data: job, error: jobError } = await supabase
      .from('job_requisitions')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Create stage
    const { data: stage, error } = await supabase
      .from('pipeline_stages')
      .insert({
        job_id: jobId,
        title,
        color,
        position
      })
      .select()
      .single();

    if (error) throw error;

    res.json(stage);
  } catch (error) {
    console.error('Error creating pipeline stage:', error);
    res.status(500).json({ error: 'Failed to create pipeline stage' });
  }
});

// Update a stage
router.put('/:stageId', async (req: Request, res: Response) => {
  try {
    const { stageId } = req.params;
    const { title, color, position } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify stage ownership through job
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('job_id')
      .eq('id', stageId)
      .single();

    if (stageError || !stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const { data: job, error: jobError } = await supabase
      .from('job_requisitions')
      .select('id')
      .eq('id', stage.job_id)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update stage
    const { data: updatedStage, error } = await supabase
      .from('pipeline_stages')
      .update({
        title,
        color,
        position
      })
      .eq('id', stageId)
      .select()
      .single();

    if (error) throw error;

    res.json(updatedStage);
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
    res.status(500).json({ error: 'Failed to update pipeline stage' });
  }
});

// Delete a stage
router.delete('/:stageId', async (req: Request, res: Response) => {
  try {
    const { stageId } = req.params;
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify stage ownership through job
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('job_id')
      .eq('id', stageId)
      .single();

    if (stageError || !stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const { data: job, error: jobError } = await supabase
      .from('job_requisitions')
      .select('id')
      .eq('id', stage.job_id)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete stage
    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', stageId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pipeline stage:', error);
    res.status(500).json({ error: 'Failed to delete pipeline stage' });
  }
});

// Reorder stages
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const { stages } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify all stages belong to user's jobs
    const stageIds = stages.map((s: any) => s.id);
    const { data: existingStages, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('id, job_id')
      .in('id', stageIds);

    if (stageError) throw stageError;

    const jobIds = [...new Set(existingStages.map((s: any) => s.job_id))];
    const { data: jobs, error: jobError } = await supabase
      .from('job_requisitions')
      .select('id')
      .in('id', jobIds)
      .eq('user_id', userId);

    if (jobError) throw jobError;

    if (jobs.length !== jobIds.length) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update positions
    const updates = stages.map((stage: any) => ({
      id: stage.id,
      position: stage.position
    }));

    const { error } = await supabase
      .from('pipeline_stages')
      .upsert(updates);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering pipeline stages:', error);
    res.status(500).json({ error: 'Failed to reorder pipeline stages' });
  }
});

export default router; 