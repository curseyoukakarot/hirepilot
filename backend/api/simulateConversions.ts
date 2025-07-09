import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { EmailEventService } from '../services/emailEventService';

export default async function simulateConversions(req: Request, res: Response) {
  const { user_id, campaign_id, count = 3 } = req.query;
  
  if (!user_id || !campaign_id) {
    res.status(400).json({ error: 'Missing user_id or campaign_id' });
    return;
  }

  try {
    // Get real lead IDs from the campaign
    const { data: leads, error: leadsError } = await supabaseDb
      .from('leads')
      .select('id')
      .eq('user_id', user_id)
      .eq('campaign_id', campaign_id)
      .limit(10);

    if (leadsError || !leads || leads.length === 0) {
      res.status(400).json({ error: 'No leads found for this campaign' });
      return;
    }

    const results = [];
    const conversionCount = parseInt(count as string) || 3;
    
    for (let i = 0; i < conversionCount && i < leads.length; i++) {
      const conversionEvent = await EmailEventService.storeEvent({
        user_id: user_id as string,
        campaign_id: campaign_id as string,
        lead_id: leads[i].id, // Use real lead ID
        provider: 'system',
        message_id: `simulated_conversion_${Date.now()}_${i}`,
        event_type: 'conversion',
        metadata: {
          simulated: true,
          note: 'Retroactive conversion for leads converted before tracking was fixed',
          timestamp: new Date().toISOString()
        }
      });
      results.push(conversionEvent);
    }

    res.json({
      success: true,
      message: `${conversionCount} conversion events simulated`,
      results
    });

  } catch (error: any) {
    console.error('[simulateConversions] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to simulate conversions' });
  }
} 