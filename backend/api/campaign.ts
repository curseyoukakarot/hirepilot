import { Request, Response } from 'express';
import { startCampaignFlow, processLead, handlePhantomBusterWebhook } from '../controllers/campaignFlow';
import { triggerLinkedInSearch } from '../services/phantombuster/triggerLinkedInSearch';
import axios from 'axios';
import { supabaseDb } from '../lib/supabase';

export async function startCampaign(req: Request, res: Response) {
  try {
    const { campaignId, searchUrl } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!campaignId || !searchUrl) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
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

export async function triggerLinkedInCampaign(req: Request, res: Response) {
  try {
    const { campaignId, searchUrl } = req.body;
    const userId = req.user?.id;

    console.log('[triggerLinkedInCampaign] Request body:', req.body);
    console.log('[triggerLinkedInCampaign] Extracted values:', { campaignId, searchUrl, userId });

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!campaignId || !searchUrl) {
      console.log('[triggerLinkedInCampaign] Missing fields - campaignId:', !!campaignId, 'searchUrl:', !!searchUrl);
      res.status(400).json({ error: 'Missing required fields: campaignId and searchUrl' });
      return;
    }

    console.log('[triggerLinkedInCampaign] Starting LinkedIn search for campaign:', campaignId);

    const result = await triggerLinkedInSearch({
      searchUrl,
      userId,
      campaignId
    });

    console.log('[triggerLinkedInCampaign] LinkedIn search triggered successfully:', result);

    res.json({
      success: true,
      message: 'LinkedIn search started successfully',
      executionId: result.id,
      status: result.status
    });
  } catch (error: any) {
    console.error('[triggerLinkedInCampaign] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to start LinkedIn search',
      details: error.stack
    });
  }
}

// New polling endpoint to check PhantomBuster status and retrieve results
export async function pollPhantomBusterResults(req: Request, res: Response) {
  try {
    const { executionId } = req.params;
    
    if (!executionId) {
      res.status(400).json({ error: 'Missing execution ID' });
      return;
    }

    console.log('[pollPhantomBusterResults] Checking execution:', executionId);

    // Get execution details from database
    const { data: execution, error: executionError } = await supabaseDb
      .from('campaign_executions')
      .select('*')
      .eq('phantombuster_execution_id', executionId)
      .single();

    if (executionError || !execution) {
      res.status(404).json({ error: 'Campaign execution not found' });
      return;
    }

    // If already completed, return cached status
    if (execution.status === 'completed' || execution.status === 'failed') {
      res.json({ 
        status: execution.status,
        message: 'Execution already processed',
        completed_at: execution.completed_at
      });
      return;
    }

    // Check PhantomBuster API for actual execution ID if we have a temporary one
    let actualExecutionId = executionId;
    if (executionId.startsWith('zapier-')) {
      // This is a temporary ID, we need to find the actual PhantomBuster execution ID
      // For now, we'll skip this step and assume the user provides the real ID
      console.log('[pollPhantomBusterResults] Temporary execution ID detected, cannot poll PhantomBuster directly');
      res.json({ 
        status: 'pending', 
        message: 'Waiting for PhantomBuster completion. Please check back in a few minutes.' 
      });
      return;
    }

    // Poll PhantomBuster API for completion
    const phantomBusterApiKey = process.env.PHANTOMBUSTER_API_KEY;
    if (!phantomBusterApiKey) {
      throw new Error('PhantomBuster API key not configured');
    }

    const pbResponse = await axios.get(
      `https://api.phantombuster.com/api/v2/containers/fetch-output`,
      {
        params: { id: actualExecutionId },
        headers: { 'X-Phantombuster-Key': phantomBusterApiKey },
        timeout: 10000
      }
    );

    const pbStatus = pbResponse.data?.status || 'unknown';
    const pbOutput = pbResponse.data?.output || [];
    const pbError = pbResponse.data?.error;

    console.log('[pollPhantomBusterResults] PhantomBuster status:', pbStatus, 'Output count:', pbOutput.length);

    // Update execution status
    await supabaseDb
      .from('campaign_executions')
      .update({
        status: pbStatus,
        error: pbError,
        updated_at: new Date().toISOString()
      })
      .eq('phantombuster_execution_id', executionId);

    // If completed successfully, process the results
    if (pbStatus === 'success' && pbOutput.length > 0) {
      console.log('[pollPhantomBusterResults] Processing', pbOutput.length, 'results');
      
      try {
        // Process results using existing webhook handler
        await handlePhantomBusterWebhook(executionId, pbOutput);
        
        res.json({
          status: 'completed',
          message: `Successfully processed ${pbOutput.length} leads`,
          leadCount: pbOutput.length
        });
      } catch (processError: any) {
        console.error('[pollPhantomBusterResults] Error processing results:', processError);
        
        // Mark as failed
        await supabaseDb
          .from('campaign_executions')
          .update({
            status: 'failed',
            error: processError.message,
            completed_at: new Date().toISOString()
          })
          .eq('phantombuster_execution_id', executionId);

        res.status(500).json({ 
          error: 'Failed to process PhantomBuster results',
          details: processError.message
        });
      }
    } else if (pbStatus === 'error' || pbStatus === 'failed') {
      // Mark as failed
      await supabaseDb
        .from('campaign_executions')
        .update({
          status: 'failed',
          error: pbError || 'PhantomBuster execution failed',
          completed_at: new Date().toISOString()
        })
        .eq('phantombuster_execution_id', executionId);

      res.json({
        status: 'failed',
        error: pbError || 'PhantomBuster execution failed'
      });
    } else {
      // Still running
      res.json({
        status: pbStatus || 'running',
        message: 'PhantomBuster is still processing...'
      });
    }

  } catch (error: any) {
    console.error('[pollPhantomBusterResults] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to poll PhantomBuster results' 
    });
  }
}

export async function processLeadEndpoint(req: Request, res: Response) {
  try {
    const { leadId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!leadId) {
      res.status(400).json({ error: 'Missing lead ID' });
      return;
    }

    const result = await processLead(leadId);
    res.json(result);
  } catch (error: any) {
    console.error('[processLeadEndpoint] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process lead' });
  }
}

// Debug endpoint to manually trigger webhook processing with test data
export async function debugPhantomBusterWebhook(req: Request, res: Response) {
  try {
    const { executionId } = req.params;
    
    if (!executionId) {
      res.status(400).json({ error: 'Missing execution ID' });
      return;
    }

    console.log('[debugPhantomBusterWebhook] Manually triggering webhook for execution:', executionId);

    // Get execution details from database
    const { data: execution, error: executionError } = await supabaseDb
      .from('campaign_executions')
      .select('*')
      .eq('phantombuster_execution_id', executionId)
      .single();

    if (executionError || !execution) {
      res.status(404).json({ error: 'Campaign execution not found' });
      return;
    }

    // Create dummy test data to verify the webhook processing works
    const testResults = [
      {
        firstName: 'John',
        lastName: 'Doe',
        title: 'Software Engineer',
        company: 'Tech Corp',
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        location: 'San Francisco, CA'
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        title: 'Product Manager',
        company: 'Innovation Inc',
        linkedinUrl: 'https://linkedin.com/in/janesmith',
        location: 'New York, NY'
      }
    ];

    console.log('[debugPhantomBusterWebhook] Processing test results:', testResults.length);

    const result = await handlePhantomBusterWebhook(executionId, testResults);
    
    res.json({
      success: true,
      message: 'Debug webhook processed successfully',
      testDataProcessed: testResults.length,
      result
    });
  } catch (error: any) {
    console.error('[debugPhantomBusterWebhook] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process debug webhook',
      details: error.stack
    });
  }
}

export async function phantomBusterWebhook(req: Request, res: Response) {
  try {
    const { executionId, results } = req.body;

    if (!executionId || !results) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
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