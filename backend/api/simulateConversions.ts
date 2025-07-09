import { Request, Response } from 'express';
import { EmailEventService } from '../services/emailEventService';

export default async function simulateConversions(req: Request, res: Response) {
  const { user_id, campaign_id, count = 3 } = req.query;
  
  if (!user_id || !campaign_id) {
    res.status(400).json({ error: 'Missing user_id or campaign_id' });
    return;
  }

  try {
    const results = [];
    const conversionCount = parseInt(count as string) || 3;
    
    for (let i = 0; i < conversionCount; i++) {
      const conversionEvent = await EmailEventService.storeEvent({
        user_id: user_id as string,
        campaign_id: campaign_id as string,
        lead_id: `simulated_lead_${Date.now()}_${i}`,
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