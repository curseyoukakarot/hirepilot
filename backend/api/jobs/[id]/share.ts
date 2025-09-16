import { Request, Response } from 'express';
import { supabaseDb } from '../../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = (req as any).user?.id;
    const { id: jobId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Verify job ownership
    const { data: job, error: jobError } = await supabaseDb
      .from('job_requisitions')
      .select('id, title, user_id, share_id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    // If job already has a share_id, return it
    if (job.share_id) {
      const publicUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs/share/${job.share_id}`;
      return res.status(200).json({
        success: true,
        share_id: job.share_id,
        public_url: publicUrl,
        message: 'Job is already published'
      });
    }

    // Generate a new share_id for the job
    const { data: updatedJob, error: updateError } = await supabaseDb
      .from('job_requisitions')
      .update({ 
        share_id: crypto.randomUUID(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select('share_id')
      .single();

    if (updateError) {
      console.error('Failed to generate share_id:', updateError);
      return res.status(500).json({ error: 'Failed to publish job' });
    }

    const publicUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs/share/${updatedJob.share_id}`;

    console.log(`✅ Job ${jobId} published with share_id: ${updatedJob.share_id}`);

    res.status(200).json({
      success: true,
      share_id: updatedJob.share_id,
      public_url: publicUrl,
      message: 'Job published successfully'
    });
  } catch (error: any) {
    console.error('[POST /api/jobs/[id]/share] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
