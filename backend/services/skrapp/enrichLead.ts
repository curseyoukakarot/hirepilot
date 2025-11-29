import axios from 'axios';
import { logger } from '../../src/lib/logger';

const SKRAPP_BASE_URL = 'https://api.skrapp.io';
const SKRAPP_API_V2_URL = `${SKRAPP_BASE_URL}/api/v2`;
const PROFILE_SEARCH_ENDPOINT = `${SKRAPP_BASE_URL}/profile/search/email`;
const COMPANY_SEARCH_ENDPOINTS = [
  `${SKRAPP_BASE_URL}/company/search`,
  `${SKRAPP_BASE_URL}/lwh/company/search`,
  `${SKRAPP_API_V2_URL}/company-search`
];
const REQUEST_TIMEOUT = 15000;

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
  result?: Array<any>;
  results?: Array<any>;
}

export interface SkrappEnrichmentResult {
  email?: string | null;
  email_status?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
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

const buildHeaders = (apiKey: string, includeJson = true) => ({
  'X-Access-Key': apiKey,
  Accept: 'application/json',
  ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
  'User-Agent': 'HirePilot/1.0'
});

const normalizeDomain = (value?: string | null) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
};

const deriveCompanyFromDomain = (domain?: string | null) => {
  if (!domain) return undefined;
  const main = domain.split('.')[0];
  return main ? main.replace(/[-_]/g, ' ') : undefined;
};

const isValidEmail = (email?: string | null) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidEmailStatus = (status?: string | null) => {
  if (!status) return false;
  const normalized = String(status).toLowerCase();
  return ['valid', 'ok', 'verified'].includes(normalized);
};

/**
 * Enrich lead email using Skrapp's bulk finder.
 * Falls back gracefully on 404 and only accepts verified emails.
 */
export async function enrichWithSkrapp(
  skrappApiKey: string,
  fullName: string,
  domain: string,
  companyName?: string
): Promise<string | null> {
  try {
    if (!skrappApiKey || !fullName) {
      logger.warn(
        {
          at: 'skrapp.emailFinder',
          hasKey: Boolean(skrappApiKey),
          hasFullName: Boolean(fullName)
        },
        'Missing parameters for email finder'
      );
      return null;
    }

    const { first_name, last_name } = parseFullName(fullName);
    if (!first_name || !last_name) {
      logger.warn({ at: 'skrapp.emailFinder', fullName }, 'Unable to derive first/last name');
      return null;
    }

    const cleanDomain = normalizeDomain(domain);
    const normalizedCompany = (companyName || deriveCompanyFromDomain(cleanDomain))?.trim();
    if (!normalizedCompany && !cleanDomain) {
      logger.warn({ at: 'skrapp.emailFinder', fullName }, 'Email finder requires company or domain');
      return null;
    }

    const finderPayload = [
      {
        firstName: first_name,
        lastName: last_name,
        ...(normalizedCompany ? { company: normalizedCompany } : {}),
        ...(cleanDomain ? { domain: cleanDomain } : {})
      }
    ];

    const response = await axios.post(`${SKRAPP_API_V2_URL}/find_bulk`, finderPayload, {
      headers: buildHeaders(skrappApiKey),
      timeout: REQUEST_TIMEOUT
    });

    const entry = Array.isArray(response.data) ? response.data[0] : null;
    const candidateEmail = entry?.email?.trim();
    const emailStatus = entry?.email_status || entry?.emailStatus || entry?.quality?.status;

    if (candidateEmail && isValidEmail(candidateEmail) && isValidEmailStatus(emailStatus)) {
      logger.info(
        {
          at: 'skrapp.emailFinder',
          emailStatus,
          domain: cleanDomain,
          company: normalizedCompany
        },
        'Email finder success'
      );
      return candidateEmail;
    }

    logger.info(
      {
        at: 'skrapp.emailFinder',
        emailStatus,
        domain: cleanDomain,
        company: normalizedCompany
      },
      'Email finder returned no valid email'
    );
    return null;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      logger.warn({ at: 'skrapp.emailFinder', companyName, domain }, 'Email finder returned 404');
      return null;
    }
    logger.error(
      {
        at: 'skrapp.emailFinder',
        status: error?.response?.status,
        data: error?.response?.data
      },
      error?.message || 'Email finder failed'
    );
    return null;
  }
}

type NormalizedLeadForSkrapp = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  domain: string | null;
  company: string | null;
};

const normalizeLeadForSkrapp = (params: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  domain?: string | null;
  company?: string | null;
}): NormalizedLeadForSkrapp => {
  let firstName = params.firstName?.trim() || '';
  let lastName = params.lastName?.trim() || '';
  const inheritedFull = params.fullName?.trim() || '';

  if ((!firstName || !lastName) && inheritedFull) {
    const parsed = parseFullName(inheritedFull);
    firstName = firstName || parsed.first_name;
    lastName = lastName || parsed.last_name;
  }

  const domain = normalizeDomain(params.domain);
  const company = (params.company?.trim() || deriveCompanyFromDomain(domain)) || '';
  const fullName = (inheritedFull || `${firstName} ${lastName}`.trim()) || null;

  return {
    firstName: firstName || null,
    lastName: lastName || null,
    fullName,
    domain: domain || null,
    company: company || null
  };
};

const fetchSkrappProfileSearch = async (
  apiKey: string,
  companyName?: string | null,
  domain?: string | null
) => {
  if (!companyName && !domain) return null;

  const normalizeWebsite = (value?: string | null) => {
    if (!value) return undefined;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return `https://${value}`;
  };

  const attempts: Array<{ companyName?: string; domain?: string }> = [];
  if (companyName || domain) attempts.push({ companyName: companyName || undefined, domain: domain || undefined });
  if (domain) attempts.push({ domain });
  if (companyName) attempts.push({ companyName });

  for (const attempt of attempts) {
    const params = new URLSearchParams();
    if (attempt.companyName) params.append('companyName', attempt.companyName);
    if (attempt.domain) params.append('companyWebsite', normalizeWebsite(attempt.domain)!);
    params.append('size', '15');

    if (!params.has('companyName') && !params.has('companyWebsite')) continue;

    try {
      const resp = await axios.get(`${PROFILE_SEARCH_ENDPOINT}?${params.toString()}`, {
        headers: buildHeaders(apiKey, false),
        timeout: REQUEST_TIMEOUT
      });
      logger.info(
        { at: 'skrapp.profileSearch', attempt: { companyName: attempt.companyName, domain: attempt.domain } },
        'Profile search succeeded'
      );
      return resp.data;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        logger.info(
          { at: 'skrapp.profileSearch', attempt: { companyName: attempt.companyName, domain: attempt.domain } },
          'Profile search returned 404'
        );
        continue;
      }
      logger.warn(
        {
          at: 'skrapp.profileSearch',
          status: error?.response?.status,
          data: error?.response?.data
        },
        error?.message || 'Profile search failed'
      );
    }
  }

  return null;
};

const pickMatchingProfile = (results: any[] | undefined, firstName?: string | null, lastName?: string | null) => {
  if (!Array.isArray(results) || results.length === 0) return null;
  const firstLower = firstName?.toLowerCase();
  const lastLower = lastName?.toLowerCase();
  if (firstLower && lastLower) {
    const exact = results.find((profile: any) => {
      const candFirst = (profile.first_name || profile.firstName || '').toLowerCase();
      const candLast = (profile.last_name || profile.lastName || '').toLowerCase();
      return candFirst === firstLower && candLast === lastLower;
    });
    if (exact) return exact;
  }
  return results[0];
};

export async function enrichLeadWithSkrappProfileAndCompany(params: {
  apiKey: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  domain?: string | null;
  company?: string | null;
}): Promise<(SkrappEnrichmentResult & { skrappStatus: 'success' | 'no_data' }) | null> {
  if (!params.apiKey) return null;

  const normalized = normalizeLeadForSkrapp(params);
  const enrichment: SkrappEnrichmentResult = {};

  let workingCompany = normalized.company;
  let workingDomain = normalized.domain;
  let profileCompany: any = null;
  let matchedProfile: any = null;

  if (workingCompany || workingDomain) {
    try {
      const companyLookup = await enrichCompanyWithSkrapp(
        params.apiKey,
        workingCompany || workingDomain || undefined
      );
      if (companyLookup) {
        profileCompany = companyLookup;
        workingDomain = companyLookup.domain || companyLookup.company_domain || workingDomain;
        workingCompany = workingCompany || companyLookup.name || workingCompany;
        logger.info(
          { at: 'skrapp.companyResolution', company: companyLookup?.name, domain: workingDomain },
          'Resolved company metadata via Skrapp'
        );
      }
    } catch (err: any) {
      logger.warn(
        { at: 'skrapp.companyResolution', error: err?.message },
        'Company resolution failed; continuing with provided values'
      );
    }
  }

  if (!workingDomain && workingCompany) {
    const derivedDomain = `${workingCompany.toLowerCase().replace(/\s+/g, '')}.com`;
    logger.warn(
      { at: 'skrapp.domainFallback', company: workingCompany, derivedDomain },
      'Falling back to derived domain'
    );
    workingDomain = derivedDomain;
  }

  if (workingCompany || workingDomain) {
    const profileResponse = await fetchSkrappProfileSearch(
      params.apiKey,
      workingCompany,
      workingDomain
    );
    if (profileResponse) {
      profileCompany = profileResponse.company || profileCompany;
      matchedProfile = pickMatchingProfile(
        profileResponse.results,
        normalized.firstName,
        normalized.lastName
      );
      if (profileCompany) {
        workingCompany = workingCompany || profileCompany.name || workingCompany;
        workingDomain = workingDomain || profileCompany.domain || profileCompany.company_domain || workingDomain;
      }
      if (matchedProfile) {
        enrichment.first_name =
          matchedProfile.first_name || matchedProfile.firstName || normalized.firstName || null;
        enrichment.last_name =
          matchedProfile.last_name || matchedProfile.lastName || normalized.lastName || null;
        enrichment.full_name =
          matchedProfile.full_name || matchedProfile.fullName || normalized.fullName || null;
        enrichment.title = matchedProfile.position?.title || matchedProfile.title || null;
        enrichment.location = matchedProfile.location || matchedProfile.geo || null;
        enrichment.linkedin_url = matchedProfile.linkedin_url || matchedProfile.linkedin || null;
        enrichment.avatar_url = matchedProfile.photo || matchedProfile.picture_url || null;
        enrichment.email = matchedProfile.email || enrichment.email || null;
        enrichment.email_status = matchedProfile.email_status || matchedProfile.emailStatus || null;
        enrichment.buying_role = matchedProfile.buying_roles?.[0] || matchedProfile.buying_role || null;
        enrichment.seniority = matchedProfile.seniority || matchedProfile.seniority_level || null;
        enrichment.function = matchedProfile.function || matchedProfile.job_function || null;
        enrichment.gender = matchedProfile.gender || null;
        enrichment.raw_person = matchedProfile;
      }
    }
  }

  if (!profileCompany) {
    profileCompany =
      (await enrichCompanyWithSkrapp(params.apiKey, workingCompany)) ||
      (await enrichCompanyWithSkrapp(params.apiKey, workingDomain));
    if (profileCompany) {
      workingDomain = profileCompany.domain || profileCompany.company_domain || workingDomain;
      workingCompany = workingCompany || profileCompany.name || workingCompany;
    }
  }

  const shouldFetchEmail = !enrichment.email;
  const fullNameForFinder =
    normalized.fullName ||
    [normalized.firstName, normalized.lastName].filter(Boolean).join(' ').trim();
  if (shouldFetchEmail && fullNameForFinder) {
    const emailFromFinder = await enrichWithSkrapp(
      params.apiKey,
      fullNameForFinder,
      workingDomain || '',
      workingCompany || undefined
    );
    if (emailFromFinder) {
      enrichment.email = emailFromFinder;
    }
  }

  if (profileCompany) {
    enrichment.company_domain =
      profileCompany.domain || profileCompany.company_domain || workingDomain || null;
    enrichment.company_industry = profileCompany.industry || profileCompany.company_industry || null;
    enrichment.company_employee_count =
      typeof profileCompany.employee_count === 'number'
        ? profileCompany.employee_count
        : profileCompany.company_employee_count || null;
    enrichment.company_employee_range =
      profileCompany.company_size || profileCompany.employee_count_range || null;
    enrichment.company_revenue_range =
      profileCompany.revenue || profileCompany.company_revenue || null;
    enrichment.company_headquarters = profileCompany.headquarters || profileCompany.address || null;
    enrichment.company_funding = profileCompany.company_funding || profileCompany.funding_total || null;
    enrichment.raw_company = profileCompany;
  }

  const hasUsefulData =
    Boolean(enrichment.email) ||
    Boolean(matchedProfile) ||
    (profileCompany && Object.keys(profileCompany).length > 0);

  if (!hasUsefulData) {
    return { ...enrichment, skrappStatus: 'no_data' };
  }

  return { ...enrichment, skrappStatus: 'success' };
}

/**
 * Company enrichment via Skrapp company-search
 * Returns normalized company object or null
 */
export async function enrichCompanyWithSkrapp(
  skrappApiKey: string,
  keyword?: string | null
): Promise<{
  name?: string;
  domain?: string;
  company_domain?: string;
  website?: string;
  industry?: string;
  type?: string;
  headquarters?: string;
  founded?: string | number;
  size?: string;
  revenue_range?: string;
  company_revenue?: string;
  company_funding?: string;
  company_size?: string;
  company_employee_count?: number;
  company_employee_range?: string;
  linkedin_url?: string;
  crunchbase_url?: string;
  funding_rounds?: number;
  last_funding_amount?: string;
  logo_url?: string;
  employee_count?: number;
} | null> {
  if (!keyword) return null;

  const headers = buildHeaders(skrappApiKey, false);
  const normalizedKw = (keyword || '').trim();
  const cleanDomain = normalizedKw.includes('.') ? normalizeDomain(normalizedKw) : '';

  for (const endpoint of COMPANY_SEARCH_ENDPOINTS) {
    try {
      const resp = await axios.get<SkrappCompanySearchResponse>(endpoint, {
        headers,
        params: {
          kw: normalizedKw || cleanDomain || undefined,
          domain: endpoint.includes('/api/') ? cleanDomain || undefined : undefined
        },
        timeout: REQUEST_TIMEOUT
      });

      const collection =
        resp.data?.company ||
        resp.data?.items ||
        resp.data?.result ||
        resp.data?.results ||
        resp.data;
      const payload = Array.isArray(collection) ? collection[0] : collection;
      if (!payload) continue;

      return {
        name: payload.name || payload.company_name || undefined,
        domain: payload.domain || payload.company_domain || cleanDomain || undefined,
        website: payload.website || payload.site || payload.url || undefined,
        industry: payload.industry || payload.company_industry || undefined,
        type: payload.type || payload.company_type || undefined,
        headquarters: payload.headquarters || payload.address || payload.location || undefined,
        founded: payload.founded || payload.founded_year || undefined,
        size: payload.company_size || payload.employee_count_range || undefined,
        revenue_range: payload.revenue || payload.company_revenue || payload.revenue_range || undefined,
        linkedin_url: payload.linkedin_url || payload.linkedin || undefined,
        crunchbase_url: payload.crunchbase_url || undefined,
        funding_rounds: payload.funding_rounds || undefined,
        last_funding_amount: payload.last_funding_amount || undefined,
        logo_url: payload.logo_url_primary || payload.logo_url_secondary || payload.logo_url || payload.logo || undefined,
        employee_count: typeof payload.employee_count === 'number' ? payload.employee_count : undefined
      };
    } catch (error: any) {
      if (error?.response?.status === 404) {
        continue;
      }
      if (error?.response?.status === 429 || error?.response?.status >= 500) {
        await new Promise(r => setTimeout(r, 750));
        continue;
      }
      logger.warn(
        {
          at: 'skrapp.companySearch',
          endpoint,
          status: error?.response?.status
        },
        error?.message || 'Company search error'
      );
    }
  }

  return null;
}