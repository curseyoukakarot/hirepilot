import { Worker, Queue } from 'bullmq';
import * as cheerio from 'cheerio';
import { connection } from '../queues/redis';
import { supabaseDb } from '../../lib/supabase';
import { scrapeUniversal, createTikTokTask } from '../utils/decodo';
import { CreditService } from '../../services/creditService';

type DiscoveryJob = {
  runId: string;
  userId: string;
  workflowSlug: string;
  params: any;
};

const discoveryQueueName = 'sniper:discovery';
export const sniperDiscoveryWorker = new Worker<DiscoveryJob>(
  discoveryQueueName,
  async (job) => {
    const { runId, userId, params } = job.data;
    const platform = (params?.platform || (params?.mode ? 'tiktok' : 'unknown')) as string;
    await updateRun(runId, { status: 'running' });

    try {
      let discovered = 0;
      if (['indeed', 'ziprecruiter', 'google_jobs'].includes(platform)) {
        const results = await runJobBoardDiscovery(userId, runId, platform, params);
        discovered = results;
        await maybeCreateJobsCustomTable(userId, runId);
        // Credits: 1 per job (adjust policy as needed)
        if (discovered > 0) {
          try {
            await CreditService.deductCredits(userId, discovered, 'api_usage', `Sniper Job Discovery: ${platform} (${discovered})`);
          } catch (e) {
            // Non-fatal, but log
            console.warn('[SniperDiscovery] credit deduction failed:', (e as any)?.message || e);
          }
        }
      } else if (platform === 'tiktok') {
        const results = await runTikTokDiscovery(userId, runId, params);
        discovered = results;
        // Credits: 1 per 25 profiles
        const credits = Math.ceil(discovered / 25);
        if (credits > 0) {
          try {
            await CreditService.deductCredits(userId, credits, 'api_usage', `Sniper TikTok Discovery: ${discovered} profiles`);
          } catch (e) {
            console.warn('[SniperDiscovery] credit deduction failed:', (e as any)?.message || e);
          }
        }
      } else {
        throw new Error(`Unsupported discovery platform/mode`);
      }

      await updateRun(runId, { status: 'completed', discovered_count: discovered });
      return { discovered };
    } catch (err: any) {
      await updateRun(runId, { status: 'failed', error: String(err?.message || err) });
      throw err;
    }
  },
  { connection }
);

async function updateRun(runId: string, fields: Partial<{ status: string; discovered_count: number; error: string }>) {
  await supabaseDb.from('sniper_runs').update(fields as any).eq('id', runId);
}

function buildSearchUrl(platform: string, job_title?: string, location?: string): string {
  const q = encodeURIComponent(String(job_title || '').trim());
  const l = encodeURIComponent(String(location || '').trim());
  if (platform === 'indeed') {
    return `https://www.indeed.com/jobs?q=${q}${l ? `&l=${l}` : ''}`;
  }
  if (platform === 'ziprecruiter') {
    return `https://www.ziprecruiter.com/candidate/search?search=${q}${l ? `&location=${l}` : ''}`;
  }
  // google_jobs
  const parts = [q, 'jobs', l].filter(Boolean).join('+');
  return `https://www.google.com/search?q=${parts}`;
}

async function runJobBoardDiscovery(userId: string, runId: string, platform: string, params: any): Promise<number> {
  const url = params?.url || buildSearchUrl(platform, params?.job_title, params?.location);
  const { html } = await scrapeUniversal({ url, headless: 'html' });
  const max = Math.min(Number(params?.max_results || 100), 200);
  const keywords: string[] = Array.isArray(params?.keywords) ? params.keywords : [];
  const normalized = parseJobs(platform, html || '', { keywords }).slice(0, max);

  if (!normalized.length) return 0;
  // Insert rows
  const rows = normalized.map((n) => ({
    run_id: runId,
    user_id: userId,
    source_type:
      platform === 'indeed' ? 'indeed_job' : platform === 'ziprecruiter' ? 'zip_job' : 'google_job',
    source_platform: platform,
    normalized: n,
    raw: null
  }));
  const { error } = await supabaseDb.from('sniper_results').insert(rows as any);
  if (error) throw error;
  return rows.length;
}

function parseJobs(platform: string, html: string, opts: { keywords: string[] }): any[] {
  const $ = cheerio.load(html || '');
  const out: any[] = [];
  if (platform === 'indeed') {
    $('a.tapItem').each((_i, el) => {
      const job_title = $(el).find('h2.jobTitle span').last().text().trim();
      const company_name = $(el).find('.companyName').text().trim();
      const location = $(el).find('.companyLocation').text().trim();
      const salary = $(el).find('.salary-snippet-container').text().trim() || null;
      const posting_date = $(el).find('.date').text().trim() || null;
      const job_url = $(el).attr('href')?.startsWith('http') ? $(el).attr('href')! : `https://www.indeed.com${$(el).attr('href')}`;
      if (job_title && company_name && job_url) {
        out.push({
          job_title,
          company_name,
          company_domain: null,
          location,
          posting_date,
          salary,
          job_url,
          source_platform: 'indeed',
          keywords: opts.keywords || [],
          metadata: {
            job_id: $(el).attr('data-jk') || null,
            raw_location_tokens: location ? location.split(/\s+/) : null
          }
        });
      }
    });
  } else if (platform === 'ziprecruiter') {
    $('article.job_result').each((_i, el) => {
      const job_title = $(el).find('a.job_title').text().trim();
      const company_name = $(el).find('.job_org').text().trim();
      const location = $(el).find('.job_loc').text().trim();
      const salary = $(el).find('.job_snippet .salary').text().trim() || null;
      const posting_date = $(el).find('time').text().trim() || null;
      const job_url = $(el).find('a.job_title').attr('href') || '';
      if (job_title && company_name && job_url) {
        out.push({
          job_title,
          company_name,
          company_domain: null,
          location,
          posting_date,
          salary,
          job_url,
          source_platform: 'ziprecruiter',
          keywords: opts.keywords || [],
          metadata: { job_id: null, raw_location_tokens: location ? location.split(/\s+/) : null }
        });
      }
    });
  } else {
    // google_jobs (SERP)
    // Best-effort parse of job cards on Google SERP
    $('div.g').each((_i, el) => {
      const a = $(el).find('a').first();
      const title = $(el).find('h3').text().trim();
      const link = a.attr('href') || '';
      const desc = $(el).find('span, div').text();
      if (title && link) {
        const m = title.match(/-\s*([^–\-|]+)$/); // company at tail
        const company_name = m ? m[1].trim() : (desc.split('·')[0] || '').trim();
        out.push({
          job_title: title,
          company_name: company_name || '',
          company_domain: null,
          location: '',
          posting_date: null,
          salary: null,
          job_url: link,
          source_platform: 'google_jobs',
          keywords: opts.keywords || [],
          metadata: { job_id: null, raw_location_tokens: null }
        });
      }
    });
  }
  return out;
}

async function runTikTokDiscovery(userId: string, runId: string, params: any): Promise<number> {
  const mode = params?.mode;
  let results = 0;
  if (mode === 'creator_search') {
    const q = String(params?.query || '').trim();
    const url = `https://www.tiktok.com/search/user?q=${encodeURIComponent(q)}`;
    const { html } = await scrapeUniversal({ url, headless: 'html' });
    const $ = cheerio.load(html || '');
    const rows: any[] = [];
    $('[data-e2e="search-user-container"] a[href*="/@"]').each((_i, el) => {
      const profile_url = 'https://www.tiktok.com' + ($(el).attr('href') || '');
      const tiktok_handle = (profile_url.split('/@')[1] || '').split(/[/?]/)[0];
      const display_name = $(el).find('[data-e2e="search-user-name"]').text().trim();
      const bio = $(el).find('[data-e2e="search-user-bio"]').text().trim() || null;
      if (tiktok_handle) {
        rows.push({
          tiktok_handle,
          display_name: display_name || tiktok_handle,
          bio,
          follower_count: null,
          profile_url,
          topics: Array.isArray(params?.topics) ? params.topics : [],
          last_video_url: null,
          last_video_caption: null,
          engagement_30d: { likes: null, comments: null, shares: null }
        });
      }
    });
    if (rows.length) {
      await supabaseDb.from('sniper_results').insert(
        rows.map((n) => ({
          run_id: runId,
          user_id: userId,
          source_type: 'tiktok_creator',
          source_platform: 'tiktok',
          normalized: n,
          raw: null
        })) as any
      );
    }
    results = rows.length;
  } else if (mode === 'post_engagement') {
    const payload = {
      target: 'tiktok_post',
      url: String(params?.video_url || '')
    };
    const data = await createTikTokTask(payload);
    // Expect structure varies; try common fields
    const commenters: any[] = data?.commenters || data?.data?.commenters || [];
    const likers: any[] = data?.likers || data?.data?.likers || [];
    const video_url: string = payload.url;

    const normCommenters = commenters.map((c: any) => ({
      tiktok_handle: c?.username || c?.handle || '',
      display_name: c?.name || c?.display_name || '',
      profile_url: c?.profile_url || (c?.username ? `https://www.tiktok.com/@${c.username}` : null),
      comment_text: c?.text || null,
      video_url,
      topics: []
    }));
    const normLikers = likers.map((l: any) => ({
      tiktok_handle: l?.username || l?.handle || '',
      display_name: l?.name || l?.display_name || '',
      profile_url: l?.profile_url || (l?.username ? `https://www.tiktok.com/@${l.username}` : null),
      comment_text: null,
      video_url,
      topics: []
    }));
    const rows: any[] = [
      ...normCommenters.map((n) => ({ source_type: 'tiktok_commenter', normalized: n })),
      ...normLikers.map((n) => ({ source_type: 'tiktok_liker', normalized: n }))
    ];
    if (rows.length) {
      await supabaseDb.from('sniper_results').insert(
        rows.map((r) => ({
          run_id: runId,
          user_id: userId,
          source_type: r.source_type,
          source_platform: 'tiktok',
          normalized: r.normalized,
          raw: null
        })) as any
      );
    }
    results = rows.length;
  } else {
    throw new Error('Unsupported TikTok mode');
  }
  return results;
}

async function maybeCreateJobsCustomTable(userId: string, runId: string): Promise<void> {
  // Load jobs for this run
  const { data: jobs } = await supabaseDb
    .from('sniper_results')
    .select('normalized')
    .eq('run_id', runId)
    .in('source_type', ['indeed_job', 'zip_job', 'google_job']);
  const rows = (jobs || []).map((r: any) => r.normalized || {});
  if (!rows.length) return;
  const name = `Sniper Jobs — ${runId.slice(0, 8)}`;
  const schema = [
    { name: 'job_title', type: 'text' },
    { name: 'company_name', type: 'text' },
    { name: 'location', type: 'text' },
    { name: 'posting_date', type: 'text' },
    { name: 'salary', type: 'text' },
    { name: 'job_url', type: 'text' },
    { name: 'source_platform', type: 'text' },
    { name: 'run_id', type: 'text' }
  ];
  const tableRows = rows.map((r: any) => ({
    job_title: r.job_title || '',
    company_name: r.company_name || '',
    location: r.location || '',
    posting_date: r.posting_date || '',
    salary: r.salary || '',
    job_url: r.job_url || '',
    source_platform: r.source_platform || '',
    run_id: runId
  }));
  // Upsert by name for this user: if exists, append
  const { data: existing } = await supabaseDb
    .from('custom_tables')
    .select('id, data_json, schema_json')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();
  if (existing?.id) {
    const currentData = Array.isArray((existing as any).data_json) ? (existing as any).data_json : [];
    const nextData = [...currentData, ...tableRows];
    await supabaseDb
      .from('custom_tables')
      .update({ data_json: nextData, schema_json: (existing as any).schema_json || schema })
      .eq('id', existing.id);
  } else {
    await supabaseDb.from('custom_tables').insert({
      user_id: userId,
      name,
      schema_json: schema,
      data_json: tableRows,
      collaborators: []
    } as any);
  }
}


