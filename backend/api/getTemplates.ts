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
      .from('templates')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { status, data: responseData } = res as any;
    if (status === 200) {
      res.status(200).json({ templates: responseData });
      return;
    }
  } catch (error) {
    console.error('Error fetching templates:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
    return;
  }
};

export default handler;
