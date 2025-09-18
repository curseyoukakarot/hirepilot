import { Request, Response } from 'express';
import { supabaseDb } from '../../lib/supabase';
import { createPipelineWithDefaultStages } from '../../lib/pipelineHelpers';
import { notifySlack } from '../../lib/slack';
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

    // Use RPC function to atomically create job with pipeline and default stages
    const { data: jobId, error: rpcError } = await supabaseDb.rpc('create_job_with_pipeline', {
      job_title: title,
      job_user: userId,
      job_department: department || null
    });

    if (rpcError) {
      console.error('[createJob] RPC function failed:', rpcError);
      return res.status(500).json({ error: rpcError.message });
    }

    // Fetch the created job details
    const { data: job, error: jobError } = await supabaseDb
      .from('job_requisitions')
      .select('id, title, department, status, pipeline_id, created_at')
      .eq('id', jobId)
      .single();

    if (jobError) {
      console.error('[createJob] Job fetch error:', jobError);
      return res.status(500).json({ error: 'Job created but failed to fetch details' });
    }

    console.log(`✅ Created job ${jobId} with pipeline ${job.pipeline_id} using RPC function`);

    // Fire-and-forget Slack notification
    try {
      const userEmail = (req as any).user?.email || '';
      await notifySlack(`💼 Job created: ${job?.title || title} (job_id=${jobId}) by ${userEmail || 'unknown user'}`);
    } catch (e) {
      console.warn('[createJob] Slack notify failed (non-fatal):', (e as any)?.message || e);
    }
    
    return res.status(201).json({ 
      success: true, 
      jobId: jobId,
      job: job,
      message: 'Job created with pipeline and default stages'
    });
  } catch (error: any) {
    console.error('[createJob] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
