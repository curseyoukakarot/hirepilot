import axios from 'axios';
import { brightDataConfig, isBrightDataEnabled } from '../config/brightdata';

export interface BrightDataProfile {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  location?: string;
  current_title?: string;
  current_company?: string;
  about?: string;
  profile_url?: string;
  avatar_url?: string;
  experience?: Array<{
    title?: string;
    company?: string;
    location?: string;
    start_date?: string;
    end_date?: string | null;
    description?: string;
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    field_of_study?: string;
    start_year?: number;
    end_year?: number | null;
  }>;
  skills?: string[];
  _raw?: any;
}

export interface BrightDataJob {
  job_title?: string;
  company_name?: string;
  location?: string;
  employment_type?: string;
  salary_text?: string;
  job_description?: string;
  job_url?: string;
  source?: string;
  _raw?: any;
}

interface BrightDataScrapeResult<T> {
  payload: T | null;
  raw: any;
}

interface BrightDataDatasetSnapshot<T> {
  payload: T | null;
  raw: any;
}

interface CollectorArgs {
  [key: string]: unknown;
}

const POLL_TIMEOUT_MS = brightDataConfig.maxPollMs;
const POLL_INTERVAL_MS = brightDataConfig.pollIntervalMs;
const DATASET_TRIGGER_URL = 'https://api.brightdata.com/datasets/v3/trigger';
const DATASET_SNAPSHOT_URL = 'https://api.brightdata.com/datasets/v3/snapshots';
const DATASET_SCRAPE_URL = 'https://api.brightdata.com/datasets/v3/scrape';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requireApiToken() {
  if (!brightDataConfig.apiToken) {
    throw new Error('Bright Data API token missing');
  }
  return {
    Authorization: `Bearer ${brightDataConfig.apiToken}`,
    'Content-Type': 'application/json'
  };
}

// Ensure we always send https for LinkedIn profile URLs
function normalizeLinkedInUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  let normalized = url.trim();
  if (normalized.startsWith('http://')) {
    normalized = 'https://' + normalized.slice('http://'.length);
  }
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function buildDatasetTriggerUrl(datasetId: string) {
  const params = new URLSearchParams({
    dataset_id: datasetId,
    format: 'json',
    uncompressed_webhook: 'true'
  });
  return `${DATASET_TRIGGER_URL}?${params.toString()}`;
}

async function triggerCollector(collectorId: string, args: CollectorArgs, requestUrl?: string): Promise<string> {
  const response = await axios.post(
    brightDataConfig.scraperTriggerUrl,
    {
      collector_id: collectorId,
      request: {
        ...(requestUrl ? { url: requestUrl } : {}),
        args,
        render: false
      }
    },
    { headers: requireApiToken(), timeout: 45_000 }
  );

  const requestId = response.data?.request_id;
  if (!requestId) {
    throw new Error('Bright Data trigger response missing request_id');
  }
  return requestId;
}

async function pollCollectorResult<T>(requestId: string): Promise<BrightDataScrapeResult<T>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await axios.get(
      brightDataConfig.scraperResultsUrl,
      {
        params: { request_id: requestId },
        headers: requireApiToken(),
        timeout: 30_000
      }
    );

    const status = (response.data?.status || '').toString().toLowerCase();
    if (status === 'done' || status === 'success') {
      const results = response.data?.results;
      const firstContent = Array.isArray(results)
        ? (results[0]?.content ?? results[0])
        : response.data?.result || response.data?.content || response.data;
      return { payload: firstContent ?? null, raw: response.data };
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(`Bright Data request failed (${status})`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Bright Data scraper timed out');
}

async function runCollector<T>(
  collectorId: string,
  args: CollectorArgs,
  logCtx: Record<string, unknown>,
  requestUrl?: string
): Promise<BrightDataScrapeResult<T> | null> {
  if (!isBrightDataEnabled()) {
    console.warn('[BrightData] Client disabled, skipping scrape', logCtx);
    return null;
  }

  if (!collectorId) {
    console.warn('[BrightData] Collector ID missing, skipping scrape', logCtx);
    return null;
  }

  try {
    const requestId = await triggerCollector(collectorId, args, requestUrl);
    return await pollCollectorResult<T>(requestId);
  } catch (error: any) {
    console.error('[BrightData] Collector run failed', {
      ...logCtx,
      message: error?.message || String(error)
    });
    throw error;
  }
}

function mapProfilePayload(payload: any): BrightDataProfile {
  if (!payload) return { _raw: payload };
  const profile = payload.profile || payload;
  const experienceList = Array.isArray(profile.experience || profile.positions)
    ? (profile.experience || profile.positions).map((item: any) => ({
        title: item?.title || item?.position,
        company: item?.company || item?.company_name,
        location: item?.location || item?.city,
        start_date: item?.start_date || item?.startDate || item?.start,
        end_date: item?.end_date || item?.endDate || item?.end || null,
        description: item?.description || item?.summary
      }))
    : undefined;

  const educationList = Array.isArray(profile.education)
    ? profile.education.map((item: any) => ({
        school: item?.school || item?.school_name,
        degree: item?.degree,
        field_of_study: item?.field_of_study || item?.major,
        start_year: item?.start_year || item?.startYear || null,
        end_year: item?.end_year || item?.endYear || null
      }))
    : undefined;

  const skills = Array.isArray(profile.skills)
    ? profile.skills.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
    : undefined;

  return {
    full_name: profile.full_name || profile.fullName || profile.name,
    first_name: profile.first_name || profile.firstName,
    last_name: profile.last_name || profile.lastName,
    headline: profile.headline || profile.title,
    location: profile.location || profile.city || profile.region,
    current_title: profile.current_title || profile.job_title || profile.title,
    current_company: profile.current_company || profile.company || profile.organization,
    about: profile.summary || profile.about,
    profile_url: profile.profile_url || profile.profileUrl || profile.url,
    avatar_url: profile.avatar || profile.avatar_url || profile.image_url,
    experience: experienceList,
    education: educationList,
    skills,
    _raw: payload
  };
}

function mapJobPayload(payload: any): BrightDataJob {
  if (!payload) return { _raw: payload };
  const job = payload.job || payload;
  return {
    job_title: job.job_title || job.title || job.position,
    company_name: job.company_name || job.company || job.employer,
    location: job.location || job.city || job.region,
    employment_type: job.employment_type || job.type,
    salary_text: job.salary_text || job.salary,
    job_description: job.job_description || job.description,
    job_url: job.job_url || job.url,
    source: job.source || payload.source,
    _raw: payload
  };
}

export async function scrapeLinkedInProfile(profileUrl: string): Promise<BrightDataProfile | null> {
  const normalizedUrl = normalizeLinkedInUrl(profileUrl);
  if (!normalizedUrl) return null;
  console.log('[BrightData] Scrape profile started', { profileUrl: normalizedUrl });
  try {
    const datasetId = brightDataConfig.linkedinProfileScraperId || '';
    if (!datasetId) {
      console.warn('[BrightData] Profile dataset_id missing; skipping scrape');
      return null;
    }
    // Fast synchronous scrape (no polling)
    const scrapeUrl = `${DATASET_SCRAPE_URL}?dataset_id=${encodeURIComponent(datasetId)}&format=json`;
    const resp = await axios.post(
      scrapeUrl,
      [{ url: normalizedUrl }],
      { headers: requireApiToken(), timeout: 30_000 }
    );

    if (resp.status !== 200) {
      throw new Error(`BrightData scrape failed (status ${resp.status})`);
    }

    const payload = Array.isArray(resp.data) ? resp.data[0] : resp.data;
    if (!payload) {
      console.log('[BrightData] Scrape profile finished with no payload', { profileUrl: normalizedUrl });
      return null;
    }

    const mapped = mapProfilePayload(payload);
    mapped._raw = resp.data;
    console.log('[BrightData] Scrape profile finished', { profileUrl: normalizedUrl, hasProfile: true });
    return mapped;
  } catch (error: any) {
    console.error('[BrightData] Scrape profile failed', { profileUrl: normalizedUrl, error: error?.message || String(error) });
    return null;
  }
}

export async function scrapeLinkedInCompany(companyUrl: string): Promise<any | null> {
  if (!companyUrl) return null;
  console.log('[BrightData] Scrape company started', { companyUrl });
  try {
    const result = await runCollector<any>(
      brightDataConfig.linkedinCompanyScraperId || '',
      { companyUrl },
      { companyUrl, collector: 'linkedin_company' }
    );
    if (!result?.payload) {
      console.log('[BrightData] Scrape company finished with no payload', { companyUrl });
      return null;
    }
    console.log('[BrightData] Scrape company finished', { companyUrl, hasPayload: true });
    return {
      ...(result.payload.company || result.payload),
      _raw: result.raw
    };
  } catch (error: any) {
    console.error('[BrightData] Scrape company failed', { companyUrl, error: error?.message || String(error) });
    return null;
  }
}

export async function scrapeLinkedInJob(jobUrl: string): Promise<BrightDataJob | null> {
  if (!jobUrl) return null;
  const normalizedUrl = normalizeLinkedInUrl(jobUrl);
  console.log('[BrightData] Scrape LinkedIn job started', { jobUrl: normalizedUrl || jobUrl });
  try {
    const result = await runCollector<any>(
      brightDataConfig.linkedinJobsScraperId || '',
      { jobUrl: normalizedUrl || jobUrl },
      { jobUrl: normalizedUrl || jobUrl, collector: 'linkedin_jobs' }
    );
    if (!result?.payload) {
      console.log('[BrightData] Scrape LinkedIn job finished with no payload', { jobUrl: normalizedUrl || jobUrl });
      return null;
    }
    const mapped = mapJobPayload(result.payload);
    mapped._raw = result.raw;
    console.log('[BrightData] Scrape LinkedIn job finished', { jobUrl: normalizedUrl || jobUrl, hasJob: true });
    return mapped;
  } catch (error: any) {
    console.error('[BrightData] Scrape LinkedIn job failed', { jobUrl: normalizedUrl || jobUrl, error: error?.message || String(error) });
    return null;
  }
}

export async function scrapeGenericJob(url: string): Promise<BrightDataJob | null> {
  if (!url) return null;
  const normalizedUrl = normalizeLinkedInUrl(url) || url;
  console.log('[BrightData] Scrape job started', { url: normalizedUrl });
  try {
    const result = await runCollector<any>(
      brightDataConfig.genericJobScraperId || '',
      { url: normalizedUrl },
      { url: normalizedUrl, collector: 'generic_job' }
    );
    if (!result?.payload) {
      console.log('[BrightData] Scrape job finished with no payload', { url: normalizedUrl });
      return null;
    }
    const mapped = mapJobPayload(result.payload);
    mapped._raw = result.raw;
    console.log('[BrightData] Scrape job finished', { url: normalizedUrl, hasJob: true });
    return mapped;
  } catch (error: any) {
    console.error('[BrightData] Scrape job failed', { url: normalizedUrl, error: error?.message || String(error) });
    return null;
  }
}

async function pollDatasetSnapshot<T>(snapshotId: string): Promise<BrightDataDatasetSnapshot<T>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const resp = await axios.get(`${DATASET_SNAPSHOT_URL}/${snapshotId}`, {
      params: { format: 'json' },
      headers: requireApiToken(),
      timeout: 30_000,
      validateStatus: () => true // handle 404 as "not ready yet"
    });

    if (resp.status === 404) {
      // Snapshot not ready yet
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (resp.status !== 200) {
      throw new Error(`Bright Data snapshot poll failed (status ${resp.status})`);
    }

    const status = (resp.data?.status || '').toString().toLowerCase();
    if (status === 'failed' || status === 'error') {
      throw new Error(`Bright Data snapshot failed (${status})`);
    }

    // Dataset results often come under items/results/data
    const payload =
      resp.data?.items ||
      resp.data?.results ||
      resp.data?.data ||
      resp.data?.content ||
      resp.data;
    return { payload: payload ?? null, raw: resp.data };
  }
  throw new Error('Bright Data snapshot timed out');
}

