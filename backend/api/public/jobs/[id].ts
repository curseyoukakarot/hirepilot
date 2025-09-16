import { Request, Response } from 'express';
import { supabaseDb } from '../../../lib/supabase';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.params; // share_id

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid share_id' });
    }

    console.log('[GET /api/public/jobs/[id]] Fetching job with share_id:', id);

    // Fetch job by share_id - this will work for anonymous users due to RLS
    const { data, error } = await supabaseDb
      .from('job_requisitions')
      .select(`
        id, 
        title, 
        description, 
        department, 
        location, 
        salary_range, 
        share_id, 
        pipeline_id,
        created_at,
        updated_at
      `)
      .eq('share_id', id)
      .single();

    if (error || !data) {
      console.error('Public job fetch error:', error);
      return res.status(404).json({ 
        error: 'Job not found',
        details: error?.message || 'No job found with this share_id'
      });
    }

    // Also fetch pipeline stages if pipeline exists
    let stages = [];
    if (data.pipeline_id) {
      const { data: pipelineStages } = await supabaseDb
        .from('pipeline_stages')
        .select('id, title, position, color')
        .eq('pipeline_id', data.pipeline_id)
        .order('position', { ascending: true });
      
      stages = pipelineStages || [];
    }

    res.status(200).json({ 
      job: {
        ...data,
        stages
      }
    });
  } catch (error: any) {
    console.error('[GET /api/public/jobs/[id]] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
