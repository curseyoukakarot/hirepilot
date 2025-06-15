import { Request, Response } from 'express';
import { supabaseDb } from '../../../lib/supabase';
import { EnrichmentService } from '../../../services/enrichmentService';
import { requireAuth } from '../../../middleware/authMiddleware';

// Initialize enrichment service with both required parameters
const enrichmentService = new EnrichmentService(
  supabaseDb,
  process.env.APOLLO_API_KEY || ''
);

export default async function handler(
  req: Request,
  res: Response
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Get user from auth middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const campaignId = req.params.id;

    // 2. Get campaign and verify ownership
    const { data: campaign } = await supabaseDb
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status === 'enriching') {
      return res.status(409).json({ error: 'Campaign is already being enriched' });
    }

    // 3. Get all unenriched leads
    const { data: leads } = await supabaseDb
      .from('leads')
      .select('apollo_id')
      .eq('campaign_id', campaignId)
      .eq('is_unlocked', false);

    if (!leads?.length) {
      return res.status(400).json({ error: 'No leads to enrich' });
    }

    // 4. Queue enrichment job
    const apolloIds = leads.map(lead => lead.apollo_id);
    const job = await enrichmentService.queueEnrichmentJob({
      campaignId,
      userId,
      apolloIds
    });

    // 5. Return accepted response with job details
    return res.status(202).json({
      message: 'Enrichment job queued',
      job_id: job.id,
      total_leads: apolloIds.length,
      status: job.status
    });

  } catch (error: any) {
    console.error('Campaign go-live error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to start campaign enrichment'
    });
  }
} 