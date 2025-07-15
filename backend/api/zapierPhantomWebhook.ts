import express, { Request, Response } from 'express';
import { handlePhantomBusterWebhook } from '../controllers/campaignFlow';
import { sendSuccessNotifications, sendNoResultsNotifications, sendErrorNotifications } from '../services/phantomNotificationService';
import { supabaseDb } from '../lib/supabase';

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

    // Get user and campaign details for notifications
    const { data: execution, error: executionError } = await supabaseDb
      .from('campaign_executions')
      .select('user_id, campaign_id')
      .eq('phantombuster_execution_id', executionId)
      .single();

    if (execution && !executionError) {
      const { data: user, error: userError } = await supabaseDb
        .from('users')
        .select('email, firstName, lastName')
        .eq('id', execution.user_id)
        .single();

      const { data: campaign, error: campaignError } = await supabaseDb
        .from('campaigns')
        .select('title, description')
        .eq('id', execution.campaign_id)
        .single();

      // Send notifications based on results
      if (user && campaign && !userError && !campaignError) {
        if (results.length > 0) {
          console.log(`[Zapier Phantom Webhook] Sending success notifications for ${results.length} leads`);
          await sendSuccessNotifications(user, campaign, results.length);
        } else {
          console.log('[Zapier Phantom Webhook] Sending no results notification');
          await sendNoResultsNotifications(user, campaign);
        }
      } else {
        console.warn('[Zapier Phantom Webhook] Could not send notifications - user or campaign not found');
      }
    } else {
      console.warn('[Zapier Phantom Webhook] Could not send notifications - execution not found');
    }
    
    res.json({
      success: true,
      message: `Successfully processed ${results.length} leads`,
      leadCount: results.length,
      executionId
    });
  } catch (error: any) {
    console.error('[Zapier Phantom Webhook] Error processing webhook:', error);
    
    // Try to send error notifications
    try {
      const { executionId } = req.body;
      if (executionId) {
        const { data: execution, error: executionError } = await supabaseDb
          .from('campaign_executions')
          .select('user_id, campaign_id')
          .eq('phantombuster_execution_id', executionId)
          .single();

        if (execution && !executionError) {
          const { data: user, error: userError } = await supabaseDb
            .from('users')
            .select('email, firstName, lastName')
            .eq('id', execution.user_id)
            .single();

          const { data: campaign, error: campaignError } = await supabaseDb
            .from('campaigns')
            .select('title, description')
            .eq('id', execution.campaign_id)
            .single();

          if (user && campaign && !userError && !campaignError) {
            console.log('[Zapier Phantom Webhook] Sending error notifications');
            await sendErrorNotifications(user, campaign, error.message);
          }
        }
      }
    } catch (notificationError) {
      console.error('[Zapier Phantom Webhook] Failed to send error notifications:', notificationError);
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to process Zapier PhantomBuster webhook',
      details: error.stack
    });
  }
});

export default router; 