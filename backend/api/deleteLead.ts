import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { Response } from 'express';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { leadId } = req.params;
    if (!leadId) {
      res.status(400).json({ error: 'Missing lead ID' });
      return;
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
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const { error: deleteError } = await supabaseDb
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('user_id', req.user.id);

    if (deleteError) throw deleteError;

    res.status(200).json({ message: 'Lead deleted successfully' });
    return;
  } catch (error) {
    console.error('Error deleting lead:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
    return;
  }
};

export default handler; 