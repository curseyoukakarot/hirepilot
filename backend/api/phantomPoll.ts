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

// GET /api/phantom/poll/:executionId
// Manual polling endpoint to fetch PhantomBuster results
router.get('/poll/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    
    if (!executionId) {
      res.status(400).json({ error: 'Missing execution ID' });
      return;
    }

    console.log('[PhantomBuster Poll] Manually polling for execution:', executionId);

    // Get execution details from database with user and campaign info
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

    if (executionError || !execution) {
      res.status(404).json({ error: 'Campaign execution not found' });
      return;
    }

    const user = execution?.campaigns?.users;
    const campaign = execution?.campaigns;

    // If already completed, return cached status
    if (execution.status === 'completed' || execution.status === 'failed') {
      res.json({ 
        status: execution.status,
        message: 'Execution already processed',
        updated_at: execution.updated_at
      });
      return;
    }

    try {
      // Fetch results directly from PhantomBuster API
      const results = await fetchPhantomBusterResults(executionId);
      
      if (results && results.length > 0) {
        console.log(`[PhantomBuster Poll] Fetched ${results.length} results, processing...`);
        
        // Process the results using the existing webhook handler
        await handlePhantomBusterWebhook(executionId, results);
        
        // Send success notifications
        if (user && campaign) {
          await sendSuccessNotifications(user, campaign, results.length);
        }
        
        res.json({
          status: 'completed',
          message: `Successfully processed ${results.length} leads`,
          leadCount: results.length
        });
      } else {
        // Send no results notification only if campaign is expected to be complete
        if (user && campaign) {
          await sendNoResultsNotifications(user, campaign);
        }
        
        res.json({
          status: 'running',
          message: 'PhantomBuster is still processing or no results yet...'
        });
      }
    } catch (fetchError: any) {
      console.error('[PhantomBuster Poll] Error fetching results:', fetchError);
      
      if (fetchError.message.includes('not found') || fetchError.message.includes('404')) {
        res.json({
          status: 'running',
          message: 'Execution still in progress...'
        });
      } else {
        // Mark as failed
        await supabaseDb
          .from('campaign_executions')
          .update({
            status: 'failed',
            error: fetchError.message,
            updated_at: new Date().toISOString()
          })
          .eq('phantombuster_execution_id', executionId);

        // Send error notifications
        if (user && campaign) {
          await sendErrorNotifications(user, campaign, fetchError.message);
        }

        res.status(500).json({ 
          error: 'Failed to fetch PhantomBuster results',
          details: fetchError.message
        });
      }
    }
  } catch (error: any) {
    console.error('[PhantomBuster Poll] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to poll PhantomBuster execution',
      details: error.stack
    });
  }
});

export default router; 