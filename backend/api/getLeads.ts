import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { Lead } from '../types/lead';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get campaign filter from query params
    const campaignId = req.query.campaignId as string;

    // Build query with optional campaign filter
    let query = supabaseDb
      .from('leads')
      .select('*')
      .eq('user_id', req.user.id);
    
    // Add campaign filter if provided
    if (campaignId && campaignId !== 'all') {
      query = query.eq('campaign_id', campaignId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Return the actual data from Supabase
    res.status(200).json(data || []);
    return;
  } catch (error) {
    console.error('Error fetching leads:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch leads',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
    return;
  }
};

export default handler; 