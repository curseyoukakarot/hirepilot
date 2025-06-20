import { supabase, supabaseDb } from '../lib/supabase';
import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { ids, force } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'No IDs provided' });
    return;
  }

  // 1. Check for related campaigns
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, title, job_id')
    .in('job_id', ids);
  if (campaignsError) {
    res.status(500).json({ error: campaignsError.message });
    return;
  }

  if (campaigns.length > 0 && !force) {
    // Warn the user, do not delete yet
    res.status(200).json({ warning: true, campaigns });
    return;
  }

  try {
    // 2. If force, delete related campaign_runs, then campaigns, then jobs
    if (campaigns.length > 0 && force) {
      const campaignIds = campaigns.map(c => c.id);
      // Delete campaign_runs for these campaigns
      const { error: delRunsError } = await supabaseDb
        .from('campaign_runs')
        .delete()
        .in('campaign_id', campaignIds);
      if (delRunsError) throw delRunsError;
      // Delete campaigns
      const { error: delCampError } = await supabaseDb
        .from('campaigns')
        .delete()
        .in('id', campaignIds);
      if (delCampError) throw delCampError;
    }
    // 3. Delete the job requisitions
    const { error, count } = await supabaseDb.from('job_requisitions').delete({ count: 'exact' }).in('id', ids);
    if ((count ?? 0) === 0) {
      res.status(404).json({ error: 'Jobs not found or already deleted' });
      return;
    }
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
} 