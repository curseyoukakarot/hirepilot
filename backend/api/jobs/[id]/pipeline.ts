import { Request, Response } from 'express';
import { supabaseDb } from '../../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = (req as any).user?.id;
    const { id: jobId } = req.params;
    const { stages, name } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    if (!stages || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ error: 'Stages array is required' });
    }

    // Fetch job details and verify ownership
    const { data: job, error: jobError } = await supabaseDb
      .from("job_requisitions")
      .select("user_id, title, department, pipeline_id")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if user owns the job or is a collaborator
    const { data: collaborator } = await supabaseDb
      .from('job_collaborators')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .single();

    if (job.user_id !== userId && !collaborator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Try to create pipeline first
    const pipelineName = name || `${job.title || "Job"} Pipeline`;
    let { data: pipeline, error: pipelineError } = await supabaseDb
      .from("pipelines")
      .insert([{
        job_id: jobId,
        user_id: job.user_id,
        name: pipelineName,
        department: job.department || null,
      }])
      .select()
      .single();

    // If pipeline already exists (unique constraint violation), fetch it instead
    if (pipelineError?.code === "23505") {
      console.warn("Pipeline already exists, reusing existing one...");
      const { data: existing, error: fetchError } = await supabaseDb
        .from("pipelines")
        .select("*")
        .eq("job_id", jobId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch existing pipeline:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch existing pipeline' });
      }
      
      pipeline = existing;
      job.pipeline_id = pipeline.id;

      // Delete old stages before inserting new ones
      const { error: deleteStagesError } = await supabaseDb
        .from("pipeline_stages")
        .delete()
        .eq("pipeline_id", pipeline.id);

      if (deleteStagesError) {
        console.error("Failed to delete old stages:", deleteStagesError);
        return res.status(500).json({ error: 'Failed to delete old stages' });
      }

      console.log('✅ Reusing existing pipeline:', pipeline.id);
    } else if (pipelineError) {
      console.error('Pipeline creation failed:', pipelineError);
      return res.status(500).json({ error: 'Failed to create pipeline' });
    } else {
      console.log('✅ Pipeline created successfully:', pipeline.id);

      // Update job with pipeline_id
      const { error: updateJobError } = await supabaseDb
        .from("job_requisitions")
        .update({ pipeline_id: pipeline.id })
        .eq("id", jobId);

      if (updateJobError) {
        console.error('Failed to update job with pipeline_id:', updateJobError);
        return res.status(500).json({ error: 'Failed to link pipeline to job' });
      }

      job.pipeline_id = pipeline.id;
    }

    // Insert stages using the pipeline ID (either existing or newly created)
    const pipelineId = job.pipeline_id;
    console.log(`Creating stages for pipeline ID: ${pipelineId}`);
    
    const stageRows = stages
      .filter((title: string) => title && title.trim())
      .map((title: string, i: number) => ({
        pipeline_id: pipelineId,
        title: title.trim(),
        position: i + 1,
        color: '#3B82F6', // Default blue color
      }));

    console.log(`Inserting ${stageRows.length} stages:`, stageRows.map(s => s.title));

    const { data: insertedStages, error: stageError } = await supabaseDb
      .from("pipeline_stages")
      .insert(stageRows)
      .select();

    if (stageError) {
      console.error('Stage creation failed:', stageError);
      return res.status(500).json({ error: 'Failed to create pipeline stages' });
    }

    console.log(`✅ Created ${insertedStages?.length || 0} stages for pipeline ${pipelineId}`);

    res.status(200).json({ 
      success: true,
      pipeline_id: job.pipeline_id,
      stages: insertedStages,
      message: `Pipeline created with ${insertedStages.length} stages`
    });

  } catch (error: any) {
    console.error('[POST /api/jobs/[id]/pipeline] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
