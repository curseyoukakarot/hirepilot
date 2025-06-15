import { ApiRequest, ApiResponse, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { Lead } from '../types/lead';

const handler: ApiHandler = async (req: ApiRequest, res: ApiResponse) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ leads: data as Lead[] });
  } catch (error) {
    console.error('Error fetching leads:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch leads',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    return res.status(500).json(errorResponse);
  }
};

export default handler; 