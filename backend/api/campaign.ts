import { Request, Response } from 'express';
import { startCampaignFlow, processLead, handlePhantomBusterWebhook } from '../controllers/campaignFlow';

export async function startCampaign(req: Request, res: Response) {
  try {
    const { campaignId, searchUrl } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!campaignId || !searchUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await startCampaignFlow({
      campaignId,
      userId,
      searchUrl
    });

    res.json(result);
  } catch (error: any) {
    console.error('[startCampaign] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to start campaign' });
  }
}

export async function processLeadEndpoint(req: Request, res: Response) {
  try {
    const { leadId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!leadId) {
      return res.status(400).json({ error: 'Missing lead ID' });
    }

    const result = await processLead(leadId);
    res.json(result);
  } catch (error: any) {
    console.error('[processLeadEndpoint] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process lead' });
  }
}

export async function phantomBusterWebhook(req: Request, res: Response) {
  try {
    const { executionId, results } = req.body;

    if (!executionId || !results) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify webhook signature if needed
    // const signature = req.headers['x-phantombuster-signature'];
    // if (!verifySignature(signature, req.body)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    const result = await handlePhantomBusterWebhook(executionId, results);
    res.json(result);
  } catch (error: any) {
    console.error('[phantomBusterWebhook] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process webhook' });
  }
} 