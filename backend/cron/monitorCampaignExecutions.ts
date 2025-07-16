import 'dotenv/config';
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
    
    // If output is a string, try to parse it as JSON
    if (typeof output === 'string') {
      try {
        // Clean the output by removing any log messages before the JSON
        let cleanedOutput = output.trim();
        
        // Remove common log prefixes that can appear before JSON
        const logPrefixes = [
          /^\(node:\d+\) NOTE:.*\n/gm,
          /^\(node:\d+\) WARNING:.*\n/gm,
          /^\(node:\d+\) DeprecationWarning:.*\n/gm,
          /^(WARNING|NOTE|INFO|ERROR):.*\n/gm
        ];
        
        for (const prefix of logPrefixes) {
          cleanedOutput = cleanedOutput.replace(prefix, '');
        }
        
        // Find the first JSON array or object more aggressively
        let jsonStart = -1;
        
        // Look for valid JSON start patterns, prioritizing arrays
        for (let i = 0; i < cleanedOutput.length - 1; i++) {
          const char = cleanedOutput[i];
          const nextChar = cleanedOutput[i + 1];
          
          // Look for array start: [ followed by { or "
          if (char === '[' && (nextChar === '{' || nextChar === '"' || nextChar === '\n' || nextChar === ' ')) {
            jsonStart = i;
            break;
          }
          // Look for object start: { followed by "
          if (char === '{' && (nextChar === '"' || nextChar === '\n' || nextChar === ' ')) {
            jsonStart = i;
            break;
          }
        }
        
        if (jsonStart !== -1) {
          cleanedOutput = cleanedOutput.substring(jsonStart);
          console.log(`[fetchPhantomBusterResults] Found valid JSON starting at position ${jsonStart}`);
        } else {
          console.log(`[fetchPhantomBusterResults] No valid JSON start found, trying fallback`);
          // Fallback: find any [ or { character
          const fallbackStart = Math.min(
            cleanedOutput.indexOf('[') !== -1 ? cleanedOutput.indexOf('[') : Infinity,
            cleanedOutput.indexOf('{') !== -1 ? cleanedOutput.indexOf('{') : Infinity
          );
          
          if (fallbackStart !== Infinity) {
            cleanedOutput = cleanedOutput.substring(fallbackStart);
            console.log(`[fetchPhantomBusterResults] Using fallback JSON start at position ${fallbackStart}`);
          }
        }
        
        const parsedOutput = JSON.parse(cleanedOutput);
        console.log(`[fetchPhantomBusterResults] Successfully parsed JSON string into ${Array.isArray(parsedOutput) ? parsedOutput.length : 'non-array'} results`);
        return parsedOutput;
      } catch (error) {
        console.error(`[fetchPhantomBusterResults] Failed to parse output as JSON:`, error);
        console.log(`[fetchPhantomBusterResults] Raw output sample:`, output.substring(0, 200) + '...');
        
        // Try to extract just the JSON part more aggressively
        try {
          const lines = output.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for lines that start with valid JSON
            if (line.startsWith('[{') || line.startsWith('[') && line.includes('{')) {
              const jsonPart = lines.slice(i).join('\n');
              try {
                const parsedOutput = JSON.parse(jsonPart);
                console.log(`[fetchPhantomBusterResults] Successfully parsed JSON from line ${i}`);
                return parsedOutput;
              } catch (lineParseError) {
                console.log(`[fetchPhantomBusterResults] Line ${i} parsing failed, trying next...`);
                continue;
              }
            }
          }
          
          // Last resort: try to find JSON arrays with lead-like data
          console.log(`[fetchPhantomBusterResults] Trying regex extraction on full output...`);
          
          // Look for arrays that contain objects with typical lead fields
          const leadArrayRegex = /\[[\s\S]*?(?:firstName|lastName|name|title|company|linkedin|profile)[\s\S]*?\]/gi;
          const leadMatches = output.match(leadArrayRegex);
          
          if (leadMatches) {
            console.log(`[fetchPhantomBusterResults] Found ${leadMatches.length} potential lead arrays`);
            for (let i = 0; i < leadMatches.length; i++) {
              const match = leadMatches[i];
              try {
                const parsedOutput = JSON.parse(match);
                if (Array.isArray(parsedOutput) && parsedOutput.length > 0) {
                  // Check if the first object has lead-like fields
                  const firstItem = parsedOutput[0];
                  if (firstItem && typeof firstItem === 'object' && 
                      (firstItem.firstName || firstItem.name || firstItem.title || firstItem.company || firstItem.linkedinUrl || firstItem.profileUrl)) {
                    console.log(`[fetchPhantomBusterResults] Found valid lead array ${i+1} with ${parsedOutput.length} items`);
                    return parsedOutput;
                  }
                }
              } catch (regexParseError) {
                console.log(`[fetchPhantomBusterResults] Lead array ${i+1} parsing failed:`, regexParseError.message);
                continue;
              }
            }
          }
          
          // Fallback: try any JSON array (previous behavior)
          const anyArrayMatches = output.match(/\[[\s\S]*?\]/g);
          if (anyArrayMatches) {
            console.log(`[fetchPhantomBusterResults] Trying ${anyArrayMatches.length} generic arrays as fallback`);
            for (let i = 0; i < anyArrayMatches.length; i++) {
              const match = anyArrayMatches[i];
              try {
                const parsedOutput = JSON.parse(match);
                if (Array.isArray(parsedOutput) && parsedOutput.length > 0) {
                  console.log(`[fetchPhantomBusterResults] Found generic array ${i+1} with ${parsedOutput.length} items`);
                  return parsedOutput;
                }
              } catch (regexParseError) {
                continue;
              }
            }
          }
        } catch (innerError) {
          console.error(`[fetchPhantomBusterResults] Even aggressive parsing failed:`, innerError);
        }
        
        return [];
      }
    }
    
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