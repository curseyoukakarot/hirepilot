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

export interface SkrappEnrichmentResult {
  email?: string | null;
  buying_role?: string | null;
  seniority?: string | null;
  function?: string | null;
  gender?: string | null;
  company_domain?: string | null;
  company_industry?: string | null;
  company_employee_count?: number | null;
  company_employee_range?: string | null;
  company_revenue_range?: string | null;
  company_headquarters?: string | null;
  company_funding?: string | null;
  technologies?: string[] | null;
  keywords?: string[] | null;
  raw_person?: any;
  raw_company?: any;
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

    // Try the documented Email Finder endpoint (GET /api/v2/find)
    const attempts: Array<{ url: string; body: any; label: string; method: 'post' | 'get' }> = [
      {
        url: `${SKRAPP_API_URL}/find`,
        label: 'find(GET)',
        method: 'get',
        body: { firstName: first_name, lastName: last_name, fullName: `${first_name} ${last_name}`.trim(), company: company || undefined, domain: cleanDomain || undefined, includeCompanyData: true }
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
      emailStatus: response.data?.quality?.status || response.data?.emailStatus || response.data?.status,
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
    const emailStatus: any = response.data?.quality?.status || (body as any)?.emailStatus || (body as any)?.status || (response.data?.data?.emailStatus);

    // Only accept Valid (treat 'valid' lowercase as valid too)
    if (!['valid','ok'].includes(String(emailStatus || '').toLowerCase())) {
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

async function fetchCompanyByName(apiKey: string, companyName: string): Promise<any> {
  const attempts = [
    { params: { query: companyName }, label: 'company-search(query)' },
    { params: { company: companyName }, label: 'company-search(company)' }
  ];

  for (const attempt of attempts) {
    try {
      const resp = await axios.get<SkrappCompanySearchResponse>(`${SKRAPP_API_URL}/company-search`, {
        headers: {
          'X-Access-Key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'HirePilot/1.0'
        },
        params: attempt.params,
        timeout: 10000
      });
      const payload = resp.data?.company || (Array.isArray(resp.data?.items) ? resp.data.items[0] : null);
      if (payload) {
        return payload;
      }
    } catch (err: any) {
      console.warn('[Skrapp] Company search by name failed:', attempt.label, err?.message || err);
    }
  }

  return null;
}

export async function enrichLeadWithSkrappProfileAndCompany(params: {
  apiKey: string;
  firstName?: string | null;
  lastName?: string | null;
  domain?: string | null;
  company?: string | null;
  emailNeeded: boolean;
}): Promise<SkrappEnrichmentResult | null> {
  const { apiKey, firstName, lastName, domain, company, emailNeeded } = params;

  if (!apiKey) {
    return null;
  }

  const cleanDomain = String(domain || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();

  const trimmedFirst = firstName?.trim() || '';
  const trimmedLast = lastName?.trim() || '';

  let personPayload: any = null;
  let email: string | null = null;

  if (emailNeeded && trimmedFirst) {
    try {
      const resp = await axios.get(`${SKRAPP_API_URL}/find`, {
        headers: {
          'X-Access-Key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'HirePilot/1.0'
        },
        params: {
          firstName: trimmedFirst,
          lastName: trimmedLast || undefined,
          domain: cleanDomain || undefined,
          company: company || undefined,
          includeCompanyData: true
        },
        timeout: 10000
      });
      personPayload = resp.data || null;
      const candidateEmail = resp.data?.email || resp.data?.data?.email || null;
      const emailStatus = resp.data?.quality?.status || resp.data?.emailStatus || resp.data?.status;
      if (
        candidateEmail &&
        ['valid', 'ok'].includes(String(emailStatus || '').toLowerCase())
      ) {
        email = candidateEmail;
      }
    } catch (err: any) {
      console.warn('[Skrapp] Profile lookup failed:', err?.message || err);
    }
  }

  let companyPayload: any = null;
  if (cleanDomain) {
    companyPayload = await enrichCompanyWithSkrapp(apiKey, cleanDomain).catch(() => null);
  }
  if (!companyPayload && company) {
    companyPayload = await fetchCompanyByName(apiKey, company.trim());
  }

  if (!email && !companyPayload && !personPayload) {
    return null;
  }

  const asNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
    return Number.isNaN(parsed) ? null : parsed;
  };

  const result: SkrappEnrichmentResult = {
    email: email || null,
    buying_role: personPayload?.buying_role || (Array.isArray(personPayload?.buying_roles) ? personPayload.buying_roles[0] : null),
    seniority: personPayload?.seniority || personPayload?.seniority_level || null,
    function: personPayload?.function || personPayload?.job_function || null,
    gender: personPayload?.gender || null,
    company_domain: companyPayload?.domain || companyPayload?.company_domain || cleanDomain || null,
    company_industry: companyPayload?.industry || companyPayload?.company_industry || null,
    company_employee_count: asNumber(
      companyPayload?.employee_count ?? companyPayload?.company_employee_count
    ),
    company_employee_range: companyPayload?.company_employee_range || companyPayload?.company_size || null,
    company_revenue_range: companyPayload?.company_revenue_range || companyPayload?.revenue_range || null,
    company_headquarters: companyPayload?.headquarters || companyPayload?.company_headquarters || companyPayload?.location || null,
    company_funding: companyPayload?.company_funding || companyPayload?.funding_total || null,
    technologies: Array.isArray(companyPayload?.technologies)
      ? companyPayload.technologies
      : Array.isArray(personPayload?.technologies)
        ? personPayload.technologies
        : null,
    keywords: Array.isArray(companyPayload?.keywords)
      ? companyPayload.keywords
      : Array.isArray(personPayload?.keywords)
        ? personPayload.keywords
        : null,
    raw_person: personPayload || null,
    raw_company: companyPayload || null
  };

  return result;
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