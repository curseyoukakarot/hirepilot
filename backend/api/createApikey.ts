// backend/api/getApiKeys.ts

import { ApiRequest, ApiResponse, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const handler: ApiHandler = async (req: ApiRequest, res: ApiResponse) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey = uuidv4();
    const { error } = await supabaseDb
      .from('api_keys')
      .insert({
        user_id: req.user.id,
        key: apiKey,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    res.status(200).json({ apiKey });
  } catch (error) {
    console.error('Error creating API key:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to create API key',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
