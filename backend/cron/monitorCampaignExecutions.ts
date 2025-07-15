import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { handlePhantomBusterWebhook } from '../controllers/campaignFlow';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function monitorCampaignExecutions() {
  try {
    console.log('[monitorCampaignExecutions] Checking for running campaign executions...');
    
    // Find all campaign executions that are still running (but not already being processed)
    const { data: runningExecutions, error } = await supabase
      .from('campaign_executions')
      .select('*')
      .eq('status', 'running') // Only get 'running' status, skip 'processing'
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[monitorCampaignExecutions] Error fetching running executions:', error);
      return;
    }

    if (!runningExecutions || runningExecutions.length === 0) {
      console.log('[monitorCampaignExecutions] No running executions found');
      return;
    }

    console.log(`[monitorCampaignExecutions] Found ${runningExecutions.length} running executions`);

    // Process each running execution
    for (const execution of runningExecutions) {
      try {
        await processPhantomBusterExecution(execution);
      } catch (error) {
        console.error(`[monitorCampaignExecutions] Error processing execution ${execution.id}:`, error);
      }
    }

  } catch (error) {
    console.error('[monitorCampaignExecutions] Error in monitoring process:', error);
  }
}

async function processPhantomBusterExecution(execution: any) {
  const executionId = execution.phantombuster_execution_id;
  const executionAge = new Date().getTime() - new Date(execution.created_at).getTime();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  console.log(`[processPhantomBusterExecution] Processing execution ${executionId} (age: ${Math.round(executionAge / 60000)} minutes)`);

  // If execution is older than 30 minutes, mark it as failed
  if (executionAge > maxAge) {
    console.log(`[processPhantomBusterExecution] Execution ${executionId} is older than 30 minutes, marking as failed`);
    
    await supabase
      .from('campaign_executions')
      .update({
        status: 'failed',
        error: 'Execution timeout - no response from PhantomBuster after 30 minutes',
        updated_at: new Date().toISOString()
      })
      .eq('id', execution.id);
    
    return;
  }

  // Try to fetch results from PhantomBuster
  try {
    const results = await fetchPhantomBusterResults(executionId);
    
    if (results && results.length > 0) {
      console.log(`[processPhantomBusterExecution] Found ${results.length} results for execution ${executionId}`);
      
      // Process the results using the existing webhook handler
      await handlePhantomBusterWebhook(executionId, results);
      
      console.log(`[processPhantomBusterExecution] Successfully processed ${results.length} leads for execution ${executionId}`);
    } else {
      console.log(`[processPhantomBusterExecution] No results found yet for execution ${executionId}`);
    }
  } catch (error: any) {
    console.error(`[processPhantomBusterExecution] Error fetching results for execution ${executionId}:`, error);
    
    // If it's a 404 or similar error, the execution might not exist in PhantomBuster
    if (error.response?.status === 404) {
      console.log(`[processPhantomBusterExecution] Execution ${executionId} not found in PhantomBuster, marking as failed`);
      
      await supabase
        .from('campaign_executions')
        .update({
          status: 'failed',
          error: 'PhantomBuster execution not found',
          updated_at: new Date().toISOString()
        })
        .eq('id', execution.id);
    }
  }
}

async function fetchPhantomBusterResults(executionId: string): Promise<any[]> {
  const phantomBusterApiKey = process.env.PHANTOMBUSTER_API_KEY;
  
  if (!phantomBusterApiKey) {
    throw new Error('PhantomBuster API key not configured');
  }

  console.log(`[fetchPhantomBusterResults] Fetching results for execution ${executionId}`);

  const response = await axios.get('https://api.phantombuster.com/api/v2/containers/fetch-output', {
    params: {
      id: executionId
    },
    headers: {
      'X-Phantombuster-Key': phantomBusterApiKey
    },
    timeout: 10000
  });

  const { output, status } = response.data;
  
  console.log(`[fetchPhantomBusterResults] PhantomBuster status: ${status}, output length: ${output?.length || 0}`);
  
  // If PhantomBuster says it's finished/success, return the results
  if (status === 'finished' || status === 'success') {
    return output || [];
  }
  
  // If there's substantial output data (>1000 chars), likely has results even if status is undefined
  if (output && (typeof output === 'string' ? output.length > 1000 : output.length > 0)) {
    console.log(`[fetchPhantomBusterResults] Found substantial output data despite status: ${status}, processing results`);
    return output;
  }
  
  // If it's still running, return empty array (we'll check again later)
  if (status === 'running') {
    return [];
  }
  
  // If it failed, throw an error
  if (status === 'error' || status === 'failed') {
    throw new Error(`PhantomBuster execution failed with status: ${status}`);
  }
  
  // Unknown status, return empty array
  return [];
} 