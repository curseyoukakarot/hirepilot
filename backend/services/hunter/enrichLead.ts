import axios from 'axios';

const HUNTER_API_URL = 'https://api.hunter.io/v2';

interface HunterEmailFinderResponse {
  data: {
    email: string | null;
    score: number;
    result?: string;
    verification?: { status?: string };
  };
}

interface HunterErrorResponse {
  errors: Array<{
    id: string;
    code: number;
    details: string;
  }>;
}

/**
 * Enrich lead email using Hunter.io API
 * @param hunterApiKey - User's Hunter.io API key
 * @param fullName - Full name of the person to search for
 * @param domain - Company domain to search within
 * @returns Email address if found with sufficient confidence (score >= 70), null otherwise
 */
export async function enrichWithHunter(
  hunterApiKey: string, 
  fullName: string, 
  domain: string
): Promise<string | null> {
  try {
    // Validate inputs
    if (!hunterApiKey || !fullName || !domain) {
      console.log('[Hunter] Missing required parameters:', { 
        hasApiKey: !!hunterApiKey, 
        hasFullName: !!fullName, 
        hasDomain: !!domain 
      });
      return null;
    }

    // Clean domain (remove protocol, www, etc.)
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase();

    // Split into first and last for Hunter recommended params
    const nameClean = fullName
      .replace(/[^\w\s-']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const parts = nameClean.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ');

    console.log('[Hunter] Starting email search:', { firstName, lastName, domain: cleanDomain, apiKeyPrefix: hunterApiKey.substring(0, 8) + '...' });

    async function requestOnce() {
      return axios.get<HunterEmailFinderResponse>(`${HUNTER_API_URL}/email-finder`, {
        params: {
          domain: cleanDomain,
          first_name: firstName,
          last_name: lastName,
          api_key: hunterApiKey
        },
        headers: { 'Accept': 'application/json', 'User-Agent': 'HirePilot/1.0' },
        timeout: 10000
      });
    }

    let response: any;
    try {
      response = await requestOnce();
    } catch (e: any) {
      if (e?.response?.status === 429 || e?.response?.status >= 500) {
        console.warn('[Hunter] First attempt failed, retrying once...', e?.response?.status);
        await new Promise(r => setTimeout(r, 750));
        response = await requestOnce();
      } else {
        throw e;
      }
    }

    console.log('[Hunter] API response:', {
      status: response.status,
      result: response.data?.data?.result,
      score: response.data?.data?.score,
      email: response.data?.data?.email ? 'found' : 'not_found'
    });

    // Check if email was found
    if (!response.data?.data?.email) {
      console.log('[Hunter] No email found in response');
      return null;
    }

    const { email, score } = response.data.data;

    // Enforce valid verification status
    const status = response.data?.data?.verification?.status || null;
    if (status !== 'valid') {
      console.log('[Hunter] Email found but verification not valid:', { status, score });
      return null;
    }
    if (typeof score === 'number' && score < 70) {
      console.log('[Hunter] Email valid but confidence too low:', { score });
      return null;
    }

    console.log('[Hunter] Email enrichment successful:', { 
      email: email.substring(0, 3) + '***', 
      score
    });

    return email;

  } catch (error: any) {
    // Handle specific Hunter.io API errors
    if (error.response?.status) {
      const status = error.response.status;
      const errorData = error.response.data as HunterErrorResponse;

      switch (status) {
        case 401:
          console.error('[Hunter] API key invalid or expired');
          break;
        case 403:
          console.error('[Hunter] API key lacks required permissions');
          break;
        case 429:
          console.error('[Hunter] Rate limit exceeded');
          break;
        case 422:
          console.error('[Hunter] Invalid parameters:', errorData?.errors);
          break;
        default:
          console.error('[Hunter] API error:', { 
            status, 
            data: errorData,
            message: error.message 
          });
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('[Hunter] Request timeout');
    } else {
      console.error('[Hunter] Unexpected error:', error.message);
    }

    // Always return null on errors to gracefully fallback
    return null;
  }
} 