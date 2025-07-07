// backend/api/getApiKeys.ts

import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { Response } from 'express';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabaseDb
      .from('api_keys')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ keys: data });
    return;
  } catch (error) {
    console.error('Error fetching API keys:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch API keys',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
    return;
  }
};

export default handler;
