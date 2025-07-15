import axios from 'axios';
import { supabaseDb } from '../../lib/supabase';
import { z } from 'zod';
import crypto from 'crypto';

interface LinkedInSearchParams {
  searchUrl: string;
  userId: string;
  campaignId: string;
}

interface PhantomResponse {
  id: string;
  status: string;
}

// Decryption function for LinkedIn cookies
const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY?.slice(0, 32) || 'default_key_32_bytes_long_123456';

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * NEW: Direct PhantomBuster trigger (bypasses Zapier for lead processing)
 */
export async function triggerLinkedInSearchDirect({ searchUrl, userId, campaignId }: LinkedInSearchParams): Promise<PhantomResponse> {
  try {
    // Validate environment variables
    const phantomBusterApiKey = process.env.PHANTOMBUSTER_API_KEY;
    if (!phantomBusterApiKey) {
      throw new Error('PhantomBuster API key is not set in environment variables.');
    }

    const phantomId = process.env.PHANTOMBUSTER_LINKEDIN_SEARCH_PHANTOM_ID;
    if (!phantomId) {
      throw new Error('PhantomBuster LinkedIn search phantom ID is not set in environment variables.');
    }

    const backendUrl = process.env.BACKEND_URL || 'https://api.thehirepilot.com';

    // Get user's LinkedIn cookie from the linkedin_cookies table
    const { data: cookieData, error: cookieError } = await supabaseDb
      .from('linkedin_cookies')
      .select('session_cookie')
      .eq('user_id', userId)
      .single();

    if (cookieError) {
      throw new Error('Failed to fetch LinkedIn cookie');
    }

    if (!cookieData?.session_cookie) {
      throw new Error('LinkedIn session cookie not found');
    }

    // Decrypt the LinkedIn cookie
    const sessionCookie = decrypt(cookieData.session_cookie);

    // Generate execution ID
    const executionId = `direct-${Date.now()}-${campaignId.slice(0, 8)}`;

    // Store the execution record BEFORE launching
    await supabaseDb
      .from('campaign_executions')
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        phantombuster_execution_id: executionId,
        status: 'started',
        started_at: new Date().toISOString()
      });

    // Prepare PhantomBuster arguments
    const phantomArgs = {
      sessionCookie,
      queries: searchUrl,
      searchType: 'people',
      numberOfProfiles: 50,
      pageLoadDelay: 8000,
      profileLoadDelay: 5000,
      // Add metadata for webhook processing
      campaignId,
      userId,
      executionId,
      // Direct webhook URL (PhantomBuster will call this when done)
      webhookUrl: `${backendUrl}/api/phantombuster/webhook`
    };

    console.log('[triggerLinkedInSearchDirect] Launching PhantomBuster with args:', {
      phantomId,
      sessionCookie: sessionCookie.slice(0, 20) + '...',
      searchUrl,
      campaignId,
      userId,
      executionId
    });

    // Launch PhantomBuster directly
    const response = await axios.post('https://api.phantombuster.com/api/v2/agents/launch', {
      id: phantomId,
      argument: phantomArgs,
      saveArgument: true,
      // Set up webhook for completion notification
      webhook: `${backendUrl}/api/phantombuster/webhook`
    }, {
      headers: {
        'X-Phantombuster-Key': phantomBusterApiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('[triggerLinkedInSearchDirect] PhantomBuster response:', response.data);

    // Update execution record with actual PhantomBuster container ID
    if (response.data?.containerId) {
      await supabaseDb
        .from('campaign_executions')
        .update({
          phantombuster_execution_id: response.data.containerId,
          status: 'running',
          updated_at: new Date().toISOString()
        })
        .eq('phantombuster_execution_id', executionId);
    }

    return {
      id: response.data?.containerId || executionId,
      status: 'started'
    };

  } catch (error: any) {
    console.error('[triggerLinkedInSearchDirect] Error:', error);
    throw new Error(error.message || 'Failed to trigger LinkedIn search');
  }
}

/**
 * Fetch results directly from PhantomBuster API
 */
export async function fetchPhantomBusterResults(executionId: string): Promise<any[]> {
  try {
    const phantomBusterApiKey = process.env.PHANTOMBUSTER_API_KEY;
    if (!phantomBusterApiKey) {
      throw new Error('PhantomBuster API key is not set');
    }

    console.log('[fetchPhantomBusterResults] Fetching results for execution:', executionId);

    const response = await axios.get(`https://api.phantombuster.com/api/v2/containers/fetch-output`, {
      params: {
        id: executionId
      },
      headers: {
        'X-Phantombuster-Key': phantomBusterApiKey
      },
      timeout: 30000
    });

    const { output } = response.data;
    
    console.log('[fetchPhantomBusterResults] Fetched', output?.length || 0, 'results');
    
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
        return parsedOutput || [];
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
                return parsedOutput || [];
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
                    return parsedOutput || [];
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
                  return parsedOutput || [];
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
    
    return output || [];
  } catch (error: any) {
    console.error('[fetchPhantomBusterResults] Error:', error);
    
    if (error.response) {
      console.error('[fetchPhantomBusterResults] PhantomBuster API error:', error.response.data);
      throw new Error(`Failed to fetch results: ${error.response.data?.message || error.response.statusText}`);
    }
    
    throw new Error(error.message || 'Failed to fetch PhantomBuster results');
  }
}

// Schema for validating Zapier payload (keeping for backward compatibility)
const zapierPayloadSchema = z.object({
  phantomId: z.string().min(1),
  sessionCookie: z.string().min(10),
  searchUrl: z.string().url(),
  campaignId: z.string().min(1),
  userId: z.string().min(1),
  notificationWebhook: z.string().url()
});

// Original Zapier-based function (keeping for backward compatibility)
export async function triggerLinkedInSearch({ searchUrl, userId, campaignId }: LinkedInSearchParams): Promise<PhantomResponse> {
  try {
    // Validate environment variables
    const zapierWebhookUrl = process.env.ZAPIER_PHANTOM_WEBHOOK_URL;
    if (!zapierWebhookUrl) {
      throw new Error('Zapier webhook URL is not set in environment variables.');
    }

    const phantomId = process.env.PHANTOMBUSTER_LINKEDIN_SEARCH_PHANTOM_ID;
    if (!phantomId) {
      throw new Error('PhantomBuster LinkedIn search phantom ID is not set in environment variables.');
    }

    const backendUrl = process.env.BACKEND_URL || 'https://api.thehirepilot.com';

    // Get user's LinkedIn cookie from the linkedin_cookies table
    const { data: cookieData, error: cookieError } = await supabaseDb
      .from('linkedin_cookies')
      .select('session_cookie')
      .eq('user_id', userId)
      .single();

    if (cookieError) {
      throw new Error('Failed to fetch LinkedIn cookie');
    }

    if (!cookieData?.session_cookie) {
      throw new Error('LinkedIn session cookie not found');
    }

    // Decrypt the LinkedIn cookie
    const sessionCookie = decrypt(cookieData.session_cookie);

    // Prepare Zapier payload
    const zapierPayload = {
      phantomId,
      sessionCookie: sessionCookie,
      searchUrl,
      campaignId,
      userId,
      notificationWebhook: `${backendUrl}/api/phantom/status-update`
    };

    // Validate payload before sending
    zapierPayloadSchema.parse(zapierPayload);

    // Call Zapier webhook instead of PhantomBuster directly
    const response = await axios.post(zapierWebhookUrl, zapierPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout for Zapier webhook
    });

    // Handle Zapier response
    let executionId: string;
    let status = 'started';

    if (response.data && response.data.executionId) {
      // If Zapier returns the executionId, use it
      executionId = response.data.executionId;
    } else {
      // Fallback: generate a temporary ID for tracking
      // We'll need to poll PhantomBuster API later to get the actual execution ID
      executionId = `zapier-${Date.now()}-${campaignId.slice(0, 6)}`;
      status = 'pending'; // Mark as pending until we can confirm with PhantomBuster
      console.log('[triggerLinkedInSearch] Zapier did not return executionId, using temporary ID:', executionId);
    }

    // Store the execution record
    await supabaseDb
      .from('campaign_executions')
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        phantombuster_execution_id: executionId,
        status,
        started_at: new Date().toISOString()
      });

    return {
      id: executionId,
      status
    };
  } catch (error: any) {
    console.error('[triggerLinkedInSearch] Error:', error);
    throw new Error(error.message || 'Failed to trigger LinkedIn search');
  }
} 