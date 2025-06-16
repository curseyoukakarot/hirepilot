import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { Response } from 'express';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { leadId } = req.params;
    if (!leadId) {
      return res.status(400).json({ error: 'Missing lead ID' });
    }

    // Verify ownership
    const { data: lead, error: fetchError } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { error: deleteError } = await supabaseDb
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('user_id', req.user.id);

    if (deleteError) throw deleteError;

    return res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    return res.status(500).json(errorResponse);
  }
};

export default handler; 