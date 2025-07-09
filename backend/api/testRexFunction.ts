import { Request, Response } from 'express';
import { getCampaignLeadCount } from '../tools/rexToolFunctions';

export default async function testRexFunction(req: Request, res: Response) {
  try {
    const { userId, campaignId } = req.query;
    
    if (!userId || !campaignId) {
      res.status(400).json({ error: 'Missing userId or campaignId' });
      return;
    }

    console.log('Testing getCampaignLeadCount with:', { userId, campaignId });
    
    const result = await getCampaignLeadCount({
      userId: userId as string,
      campaignId: campaignId as string
    });
    
    console.log('getCampaignLeadCount result:', result);
    
    res.json({ 
      success: true,
      function: 'getCampaignLeadCount',
      result 
    });
  } catch (error: any) {
    console.error('getCampaignLeadCount error:', error);
    res.status(500).json({ 
      error: error.message || 'Function failed',
      details: error 
    });
  }
} 