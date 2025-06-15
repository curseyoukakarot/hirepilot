import { ApiRequest, ApiResponse, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { Lead } from '../types/lead';

interface UpdateLeadRequest {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  website?: string;
  linkedin?: string;
  status?: Lead['status'];
  source?: string;
  notes?: string;
}

const handler: ApiHandler = async (req: ApiRequest, res: ApiResponse) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { leadId } = req.params;
    if (!leadId) {
      return res.status(400).json({ error: 'Missing lead ID' });
    }

    const updateData: UpdateLeadRequest = req.body;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
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

    const { data, error: updateError } = await supabaseDb
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({ lead: data as Lead });
  } catch (error) {
    console.error('Error updating lead:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    return res.status(500).json(errorResponse);
  }
};

export default handler; 