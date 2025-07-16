import axios from 'axios';

const SKRAPP_API_URL = 'https://api.skrapp.io/api/v2';

interface SkrappFindByNameRequest {
  first_name: string;
  last_name: string;
  company?: string;
  domain: string;
}

interface SkrappFindByNameResponse {
  success: boolean;
  data: {
    email: string | null;
    confidence_score: number;
    first_name: string;
    last_name: string;
    company: string;
    domain: string;
    position?: string;
    linkedin_url?: string;
    sources: Array<{
      type: string;
      url: string;
      last_seen: string;
    }>;
  };
  message?: string;
}

interface SkrappErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Parse full name into first and last name components
 * @param fullName - Complete name string
 * @returns Object with first_name and last_name
 */
function parseFullName(fullName: string): { first_name: string; last_name: string } {
  const nameParts = fullName
    .replace(/[^\w\s-']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');

  if (nameParts.length === 1) {
    return { first_name: nameParts[0], last_name: '' };
  }

  const first_name = nameParts[0];
  const last_name = nameParts.slice(1).join(' ');
  
  return { first_name, last_name };
}

/**
 * Enrich lead email using Skrapp.io API
 * @param skrappApiKey - User's Skrapp.io API key
 * @param fullName - Full name of the person to search for
 * @param domain - Company domain to search within
 * @returns Email address if found with sufficient confidence (score >= 75), null otherwise
 */
export async function enrichWithSkrapp(
  skrappApiKey: string, 
  fullName: string, 
  domain: string
): Promise<string | null> {
  try {
    // Validate inputs
    if (!skrappApiKey || !fullName || !domain) {
      console.log('[Skrapp] Missing required parameters:', { 
        hasApiKey: !!skrappApiKey, 
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

    // Parse full name into components
    const { first_name, last_name } = parseFullName(fullName);

    if (!first_name) {
      console.log('[Skrapp] Invalid name format:', { fullName });
      return null;
    }

    // Extract company name from domain (basic heuristic)
    const company = cleanDomain
      .split('.')[0]
      .replace(/[-_]/g, ' ')
      .toLowerCase();

    console.log('[Skrapp] Starting email search:', { 
      first_name, 
      last_name, 
      company,
      domain: cleanDomain,
      apiKeyPrefix: skrappApiKey.substring(0, 8) + '...'
    });

    // Prepare request body
    const requestBody: SkrappFindByNameRequest = {
      first_name,
      last_name,
      company,
      domain: cleanDomain
    };

    // Make request to Skrapp.io API
    const response = await axios.post<SkrappFindByNameResponse>(
      `${SKRAPP_API_URL}/find-by-name`, 
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${skrappApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'HirePilot/1.0'
        },
        timeout: 10000
      }
    );

    console.log('[Skrapp] API response:', {
      status: response.status,
      success: response.data?.success,
      confidence_score: response.data?.data?.confidence_score,
      email: response.data?.data?.email ? 'found' : 'not_found'
    });

    // Check if request was successful
    if (!response.data?.success) {
      console.log('[Skrapp] API request failed:', response.data?.message);
      return null;
    }

    // Check if email was found
    if (!response.data?.data?.email) {
      console.log('[Skrapp] No email found in response');
      return null;
    }

    const { email, confidence_score } = response.data.data;

    // Validate confidence score (Skrapp.io uses 0-100 scale)
    if (confidence_score < 75) {
      console.log('[Skrapp] Email found but confidence too low:', { 
        email: email.substring(0, 3) + '***', 
        confidence_score 
      });
      return null;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[Skrapp] Invalid email format:', { email: email.substring(0, 3) + '***' });
      return null;
    }

    console.log('[Skrapp] Email enrichment successful:', { 
      email: email.substring(0, 3) + '***', 
      confidence_score 
    });

    return email;

  } catch (error: any) {
    // Handle specific Skrapp.io API errors
    if (error.response?.status) {
      const status = error.response.status;
      const errorData = error.response.data as SkrappErrorResponse;

      switch (status) {
        case 400:
          console.error('[Skrapp] Bad request - invalid parameters:', errorData?.error);
          break;
        case 401:
          console.error('[Skrapp] API key invalid or expired');
          break;
        case 403:
          console.error('[Skrapp] API key lacks required permissions');
          break;
        case 429:
          console.error('[Skrapp] Rate limit exceeded');
          break;
        case 422:
          console.error('[Skrapp] Unprocessable entity:', errorData?.error);
          break;
        case 500:
          console.error('[Skrapp] Internal server error');
          break;
        default:
          console.error('[Skrapp] API error:', { 
            status, 
            data: errorData,
            message: error.message 
          });
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('[Skrapp] Request timeout');
    } else {
      console.error('[Skrapp] Unexpected error:', error.message);
    }

    // Always return null on errors to gracefully fallback
    return null;
  }
} 