import { Request, Response } from 'express';
import { supabase as supabaseDb } from '../../lib/supabase';
import axios from 'axios';

interface N8nLinkedInConnectRequest {
  profileUrl: string;
  message: string;
  user_id: string;
  lead_id?: string;
  campaign_id?: string;
}

interface N8nWebhookResponse {
  status: 'success' | 'error' | 'manual_review_needed';
  lead_id?: string;
  error?: string;
  execution_id?: string;
}

interface LinkedInCookieData {
  session_cookie?: string;
  encrypted_cookie?: string;
  li_at?: string;
  jsessionid?: string;
  user_agent?: string;
  is_valid: boolean;
  status?: string;
  expires_at?: string;
}

/**
 * N8N LinkedIn Connect Webhook Handler
 * This endpoint is called BY n8n workflows to request LinkedIn connections
 */
export default async function n8nLinkedInConnectHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profileUrl, message, user_id, lead_id, campaign_id }: N8nLinkedInConnectRequest = req.body;

    // Validate required fields
    if (!profileUrl || !message || !user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: profileUrl, message, and user_id are required' 
      });
    }

    // Validate LinkedIn URL format
    if (!profileUrl.includes('linkedin.com/in/')) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL format' });
    }

    // Validate message length
    if (message.length > 300) {
      return res.status(400).json({ error: 'Message cannot exceed 300 characters' });
    }

    console.log(`[N8N-LinkedInConnect] Processing request for user ${user_id}`);
    console.log(`[N8N-LinkedInConnect] Profile URL: ${profileUrl}`);
    console.log(`[N8N-LinkedInConnect] Message length: ${message.length}`);

    // Retrieve user's LinkedIn cookies
    const cookieData = await getUserLinkedInCookies(user_id);
    if (!cookieData) {
      return res.status(400).json({
        error: 'No valid LinkedIn cookies found for user. Please refresh your LinkedIn session.',
        action_required: 'refresh_cookies'
      });
    }

    // Format cookies for Browserless
    const formattedCookies = formatCookiesForBrowserless(cookieData);
    
    // Prepare Browserless function payload
    const browserlessPayload = createBrowserlessPayload(profileUrl, message, formattedCookies, cookieData.user_agent);

    // Execute LinkedIn connection via Browserless
    const result = await executeBrowserlessFunction(browserlessPayload);

    // Update last_used_at timestamp for cookies
    await updateCookieUsage(user_id);

    // Log the connection attempt
    await logConnectionAttempt({
      user_id,
      lead_id,
      campaign_id,
      profile_url: profileUrl,
      message,
      result: result.status,
      execution_id: result.execution_id,
      error: result.error
    });

    const response: N8nWebhookResponse = {
      status: result.status,
      lead_id,
      execution_id: result.execution_id
    };

    if (result.error) {
      response.error = result.error;
    }

    return res.json(response);

  } catch (error) {
    console.error('[N8N-LinkedInConnect] Error:', error);
    
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

/**
 * Retrieve and decrypt user's LinkedIn cookies
 */
async function getUserLinkedInCookies(userId: string): Promise<LinkedInCookieData | null> {
  try {
    const { data: cookieData, error } = await supabaseDb
      .from('linkedin_cookies')
      .select('session_cookie, encrypted_cookie, li_at, jsessionid, user_agent, is_valid, status, expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !cookieData) {
      console.warn('[N8N-LinkedInConnect] Cookie query result', { error, cookieData });
      return null;
    }

    // Check validity
    if (cookieData.is_valid === false || (cookieData.status && cookieData.status !== 'valid')) {
      console.log('[N8N-LinkedInConnect] Cookie marked invalid');
      return null;
    }

    // Check expiration
    if (cookieData.expires_at) {
      const expiresAt = new Date(cookieData.expires_at);
      if (expiresAt < new Date()) {
        console.log('[N8N-LinkedInConnect] Cookie expired');
        // Mark as invalid
        await supabaseDb
          .from('linkedin_cookies')
          .update({ is_valid: false })
          .eq('user_id', userId);
        return null;
      }
    }

    // Handle decryption if needed
    let decryptedCookie = cookieData.session_cookie;
    if (cookieData.encrypted_cookie && !decryptedCookie) {
      try {
        const { decryptLegacyAesCookie } = await import('../../src/utils/encryption');
        decryptedCookie = decryptLegacyAesCookie(cookieData.encrypted_cookie);
      } catch (decryptError) {
        console.warn('[N8N-LinkedInConnect] Cookie decryption failed:', decryptError);
        return null;
      }
    }

    return {
      ...cookieData,
      session_cookie: decryptedCookie
    };

  } catch (error) {
    console.error('[N8N-LinkedInConnect] Error retrieving cookies:', error);
    return null;
  }
}

/**
 * Format cookies for Browserless page.setCookie()
 */
function formatCookiesForBrowserless(cookieData: LinkedInCookieData): any[] {
  const cookies = [];
  
  // Parse session_cookie if it's a cookie string
  if (cookieData.session_cookie) {
    const cookieEntries = cookieData.session_cookie.split(';').map(part => part.trim()).filter(Boolean);
    
    for (const entry of cookieEntries) {
      const equalIdx = entry.indexOf('=');
      if (equalIdx === -1) continue;
      
      const name = entry.substring(0, equalIdx).trim();
      let value = entry.substring(equalIdx + 1).trim();
      
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      cookies.push({
        name,
        value,
        domain: '.linkedin.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      });
    }
  }

  // Add individual cookies if available
  if (cookieData.li_at) {
    cookies.push({
      name: 'li_at',
      value: cookieData.li_at,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    });
  }

  if (cookieData.jsessionid) {
    cookies.push({
      name: 'JSESSIONID',
      value: cookieData.jsessionid,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax'
    });
  }

  return cookies;
}

/**
 * Create Browserless function payload
 */
function createBrowserlessPayload(profileUrl: string, message: string, cookies: any[], userAgent?: string): any {
  const defaultUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  return {
    context: {
      profileUrl,
      message,
      cookies,
      userAgent: userAgent || defaultUserAgent
    },
    code: `export default async ({ page, context }) => {
      try {
        // Set user agent
        await page.setUserAgent(context.userAgent);
        
        // Set cookies
        if (context.cookies && context.cookies.length > 0) {
          await page.setCookie(...context.cookies);
          console.log('Set cookies:', context.cookies.length);
        }
        
        // Navigate to profile
        console.log('Navigating to:', context.profileUrl);
        await page.goto(context.profileUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        // Wait for page to load
        await page.waitForTimeout(2000);
        
        // Look for Connect button (various selectors)
        const connectSelectors = [
          'button[aria-label*="Connect"]',
          'button:has-text("Connect")',
          'button[data-control-name="connect"]',
          'button.artdeco-button--2:has-text("Connect")'
        ];
        
        let connectButton = null;
        for (const selector of connectSelectors) {
          try {
            connectButton = await page.waitForSelector(selector, { timeout: 5000 });
            if (connectButton) {
              console.log('Found connect button with selector:', selector);
              break;
            }
          } catch (e) {
            console.log('Selector not found:', selector);
          }
        }
        
        if (!connectButton) {
          return { 
            status: 'manual_review_needed', 
            error: 'Connect button not found - may already be connected or page structure changed'
          };
        }
        
        // Click Connect button
        await connectButton.click();
        console.log('Clicked Connect button');
        
        // Wait for modal to appear
        await page.waitForTimeout(1500);
        
        // Look for message textarea
        const messageSelectors = [
          'textarea[name="message"]',
          'textarea[aria-label*="message"]',
          '.send-invite__custom-message textarea',
          '#custom-message'
        ];
        
        let messageField = null;
        for (const selector of messageSelectors) {
          try {
            messageField = await page.waitForSelector(selector, { timeout: 3000 });
            if (messageField) {
              console.log('Found message field with selector:', selector);
              break;
            }
          } catch (e) {
            console.log('Message selector not found:', selector);
          }
        }
        
        if (messageField && context.message) {
          // Clear existing text and type message
          await messageField.click();
          await page.keyboard.selectAll();
          await page.type(messageField, context.message);
          console.log('Typed custom message');
        }
        
        // Look for Send/Send invitation button
        const sendSelectors = [
          'button[aria-label*="Send invitation"]',
          'button[aria-label*="Send now"]',
          'button:has-text("Send invitation")',
          'button:has-text("Send")',
          '.send-invite__actions button[data-control-name="send"]'
        ];
        
        let sendButton = null;
        for (const selector of sendSelectors) {
          try {
            sendButton = await page.waitForSelector(selector, { timeout: 3000 });
            if (sendButton) {
              console.log('Found send button with selector:', selector);
              break;
            }
          } catch (e) {
            console.log('Send selector not found:', selector);
          }
        }
        
        if (!sendButton) {
          return { 
            status: 'manual_review_needed', 
            error: 'Send invitation button not found'
          };
        }
        
        // Click Send button
        await sendButton.click();
        console.log('Clicked Send invitation button');
        
        // Wait for confirmation
        await page.waitForTimeout(2000);
        
        // Check for success indicators
        const successSelectors = [
          '.artdeco-toast-message',
          '[data-test-id="toast-message"]',
          '.ip-fuse-toast__message'
        ];
        
        let successFound = false;
        for (const selector of successSelectors) {
          try {
            const element = await page.waitForSelector(selector, { timeout: 2000 });
            if (element) {
              const text = await element.textContent();
              if (text && (text.includes('invitation sent') || text.includes('Invitation sent'))) {
                successFound = true;
                console.log('Success confirmation found');
                break;
              }
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        return { 
          status: successFound ? 'success' : 'manual_review_needed',
          message: successFound ? 'Connection request sent successfully' : 'Request may have been sent but confirmation unclear'
        };
        
      } catch (error) {
        console.error('Browserless function error:', error);
        return { 
          status: 'error', 
          error: error.message 
        };
      }
    }`
  };
}

/**
 * Execute Browserless function
 */
async function executeBrowserlessFunction(payload: any): Promise<{
  status: 'success' | 'error' | 'manual_review_needed';
  execution_id?: string;
  error?: string;
}> {
  try {
    if (!process.env.BROWSERLESS_TOKEN) {
      throw new Error('BROWSERLESS_TOKEN environment variable is required');
    }

    const browserlessUrl = process.env.BROWSERLESS_URL || 'https://production-sfo.browserless.io';
    const functionUrl = `${browserlessUrl}/chromium/function?token=${process.env.BROWSERLESS_TOKEN}`;

    console.log('[N8N-LinkedInConnect] Executing Browserless function...');
    
    const response = await axios.post(functionUrl, payload, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = response.data;
    console.log('[N8N-LinkedInConnect] Browserless result:', result);

    return {
      status: result.status || 'error',
      execution_id: `browserless-${Date.now()}`,
      error: result.error
    };

  } catch (error) {
    console.error('[N8N-LinkedInConnect] Browserless execution error:', error);
    
    if (axios.isAxiosError(error)) {
      return {
        status: 'error',
        error: `Browserless request failed: ${error.response?.status} ${error.response?.statusText || error.message}`
      };
    }

    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown Browserless error'
    };
  }
}

/**
 * Update cookie usage timestamp
 */
async function updateCookieUsage(userId: string): Promise<void> {
  try {
    await supabaseDb
      .from('linkedin_cookies')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId);
  } catch (error) {
    console.warn('[N8N-LinkedInConnect] Failed to update cookie usage:', error);
  }
}

/**
 * Log connection attempt for tracking and debugging
 */
async function logConnectionAttempt(data: {
  user_id: string;
  lead_id?: string;
  campaign_id?: string;
  profile_url: string;
  message: string;
  result: string;
  execution_id?: string;
  error?: string;
}): Promise<void> {
  try {
    // You may want to create a specific table for this or use existing logging
    console.log('[N8N-LinkedInConnect] Connection attempt logged:', {
      user_id: data.user_id,
      profile_url: data.profile_url,
      result: data.result,
      execution_id: data.execution_id,
      timestamp: new Date().toISOString()
    });
    
    // TODO: Consider storing in database for analytics
    // await supabaseDb.from('linkedin_connection_logs').insert(data);
    
  } catch (error) {
    console.warn('[N8N-LinkedInConnect] Failed to log connection attempt:', error);
  }
}