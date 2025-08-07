// backend/api/getCampaigns.ts

import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function getCampaigns(req: Request, res: Response) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      res.status(400).json({ error: 'Missing user_id' });
      return;
    }

    console.log('Incoming user_id:', user_id);
    
    // Get campaigns with lead counts
    const { data: campaigns, error } = await supabaseDb
      .from('campaigns')
      .select(`
        *,
        total_leads:leads(count)
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    // Transform the data to include lead counts in a usable format
    const campaignsWithCounts = campaigns?.map(campaign => ({
      ...campaign,
      total_leads: campaign.total_leads?.[0]?.count || 0,
      enriched_leads: 0 // Will be calculated separately if needed
    }));

    console.log('Campaigns returned:', campaignsWithCounts);

    if (error) {
      console.error('[getCampaigns Error]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ campaigns: campaignsWithCounts || [] });
    return;
  } catch (error: any) {
    console.error('[getCampaigns Error]', error);
    res.status(500).json({ error: error.message || 'Failed to fetch campaigns' });
    return;
  }
}
