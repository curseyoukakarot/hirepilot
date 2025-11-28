import { Request, Response } from 'express';
import { supabaseDb } from '../../../lib/supabase';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.params; // share_id

    console.log('[GET /api/public/jobs/[id]] Request details:', {
      params: req.params,
      id: id,
      idType: typeof id,
      url: req.url,
      originalUrl: req.originalUrl
    });

    if (!id || typeof id !== 'string') {
      console.error('[GET /api/public/jobs/[id]] Invalid share_id:', { id, type: typeof id });
      return res.status(400).json({ error: 'Missing or invalid share_id' });
    }

    console.log('[GET /api/public/jobs/[id]] Fetching job with share_id:', id);

    // Fetch job by share_id - this will work for anonymous users due to service-role client
    const { data, error } = await supabaseDb
      .from('job_requisitions')
      .select(`
        id, 
        title, 
        description,
        status,
        department, 
        location, 
        salary_range, 
        keywords,
        share_id, 
        pipeline_id,
        created_at,
        updated_at
      `)
      .eq('share_id', id)
      .single();

    let jobRow: any = data || null;
    let fetchError: any = error || null;

    // Fallback: resolve via job_shares.uuid_link -> job_requisitions.id
    if (!jobRow) {
      try {
        const { data: share } = await supabaseDb
          .from('job_shares')
          .select('job_id')
          .eq('uuid_link', id)
          .maybeSingle();
        if (share?.job_id) {
          const { data: byId, error: byIdErr } = await supabaseDb
            .from('job_requisitions')
            .select(`
              id, 
              title, 
              description,
              status,
              department, 
              location, 
              salary_range, 
              keywords,
              share_id, 
              pipeline_id,
              created_at,
              updated_at
            `)
            .eq('id', share.job_id)
            .single();
          jobRow = byId || null;
          fetchError = byIdErr || fetchError;
        }
      } catch (e) {
        // keep fetchError as-is; continue to 404 if still null
      }
    }

    if (!jobRow) {
      console.error('Public job fetch error:', fetchError);
      return res.status(404).json({ 
        error: 'Job not found',
        details: fetchError?.message || 'No job found with this share_id or share link'
      });
    }

    // Normalize description with legacy fallback (if future column added)
    const normalizedDescription = String((jobRow as any).description || '').trim();

    // Also fetch pipeline stages if pipeline exists
    let stages = [];
    if (jobRow.pipeline_id) {
      const { data: pipelineStages, error: stageError } = await supabaseDb
        .from('pipeline_stages')
        .select('id, title, position, color')
        .eq('pipeline_id', jobRow.pipeline_id)
        .order('position', { ascending: true });
      if (stageError) {
        console.error('[GET /api/public/jobs/[id]] stage fetch error', stageError);
      }
      
      stages = pipelineStages || [];
    }

    res.status(200).json({ 
      job: {
        ...jobRow,
        description: normalizedDescription,
        rawDescription: jobRow.description,
        stages
      }
    });
  } catch (error: any) {
    console.error('[GET /api/public/jobs/[id]] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
