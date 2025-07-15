import express, { Request, Response } from 'express';
import { fetchPhantomBusterResults } from '../services/phantombuster/triggerLinkedInSearch';
import { handlePhantomBusterWebhook } from '../controllers/campaignFlow';
import { supabaseDb } from '../lib/supabase';
import { 
  sendSuccessNotifications, 
  sendNoResultsNotifications, 
  sendErrorNotifications 
} from '../services/phantomNotificationService';

const router = express.Router();

// POST /api/phantom/status-update
// PhantomBuster calls this webhook when execution status changes
router.post('/status-update', async (req: Request, res: Response) => {
  try {
    console.log('[PhantomBuster Status] Received notification:', JSON.stringify(req.body, null, 2));
    
    const { executionId, agentId, status, containerId } = req.body;

    if (!executionId) {
      console.error('[PhantomBuster Status] Missing executionId in notification');
      res.status(400).json({ error: 'Missing executionId in notification' });
      return;
    }

    console.log(`[PhantomBuster Status] Execution ${executionId} status: ${status}`);

    // Update the execution status in the database
    const { error: updateError } = await supabaseDb
      .from('campaign_executions')
      .update({
        status: status || 'unknown',
        updated_at: new Date().toISOString(),
        metadata: {
          phantom_notification: req.body
        }
      })
      .eq('phantombuster_execution_id', executionId);

    if (updateError) {
      console.error('[PhantomBuster Status] Failed to update execution status:', updateError);
    }

    // Get user and campaign details for notifications
    const { data: execution, error: executionError } = await supabaseDb
      .from('campaign_executions')
      .select(`
        *,
        campaigns (
          id,
          title,
          user_id,
          users (
            id,
            email,
            first_name,
            last_name
          )
        )
      `)
      .eq('phantombuster_execution_id', executionId)
      .single();

    const user = execution?.campaigns?.users;
    const campaign = execution?.campaigns;

    // If the execution completed successfully, fetch the results
    if (status === 'success') {
      console.log('[PhantomBuster Status] Execution completed successfully, fetching results...');
      
      try {
        // Fetch results directly from PhantomBuster API
        const results = await fetchPhantomBusterResults(executionId);
        
        if (results && results.length > 0) {
          console.log(`[PhantomBuster Status] Fetched ${results.length} results, processing...`);
          
          // Process the results using the existing webhook handler
          await handlePhantomBusterWebhook(executionId, results);
          
          console.log('[PhantomBuster Status] Successfully processed results');

          // Send success notifications
          if (user && campaign) {
            await sendSuccessNotifications(user, campaign, results.length);
          }
        } else {
          console.log('[PhantomBuster Status] No results found for execution');
          
          // Send no results notification
          if (user && campaign) {
            await sendNoResultsNotifications(user, campaign);
          }
        }
      } catch (fetchError: any) {
        console.error('[PhantomBuster Status] Error fetching/processing results:', fetchError);
        
        // Mark execution as failed
        await supabaseDb
          .from('campaign_executions')
          .update({
            status: 'failed',
            error: `Failed to fetch results: ${fetchError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('phantombuster_execution_id', executionId);

        // Send error notifications
        if (user && campaign) {
          await sendErrorNotifications(user, campaign, fetchError.message);
        }
      }
    } else if (status === 'error' || status === 'failed') {
      console.log(`[PhantomBuster Status] Execution failed with status: ${status}`);
      
      // Update status to failed
      await supabaseDb
        .from('campaign_executions')
        .update({
          status: 'failed',
          error: `PhantomBuster execution failed: ${status}`,
          updated_at: new Date().toISOString()
        })
        .eq('phantombuster_execution_id', executionId);

      // Send failure notifications
      if (user && campaign) {
        await sendErrorNotifications(user, campaign, `PhantomBuster execution failed: ${status}`);
      }
    }

    res.json({
      success: true,
      message: 'Notification processed successfully',
      executionId,
      status
    });
  } catch (error: any) {
    console.error('[PhantomBuster Status] Error processing notification:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process PhantomBuster status notification',
      details: error.stack
    });
  }
});



export default router; 