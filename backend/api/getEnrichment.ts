import { ApiRequest, ApiResponse, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { enrichLead } from '../services/enrichment';

const handler: ApiHandler = async (req: ApiRequest, res: ApiResponse) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { leadId } = req.params;
    if (!leadId) {
      return res.status(400).json({ error: 'Missing lead ID' });
    }

    // Get lead data
    const { data: lead, error: leadError } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', req.user.id)
      .single();

    if (leadError) throw leadError;
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get enrichment data
    const { data: enrichment, error: enrichmentError } = await supabaseDb
      .from('enrichment')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (enrichmentError && enrichmentError.code !== 'PGRST116') {
      throw enrichmentError;
    }

    // If no enrichment data exists, enrich the lead
    if (!enrichment) {
      const enrichedData = await enrichLead(lead);
      
      const { error: insertError } = await supabaseDb
        .from('enrichment')
        .insert({
          lead_id: leadId,
          data: enrichedData,
          user_id: req.user.id
        });

      if (insertError) throw insertError;

      return res.status(200).json({ data: enrichedData });
    }

    return res.status(200).json({ data: enrichment.data });
  } catch (error) {
    console.error('Error getting enrichment:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to get enrichment data',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    return res.status(500).json(errorResponse);
  }
};

export default handler; 