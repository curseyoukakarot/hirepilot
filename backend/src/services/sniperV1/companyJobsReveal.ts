import axios from 'axios';
import { sniperSupabaseDb } from './supabase';
import { CreditService } from '../../../services/creditService';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CompanyInput = {
  company_name: string;
  company_url?: string | null;
};

type ResolvedOrg = {
  apollo_org_id: string;
  name: string;
  domain?: string;
  industry?: string;
  estimated_num_employees?: number;
  raw: any;
};

export type RevealResult = {
  company_name: string;
  company_key: string;
  already_revealed: boolean;
  data?: any;
  credits_charged: number;
  error?: string;
};

type JobPosting = {
  title: string | null;
  url: string | null;
  location: string | null;
  department: string | null;
  posted_at: string | null;
};

/* ------------------------------------------------------------------ */
/*  Company key helpers                                                */
/* ------------------------------------------------------------------ */

export function extractLinkedInCompanySlug(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}

export function deriveCompanyKey(companyName: string, companyUrl?: string | null): string {
  if (companyUrl) {
    const slug = extractLinkedInCompanySlug(companyUrl);
    if (slug) return `li:${slug}`;
  }
  return `name:${companyName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}

/* ------------------------------------------------------------------ */
/*  Apollo API key resolution                                          */
/* ------------------------------------------------------------------ */

async function resolveApolloKey(userId: string): Promise<{ apiKey: string; usingPersonalKey: boolean }> {
  // 1. Personal key (no credits charged — user's own Apollo account)
  try {
    const { data: settings } = await sniperSupabaseDb
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .maybeSingle();

    if (settings?.apollo_api_key) {
      return { apiKey: settings.apollo_api_key, usingPersonalKey: true };
    }
  } catch {
    // non-fatal
  }

  // 2. Super admin key (credits charged)
  if (process.env.SUPER_ADMIN_APOLLO_API_KEY) {
    return { apiKey: process.env.SUPER_ADMIN_APOLLO_API_KEY, usingPersonalKey: false };
  }

  // 3. Platform key (credits charged)
  if (process.env.HIREPILOT_APOLLO_API_KEY) {
    return { apiKey: process.env.HIREPILOT_APOLLO_API_KEY, usingPersonalKey: false };
  }

  throw new Error('No Apollo API key available');
}

/* ------------------------------------------------------------------ */
/*  Apollo Organization Search                                         */
/*  (Pattern from zapierRouter.ts:53-94)                               */
/* ------------------------------------------------------------------ */

async function resolveCompanyToApolloOrg(
  apiKey: string,
  companyName: string,
  companyUrl?: string | null,
): Promise<ResolvedOrg | null> {
  const urls = [
    'https://api.apollo.io/api/v1/organizations/search',
    'https://api.apollo.io/v1/organizations/search',
  ];

  const params: any = {
    page: 1,
    per_page: 5,
    q_organization_name: companyName,
    api_key: apiKey,
  };

  let lastErr: any = null;
  for (const url of urls) {
    try {
      const resp = await axios.get(url, {
        params,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey,
        },
        timeout: 15000,
      });

      const orgs = (resp.data?.organizations || []) as any[];
      if (!orgs.length) return null;

      // Pick best match: prefer exact name match, then first result
      const nameLower = companyName.toLowerCase().trim();
      const linkedinSlug = extractLinkedInCompanySlug(companyUrl);

      const best =
        orgs.find((o: any) => o.name?.toLowerCase().trim() === nameLower) ||
        (linkedinSlug && orgs.find((o: any) => o.linkedin_url?.toLowerCase().includes(linkedinSlug))) ||
        orgs[0];

      return {
        apollo_org_id: best.id,
        name: best.name || companyName,
        domain: best.website_url || best.primary_domain,
        industry: best.industry,
        estimated_num_employees: best.estimated_num_employees,
        raw: {
          name: best.name,
          domain: best.website_url || best.primary_domain,
          industry: best.industry,
          estimated_num_employees: best.estimated_num_employees,
          linkedin_url: best.linkedin_url,
          founded_year: best.founded_year,
          city: best.city,
          state: best.state,
          country: best.country,
        },
      };
    } catch (e: any) {
      lastErr = e;
    }
  }

  console.error('[companyJobsReveal] Failed to resolve org:', companyName, lastErr?.message);
  return null;
}

/* ------------------------------------------------------------------ */
/*  Apollo Organization Job Postings                                    */
/* ------------------------------------------------------------------ */

async function fetchOrgJobPostings(
  apiKey: string,
  apolloOrgId: string,
  page = 1,
  perPage = 50,
): Promise<{ postings: JobPosting[]; total: number }> {
  const resp = await axios.get(
    `https://api.apollo.io/api/v1/organizations/${apolloOrgId}/job_postings`,
    {
      params: { page, per_page: perPage, api_key: apiKey },
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      timeout: 20000,
    },
  );

  const raw = resp.data?.job_postings || [];
  const postings: JobPosting[] = raw.map((jp: any) => ({
    title: jp.title || null,
    url: jp.url || jp.linkedin_url || null,
    location: jp.location || jp.city || null,
    department: jp.department || jp.function || null,
    posted_at: jp.posted_at || jp.last_seen_at || null,
  }));

  return {
    postings,
    total: resp.data?.pagination?.total_entries || postings.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Reveal orchestrator (single company)                               */
/* ------------------------------------------------------------------ */

export async function revealCompanyOpenJobs(params: {
  userId: string;
  workspaceId: string;
  companyName: string;
  companyUrl?: string | null;
}): Promise<RevealResult> {
  const companyKey = deriveCompanyKey(params.companyName, params.companyUrl);

  // 1. Check if already revealed (dedup)
  const { data: existing } = await sniperSupabaseDb
    .from('company_open_jobs')
    .select('*')
    .eq('workspace_id', params.workspaceId)
    .eq('company_key', companyKey)
    .maybeSingle();

  if (existing) {
    return {
      company_name: params.companyName,
      company_key: companyKey,
      already_revealed: true,
      data: existing,
      credits_charged: 0,
    };
  }

  // 2. Resolve Apollo API key
  const { apiKey, usingPersonalKey } = await resolveApolloKey(params.userId);

  // 3. Credit check (skip if personal key)
  if (!usingPersonalKey) {
    const hasCredits = await CreditService.hasSufficientCredits(params.userId, 2);
    if (!hasCredits) {
      throw new Error('Insufficient credits');
    }
  }

  // 4. Resolve company → Apollo org
  const org = await resolveCompanyToApolloOrg(apiKey, params.companyName, params.companyUrl);
  if (!org) {
    return {
      company_name: params.companyName,
      company_key: companyKey,
      already_revealed: false,
      credits_charged: 0,
      error: 'company_not_found',
    };
  }

  // 5. Fetch job postings
  let postings: JobPosting[] = [];
  let total = 0;
  try {
    const result = await fetchOrgJobPostings(apiKey, org.apollo_org_id);
    postings = result.postings;
    total = result.total;
  } catch (e: any) {
    console.error('[companyJobsReveal] Failed to fetch job postings:', params.companyName, e?.message);
    return {
      company_name: params.companyName,
      company_key: companyKey,
      already_revealed: false,
      credits_charged: 0,
      error: 'job_postings_fetch_failed',
    };
  }

  // 6. Store results
  const creditsCharged = usingPersonalKey ? 0 : 2;
  const { data: row, error: upsertErr } = await sniperSupabaseDb
    .from('company_open_jobs')
    .upsert(
      {
        workspace_id: params.workspaceId,
        revealed_by: params.userId,
        company_name: params.companyName,
        company_url: params.companyUrl || null,
        apollo_org_id: org.apollo_org_id,
        company_key: companyKey,
        job_postings: postings,
        apollo_org_data: org.raw,
        credits_charged: creditsCharged,
        using_personal_key: usingPersonalKey,
      },
      { onConflict: 'workspace_id,company_key' },
    )
    .select('*')
    .single();

  if (upsertErr) {
    console.error('[companyJobsReveal] Upsert error:', upsertErr);
    throw upsertErr;
  }

  // 7. Deduct credits (only if platform key used)
  if (!usingPersonalKey) {
    try {
      await CreditService.deductCredits(
        params.userId,
        2,
        'api_usage',
        `Open Jobs Reveal: ${params.companyName} (${total} postings)`,
      );
    } catch (creditErr) {
      console.error('[companyJobsReveal] Credit deduction failed (non-fatal):', creditErr);
    }
  }

  return {
    company_name: params.companyName,
    company_key: companyKey,
    already_revealed: false,
    data: row,
    credits_charged: creditsCharged,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch reveal (used by the API route)                               */
/* ------------------------------------------------------------------ */

export async function batchRevealCompanyOpenJobs(params: {
  userId: string;
  workspaceId: string;
  companies: CompanyInput[];
}): Promise<{ results: RevealResult[]; totalCreditsCharged: number; usingPersonalKey: boolean }> {
  const { userId, workspaceId, companies } = params;

  // Deduplicate companies by key
  const seen = new Set<string>();
  const unique: CompanyInput[] = [];
  for (const c of companies) {
    const key = deriveCompanyKey(c.company_name, c.company_url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  // Check which companies are already revealed (batch query)
  const companyKeys = unique.map((c) => deriveCompanyKey(c.company_name, c.company_url));
  const { data: existingRows } = await sniperSupabaseDb
    .from('company_open_jobs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('company_key', companyKeys);

  const existingKeys = new Set((existingRows || []).map((e: any) => e.company_key));
  const newCompanies = unique.filter((c) => !existingKeys.has(deriveCompanyKey(c.company_name, c.company_url)));

  // Resolve Apollo API key
  const { apiKey: _key, usingPersonalKey } = await resolveApolloKey(userId);

  // Credit check for new companies only
  const creditsNeeded = usingPersonalKey ? 0 : newCompanies.length * 2;
  if (creditsNeeded > 0) {
    const hasCredits = await CreditService.hasSufficientCredits(userId, creditsNeeded);
    if (!hasCredits) {
      const remaining = await CreditService.getRemainingCredits(userId);
      throw Object.assign(new Error('Insufficient credits'), {
        statusCode: 402,
        required: creditsNeeded,
        remaining,
        new_companies_count: newCompanies.length,
      });
    }
  }

  // Process each new company sequentially (avoid Apollo rate limits)
  const results: RevealResult[] = [];
  let totalCreditsCharged = 0;

  // Include already-revealed companies in results
  for (const row of existingRows || []) {
    results.push({
      company_name: row.company_name,
      company_key: row.company_key,
      already_revealed: true,
      data: row,
      credits_charged: 0,
    });
  }

  // Process new companies
  for (const company of newCompanies) {
    try {
      const result = await revealCompanyOpenJobs({
        userId,
        workspaceId,
        companyName: company.company_name,
        companyUrl: company.company_url,
      });
      results.push(result);
      totalCreditsCharged += result.credits_charged;
    } catch (e: any) {
      results.push({
        company_name: company.company_name,
        company_key: deriveCompanyKey(company.company_name, company.company_url),
        already_revealed: false,
        credits_charged: 0,
        error: e?.message || 'unknown_error',
      });
    }
  }

  return { results, totalCreditsCharged, usingPersonalKey };
}
