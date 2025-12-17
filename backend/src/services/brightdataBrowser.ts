import axios from 'axios';
import { brightDataBrowserConfig, isBrightDataBrowserEnabled } from '../config/brightdata';

export type LinkedInRemoteActionType = 'connect_request' | 'send_message';

export interface LinkedInRemoteActionPayload {
  action: LinkedInRemoteActionType;
  linkedinUrl: string;
  message?: string;
}

interface BrowserRunRequest {
  url: string;
  cookies: string;
  action: LinkedInRemoteActionType;
  message?: string;
}

export async function runLinkedInRemoteAction(
  cookies: string,
  payload: LinkedInRemoteActionPayload,
  context: { userId: string; leadId?: string; candidateId?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!isBrightDataBrowserEnabled()) {
    const hasToken = Boolean(brightDataBrowserConfig.apiToken);
    const hasBaseUrl = Boolean(brightDataBrowserConfig.baseUrl);
    console.warn('[BrightDataBrowser] Disabled/misconfigured', {
      hasToken,
      hasBaseUrl,
      envEnabledFlag: String(process.env.BRIGHTDATA_BROWSER_ENABLED || ''),
      baseUrlPreview: brightDataBrowserConfig.baseUrl ? String(brightDataBrowserConfig.baseUrl).slice(0, 32) : null
    });
    return {
      success: false,
      error: `Bright Data Browser API is disabled (hasToken=${hasToken}, hasBaseUrl=${hasBaseUrl})`
    };
  }

  if (!cookies || !payload.linkedinUrl) {
    return { success: false, error: 'Missing cookies or LinkedIn URL' };
  }

  const requestBody: BrowserRunRequest = {
    url: payload.linkedinUrl,
    cookies,
    action: payload.action,
    message: payload.message
  };

  const requestConfig = {
    headers: {
      Authorization: `Bearer ${brightDataBrowserConfig.apiToken}`,
      'Content-Type': 'application/json'
    },
    timeout: 120_000
  };

  console.log('[BrightDataBrowser] Starting action', {
    action: payload.action,
    userId: context.userId,
    leadId: context.leadId,
    candidateId: context.candidateId,
    url: payload.linkedinUrl
  });

  try {
    const response = await axios.post(
      brightDataBrowserConfig.baseUrl!,
      {
        country: brightDataBrowserConfig.country,
        session: {
          cookies: cookies.split(';').map((rawCookie) => {
            const [name, ...rest] = rawCookie.trim().split('=');
            return {
              name,
              value: rest.join('='),
              domain: '.linkedin.com',
              path: '/',
              httpOnly: true,
              secure: true
            };
          })
        },
        actions: [
          {
            run: {
              command: payload.action,
              args: {
                url: payload.linkedinUrl,
                message: payload.message || ''
              }
            }
          }
        ]
      },
      requestConfig
    );

    const runResult = response.data;
    if (runResult?.success === false) {
      console.error('[BrightDataBrowser] Action failed', {
        action: payload.action,
        userId: context.userId,
        leadId: context.leadId,
        candidateId: context.candidateId,
        info: runResult?.error || runResult
      });
      return { success: false, error: runResult?.error || 'Unknown Browser API error' };
    }

    console.log('[BrightDataBrowser] Action completed', {
      action: payload.action,
      userId: context.userId,
      leadId: context.leadId,
      candidateId: context.candidateId
    });
    return { success: true };
  } catch (error: any) {
    console.error('[BrightDataBrowser] Action error', {
      action: payload.action,
      userId: context.userId,
      leadId: context.leadId,
      candidateId: context.candidateId,
      error: error?.message || String(error)
    });
    return { success: false, error: error?.message || 'Browser API request failed' };
  }
}

