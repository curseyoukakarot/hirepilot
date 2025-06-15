// backend/api/getApiKeys.ts

import { ApiRequest, ApiResponse, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';

const handler: ApiHandler = async (req: ApiRequest, res: ApiResponse) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabaseDb
      .from('api_keys')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = res as any;
    if (result.status === 200) {
      return res.status(200).json({ keys: data });
    }
  } catch (error) {
    console.error('Error fetching API keys:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch API keys',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    return res.status(500).json(errorResponse);
  }
};

export default handler;
