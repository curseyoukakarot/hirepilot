import axios from 'axios';

const SKRAPP_API_URL = 'https://api.skrapp.io/api/v2';

interface SkrappFindByNameRequest {
  first_name: string;
  last_name: string;
  company?: string | null;
  domain?: string | null;
}

interface SkrappFindResponse {
  email?: string | null;
  emailStatus?: 'Valid' | 'Invalid' | 'Catch-All' | string;
}

interface SkrappCompanySearchResponse {
  items?: Array<any>;
  company?: any;
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
  domain: string,
  companyName?: string
): Promise<string | null> {
  try {
    // Validate inputs
    if (!skrappApiKey || !fullName) {
      console.log('[Skrapp] Missing required parameters:', { 
        hasApiKey: !!skrappApiKey, 
        hasFullName: !!fullName, 
        hasDomain: !!domain 
      });
      return null;
    }

    // Clean domain (only if it looks like a real domain)
    const domainStr = String(domain || '').trim();
    const looksLikeDomain = /\./.test(domainStr) && !/\s/.test(domainStr);
    const cleanDomain = looksLikeDomain ? domainStr
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase() : '';

    // Parse full name into components
    const { first_name, last_name } = parseFullName(fullName);

    if (!first_name) {
      console.log('[Skrapp] Invalid name format:', { fullName });
      return null;
    }

    // Extract company name from domain (basic heuristic)
    const company = (companyName && companyName.trim())
      ? companyName.trim()
      : (cleanDomain ? cleanDomain.split('.')[0].replace(/[-_]/g, ' ') : '');

    console.log('[Skrapp] Starting email search:', { 
      first_name, 
      last_name, 
      company,
      domain: cleanDomain,
      apiKeyPrefix: skrappApiKey.substring(0, 8) + '...'
    });

    // Try multiple endpoint variants for compatibility across Skrapp API versions
    const attempts: Array<{ url: string; body: any; label: string; method: 'post' | 'get' }> = [
      {
        url: `${SKRAPP_API_URL}/find`,
        label: 'find(camelCase POST)',
        method: 'post',
        body: { firstName: first_name, lastName: last_name, company: company || null, domain: cleanDomain || null }
      },
      {
        url: `${SKRAPP_API_URL}/find-by-name`,
        label: 'find-by-name(snake_case POST)',
        method: 'post',
        body: { first_name, last_name, company, domain: cleanDomain }
      },
      {
        url: `${SKRAPP_API_URL}/finders/name`,
        label: 'finders/name(camelCase POST)',
        method: 'post',
        body: { firstName: first_name, lastName: last_name, company: company || null, domain: cleanDomain || null }
      },
      {
        url: `https://api.skrapp.io/v2/find`,
        label: 'v2/find(camelCase GET)',
        method: 'get',
        body: { firstName: first_name, lastName: last_name, company: company || null, domain: cleanDomain || null }
      },
      {
        url: `https://api.skrapp.io/v2/find-by-name`,
        label: 'v2/find-by-name(snake_case GET)',
        method: 'get',
        body: { first_name, last_name, company, domain: cleanDomain }
      }
    ];

    let response: any = null;
    let lastError: any = null;
    for (const attempt of attempts) {
      try {
        console.log('[Skrapp] Attempting endpoint:', attempt.label, attempt.url);
        if (attempt.method === 'get') {
          response = await axios.get(
            attempt.url,
            {
              headers: {
                'X-Access-Key': skrappApiKey,
                'Accept': 'application/json',
                'User-Agent': 'HirePilot/1.0'
              },
              params: attempt.body,
              timeout: 10000
            }
          );
        } else {
          response = await axios.post(
            attempt.url,
            attempt.body,
            {
              headers: {
                'X-Access-Key': skrappApiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'HirePilot/1.0'
              },
              timeout: 10000
            }
          );
        }
        if (response?.status && response.status < 400) break;
      } catch (e: any) {
        lastError = e;
        // Retry once for rate limit/server errors on the same attempt
        if (e?.response?.status === 429 || e?.response?.status >= 500) {
          await new Promise(r => setTimeout(r, 750));
          try {
            if (attempt.method === 'get') {
              response = await axios.get(
                attempt.url,
                {
                  headers: {
                    'X-Access-Key': skrappApiKey,
                    'Accept': 'application/json',
                    'User-Agent': 'HirePilot/1.0'
                  },
                  params: attempt.body,
                  timeout: 10000
                }
              );
            } else {
              response = await axios.post(
                attempt.url,
                attempt.body,
                {
                  headers: {
                    'X-Access-Key': skrappApiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'HirePilot/1.0'
                  },
                  timeout: 10000
                }
              );
            }
            if (response?.status && response.status < 400) break;
          } catch (e2: any) {
            lastError = e2;
          }
        }
      }
    }
    if (!response) {
      if (lastError) throw lastError;
      return null;
    }

    console.log('[Skrapp] API response:', {
      status: response.status,
      emailStatus: response.data?.emailStatus || response.data?.status,
      email: (response.data?.email || response.data?.data?.email) ? 'found' : 'not_found'
    });

    const body: SkrappFindResponse = response.data || {};
    // Check if email was found
    const candidateEmail = (body as any)?.email || (response.data?.data?.email ?? null);
    if (!candidateEmail) {
      console.log('[Skrapp] No email found in response');
      return null;
    }

    const email: string = candidateEmail as string;
    const emailStatus: any = (body as any)?.emailStatus || (body as any)?.status || (response.data?.data?.emailStatus);

    // Only accept Valid (treat 'valid' lowercase as valid too)
    if (String(emailStatus || '').toLowerCase() !== 'valid') {
      console.log('[Skrapp] Email status not valid:', { emailStatus });
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
      emailStatus 
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

/**
 * Company enrichment via Skrapp company-search
 * Returns normalized company object or null
 */
export async function enrichCompanyWithSkrapp(skrappApiKey: string, domain: string): Promise<{
  name?: string;
  domain?: string;
  website?: string;
  industry?: string;
  type?: string;
  headquarters?: string;
  founded?: string | number;
  size?: string;
  revenue_range?: string;
  linkedin_url?: string;
  crunchbase_url?: string;
  funding_rounds?: number;
  last_funding_amount?: string;
  logo_url?: string;
} | null> {
  try {
    const cleanDomain = String(domain)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase();

    const url = `${SKRAPP_API_URL}/company-search?domain=${encodeURIComponent(cleanDomain)}`;
    const resp = await axios.get<SkrappCompanySearchResponse>(url, {
      headers: {
        'X-Access-Key': skrappApiKey,
        'Accept': 'application/json',
        'User-Agent': 'HirePilot/1.0'
      },
      timeout: 10000
    });

    const result: any = resp.data?.company || (Array.isArray(resp.data?.items) ? resp.data.items[0] : null);
    if (!result) return null;

    const normalized = {
      name: result.name || result.company_name || undefined,
      domain: result.domain || cleanDomain || undefined,
      website: result.website || result.site || undefined,
      industry: result.industry || undefined,
      type: result.type || undefined,
      headquarters: result.headquarters || result.location || undefined,
      founded: result.founded || result.founded_year || undefined,
      size: result.company_size || result.size || undefined,
      revenue_range: result.revenue_range || result.revenue || undefined,
      linkedin_url: result.linkedin_url || result.linkedin || undefined,
      crunchbase_url: result.crunchbase_url || undefined,
      funding_rounds: result.funding_rounds || undefined,
      last_funding_amount: result.last_funding_amount || undefined,
      logo_url: result.logo_url || result.logo || undefined
    };

    return normalized;
  } catch (error: any) {
    if (error?.response?.status === 429 || error?.response?.status >= 500) {
      try {
        await new Promise(r => setTimeout(r, 750));
        return await enrichCompanyWithSkrapp(skrappApiKey, domain);
      } catch {}
    }
    console.warn('[Skrapp] Company search failed:', error?.message || error);
    return null;
  }
}