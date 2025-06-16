import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { enrichLead } from '../services/enrichment';
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

    // Get lead data
    const { data: lead, error: leadError } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', req.user.id)
      .single();

    if (leadError) throw leadError;
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
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

      res.status(200).json({ data: enrichedData });
      return;
    }

    const { status, data: responseData } = res as any;
    if (status === 200) {
      res.status(200).json({ data: responseData });
      return;
    }
  } catch (error) {
    console.error('Error getting enrichment:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to get enrichment data',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler; 