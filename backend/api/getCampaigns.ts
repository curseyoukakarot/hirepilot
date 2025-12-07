// backend/api/getCampaigns.ts

import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { resolveAnalyticsScope } from '../lib/analyticsScope';

export default async function getCampaigns(req: Request, res: Response) {
  try {
    const viewerId = (req as any)?.user?.id as string | undefined;

    if (!viewerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const scope = await resolveAnalyticsScope(viewerId);
    if (!scope.allowed) {
      const code = 'code' in scope ? scope.code : 'analytics_denied';
      const status = code === 'analytics_sharing_disabled' ? 403 : 401;
      res.status(status).json({ error: code });
      return;
    }

    const targetUserIds = scope.targetUserIds && scope.targetUserIds.length ? scope.targetUserIds : [viewerId];
    
    // Get campaigns with lead counts
    let query = supabaseDb
      .from('campaigns')
      .select(`
        *,
        total_leads:leads(count)
      `)
      .order('created_at', { ascending: false });

    if (targetUserIds.length === 1) {
      query = query.eq('user_id', targetUserIds[0]);
    } else {
      query = query.in('user_id', targetUserIds);
    }

    const { data: campaigns, error } = await query;

    // Transform the data to include lead counts in a usable format
    const campaignsWithCounts = campaigns?.map(campaign => ({
      ...campaign,
      total_leads: campaign.total_leads?.[0]?.count || 0,
      enriched_leads: 0 // Will be calculated separately if needed
    }));

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
