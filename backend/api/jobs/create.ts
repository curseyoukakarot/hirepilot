import { Request, Response } from 'express';
import { supabaseDb } from '../../lib/supabase';
import { createPipelineWithDefaultStages } from '../../lib/pipelineHelpers';
import { requireAuth } from '../../middleware/authMiddleware';

export default async function createJob(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = (req as any).user?.id;
    const { title, department, status, description, location, salary_range } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ error: 'Missing required fields: userId and title' });
    }

    // 1. Create Job Requisition
    const { data: job, error: jobError } = await supabaseDb
      .from('job_requisitions')
      .insert([{
        user_id: userId,
        title,
        department: department || '',
        status: status || 'open',
        description: description || '',
        location: location || '',
        salary_range: salary_range || ''
      }])
      .select('id, title, department, status, created_at')
      .single();

    if (jobError) {
      console.error('[createJob] Job creation error:', jobError);
      return res.status(500).json({ error: jobError.message });
    }

    // 2. Create Pipeline + Default Stages
    try {
      const pipeline = await createPipelineWithDefaultStages(job.id, job.title);
      
      // 3. Update job with pipeline_id
      const { error: updateError } = await supabaseDb
        .from('job_requisitions')
        .update({ pipeline_id: pipeline.id })
        .eq('id', job.id);

      if (updateError) {
        console.error('[createJob] Pipeline update error:', updateError);
        // Don't fail the request, just log the error
      }

      console.log(`✅ Created job ${job.id} with pipeline ${pipeline.id}`);
      
      return res.status(201).json({ 
        success: true, 
        job: { ...job, pipeline_id: pipeline.id },
        pipeline: pipeline
      });
    } catch (pipelineError) {
      console.error('[createJob] Pipeline creation failed:', pipelineError);
      // Return the job even if pipeline creation failed
      return res.status(201).json({ 
        success: true, 
        job,
        warning: 'Job created but pipeline creation failed. You can create a pipeline manually.'
      });
    }
  } catch (error: any) {
    console.error('[createJob] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
