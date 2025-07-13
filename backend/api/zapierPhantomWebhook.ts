import express, { Request, Response } from 'express';
import { handlePhantomBusterWebhook } from '../controllers/campaignFlow';

const router = express.Router();

// POST /api/zapier/phantom/webhook
// This endpoint receives PhantomBuster results via Zapier
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('[Zapier Phantom Webhook] Received payload:', JSON.stringify(req.body, null, 2));
    
    const { executionId, results, status } = req.body;

    if (!executionId) {
      console.error('[Zapier Phantom Webhook] Missing executionId in payload');
      res.status(400).json({ error: 'Missing executionId in payload' });
      return;
    }

    if (!results || !Array.isArray(results)) {
      console.error('[Zapier Phantom Webhook] Missing or invalid results array');
      res.status(400).json({ error: 'Missing or invalid results array' });
      return;
    }

    console.log(`[Zapier Phantom Webhook] Processing ${results.length} results for execution ${executionId}`);

    // Process the results using the existing handler
    const result = await handlePhantomBusterWebhook(executionId, results);
    
    console.log('[Zapier Phantom Webhook] Successfully processed results');
    
    res.json({
      success: true,
      message: `Successfully processed ${results.length} leads`,
      leadCount: results.length,
      executionId
    });
  } catch (error: any) {
    console.error('[Zapier Phantom Webhook] Error processing webhook:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process Zapier PhantomBuster webhook',
      details: error.stack
    });
  }
});

export default router; 