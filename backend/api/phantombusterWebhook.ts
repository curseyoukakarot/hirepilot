import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { handlePhantomBusterWebhook } from '../controllers/campaignFlow';
import { fetchPhantomBusterResults } from '../services/phantombuster/triggerLinkedInSearch';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PhantomBuster webhook payload schema
const phantomWebhookSchema = z.object({
  id: z.string().min(1, 'Execution ID is required'),
  status: z.string().min(1, 'Status is required'),
  containerId: z.string().optional(),
  agentId: z.string().optional(),
  // Custom fields we add
  campaignId: z.string().optional(),
  userId: z.string().optional(),
  executionId: z.string().optional()
});

// POST /api/phantombuster/webhook
// This endpoint receives direct webhook calls from PhantomBuster
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('[PhantomBuster Webhook] Received payload:', JSON.stringify(req.body, null, 2));
    
    const webhookData = phantomWebhookSchema.parse(req.body);
    const { id, status, containerId, agentId, campaignId, userId, executionId } = webhookData;
    
    // Use the containerId as the execution ID if available, otherwise use id
    const phantomExecutionId = containerId || id;
    
    console.log(`[PhantomBuster Webhook] Processing execution ${phantomExecutionId} with status: ${status}`);

    // Only process if the execution is finished/completed
    if (status === 'finished' || status === 'completed') {
      console.log('[PhantomBuster Webhook] Execution completed, fetching results...');
      
      try {
        // Fetch results from PhantomBuster API
        const results = await fetchPhantomBusterResults(phantomExecutionId);
        
        console.log(`[PhantomBuster Webhook] Fetched ${results.length} results`);
        
        if (results.length > 0) {
          // Process results using existing handler
          await handlePhantomBusterWebhook(phantomExecutionId, results);
          
          console.log('[PhantomBuster Webhook] Results processed successfully');
          res.json({ 
            success: true, 
            message: `Processed ${results.length} leads`,
            leadCount: results.length
          });
        } else {
          console.log('[PhantomBuster Webhook] No results found');
          
          // Update execution status even if no results
          await supabase
            .from('campaign_executions')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('phantombuster_execution_id', phantomExecutionId);
            
          res.json({ 
            success: true, 
            message: 'No results found',
            leadCount: 0
          });
        }
      } catch (processingError: any) {
        console.error('[PhantomBuster Webhook] Error processing results:', processingError);
        
        // Mark execution as failed
        await supabase
          .from('campaign_executions')
          .update({
            status: 'failed',
            error: processingError.message,
            updated_at: new Date().toISOString()
          })
          .eq('phantombuster_execution_id', phantomExecutionId);
          
        res.status(500).json({ 
          success: false, 
          error: 'Failed to process results',
          details: processingError.message
        });
      }
    } else if (status === 'error' || status === 'failed') {
      console.log('[PhantomBuster Webhook] Execution failed');
      
      // Mark execution as failed
      await supabase
        .from('campaign_executions')
        .update({
          status: 'failed',
          error: 'PhantomBuster execution failed',
          updated_at: new Date().toISOString()
        })
        .eq('phantombuster_execution_id', phantomExecutionId);
        
      res.json({ 
        success: false, 
        message: 'Execution failed',
        status: status
      });
    } else {
      console.log(`[PhantomBuster Webhook] Execution status: ${status} - no action needed`);
      
      // Update execution status
      await supabase
        .from('campaign_executions')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('phantombuster_execution_id', phantomExecutionId);
        
      res.json({ 
        success: true, 
        message: `Status updated to ${status}`,
        status: status
      });
    }
  } catch (error: any) {
    console.error('[PhantomBuster Webhook] Error:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Failed to process webhook' 
    });
  }
});

export default router; 