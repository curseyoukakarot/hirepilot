import { Worker } from 'bullmq';
import { connection, jobseekerAgentQueue } from '../queues/redis';
import { getProvider } from '../services/sniperV1/providers';
import { supabaseDb } from '../lib/supabase';
import { incrementConcurrency, decrementConcurrency } from '../lib/throttle';
import {
  getRun,
  updateRun,
  listRunItems,
  insertRunItems,
  updateRunItem,
  fetchCloudEngineSettings
} from '../services/jobseekerAgent/db';
import { withAirtopLinkedInPage } from '../services/jobseekerAgent/airtop';
import { buildPeopleSearchUrl, collectPeopleSearchResultsOnPage } from '../services/jobseekerAgent/linkedin';
import { inferHiringManagerTitles, rerankTargets } from '../services/jobseekerAgent/inference';
import { getUsageRow, incrementUsage } from '../services/jobseekerAgent/usage';

const QUEUE = 'jobseeker:agent';

function nowIso() {
  return new Date().toISOString();
}

function asNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type ProgressCursor = {
  stage: 'extract_jobs' | 'analyze_jobs' | 'infer_titles' | 'search_people' | 'rank_targets' | 'upsert_leads';
  job_index: number;
  profile_index: number;
};

async function maybePauseForSchedule(runId: string, nextRunAt: string | null) {
  if (!nextRunAt) return false;
  const delayMs = new Date(nextRunAt).getTime() - Date.now();
  if (!Number.isFinite(delayMs) || delayMs <= 0) return false;
  await updateRun(runId, { status: 'paused_scheduled', next_run_at: nextRunAt } as any);
  await jobseekerAgentQueue.add('jobseeker_agent_run', { runId }, { delay: delayMs });
  return true;
}

function nextDayUtc(): string {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 15, 0, 0);
  return next.toISOString();
}

async function pauseForThrottle(runId: string, reason: string, nextRunAt: string) {
  await updateRun(runId, { status: 'paused_throttled', last_error: reason, next_run_at: nextRunAt } as any);
  const delayMs = new Date(nextRunAt).getTime() - Date.now();
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await jobseekerAgentQueue.add('jobseeker_agent_run', { runId }, { delay: delayMs });
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function computeMatchScore(candidateTitle: string | null, jobTitle: string | null, targetTitles: string[]) {
  const title = String(candidateTitle || '').toLowerCase();
  const job = String(jobTitle || '').toLowerCase();
  let score = 40;
  if (title && job && title.includes(job)) score += 25;
  if (targetTitles.some((t) => title.includes(String(t).toLowerCase()))) score += 25;
  if (/vp|head|director|chief|lead/.test(title)) score += 10;
  return Math.max(0, Math.min(100, score));
}

function isRateLimitError(err: any) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('rate') || msg.includes('limit') || msg.includes('429') || msg.includes('temporarily') || msg.includes('blocked');
}

function cooldownIso(minutes: number) {
  const next = new Date(Date.now() + Math.max(1, minutes) * 60 * 1000);
  return next.toISOString();
}

async function extractJobSignalsOnPage(page: any, jobUrl: string) {
  if (!jobUrl) return null;
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200).catch(() => {});
  const signals = await page
    .evaluate(() => {
      const text = (el?: Element | null) => (el?.textContent || '').trim() || null;
      const title =
        text(document.querySelector('h1')) ||
        text(document.querySelector('.top-card-layout__title')) ||
        text(document.querySelector('.job-details-jobs-unified-top-card__job-title')) ||
        null;
      const companyEl =
        document.querySelector('.top-card-layout__second-subline a[href*="/company/"]') ||
        document.querySelector('.job-details-jobs-unified-top-card__company-name a') ||
        document.querySelector('a[href*="/company/"]');
      const company = text(companyEl);
      const location =
        text(document.querySelector('.top-card-layout__first-subline')) ||
        text(document.querySelector('.job-details-jobs-unified-top-card__primary-description-container')) ||
        null;
      const descriptionEl =
        document.querySelector('.show-more-less-html__markup') ||
        document.querySelector('.jobs-description__content') ||
        document.querySelector('.jobs-box__html-content');
      const description = text(descriptionEl);
      const hintSections = Array.from(document.querySelectorAll('section, div'))
        .map((el) => (el.textContent || '').trim())
        .filter((t) => /hiring manager|recruiter|posted by|talent/i.test(t))
        .slice(0, 3);
      return {
        title,
        company,
        location,
        description_snippet: description ? description.slice(0, 1200) : null,
        hiring_hints: hintSections
      };
    })
    .catch(() => null);
  return signals;
}

export const jobseekerAgentWorker = new Worker(
  QUEUE,
  async (bullJob) => {
    const runId = String((bullJob.data as any)?.runId || '');
    if (!runId) throw new Error('missing_runId');

    const run = await getRun(runId);
    if (!run) return { skipped: true, reason: 'run_not_found' };
    if (['succeeded', 'failed', 'canceled'].includes(String(run.status || ''))) {
      return { skipped: true, reason: 'terminal_status' };
    }

    if (await maybePauseForSchedule(runId, run.next_run_at)) {
      return { paused: true, reason: 'scheduled' };
    }

    let settings: any = null;
    let concurrencyAcquired = false;
    try {
      await updateRun(runId, { status: 'running', started_at: run.started_at || nowIso(), last_error: null } as any);

      const cursor: ProgressCursor = {
        stage: (run.progress_json?.stage as ProgressCursor['stage']) || 'extract_jobs',
        job_index: asNumber(run.progress_json?.job_index, 0),
        profile_index: asNumber(run.progress_json?.profile_index, 0)
      };

      settings = await fetchCloudEngineSettings(run.user_id, run.workspace_id || run.user_id);
      concurrencyAcquired = await incrementConcurrency(run.workspace_id || run.user_id, 'linkedin', Number(settings.max_concurrency || 1), 300);
      if (!concurrencyAcquired) {
        await jobseekerAgentQueue.add('jobseeker_agent_run', { runId }, { delay: 10_000 });
        return { requeued: true, reason: 'max_concurrency' };
      }
      const dayKey = new Date().toISOString().slice(0, 10);
      let usage = await getUsageRow(run.user_id, run.workspace_id || run.user_id, dayKey);
      let usedJobPages = Number(usage?.job_pages_read || 0);
      let usedProfiles = Number(usage?.profiles_read || 0);

      // Stage 1: Extract job URLs from search
      if (cursor.stage === 'extract_jobs') {
        const existing = await listRunItems(runId, { type: 'job', limit: run.job_limit || 2000 });
        if (!existing.length) {
          const provider = getProvider('airtop');
          const jobs = await provider.prospectJobsIntent({
            userId: run.user_id,
            workspaceId: run.workspace_id || run.user_id,
            searchUrl: run.search_url,
            limit: clamp(Number(run.job_limit || 100), 1, 2000)
          });
          await insertRunItems(
            jobs.map((j) => ({
              run_id: runId,
              item_type: 'job' as const,
              job_url: j.job_url || null,
              company: j.company || null,
              title: j.title || null,
              location: j.location || null,
              job_data_json: { source: 'jobs_intent', search_url: run.search_url },
              status: 'queued'
            }))
          );
          await updateRun(runId, {
            stats_json: { ...(run.stats_json || {}), jobs_found: jobs.length },
            progress_json: { stage: 'analyze_jobs', job_index: 0, profile_index: 0 }
          } as any);
        } else {
          await updateRun(runId, { progress_json: { stage: 'analyze_jobs', job_index: 0, profile_index: 0 } } as any);
        }
        cursor.stage = 'analyze_jobs';
        cursor.job_index = 0;
      }

      // Stage 2: Extract job page signals
      if (cursor.stage === 'analyze_jobs') {
        const jobs = await listRunItems(runId, { type: 'job', limit: 5000 });
        await withAirtopLinkedInPage({ userId: run.user_id, workspaceId: run.workspace_id || run.user_id }, async (page) => {
          for (let i = cursor.job_index; i < jobs.length; i += 1) {
            const job = jobs[i];
            if (usedJobPages >= settings.daily_job_page_limit) {
              await pauseForThrottle(runId, 'daily_job_page_limit_reached', nextDayUtc());
              return;
            }
            if (job.job_data_json?.signals_extracted) {
              cursor.job_index = i + 1;
              continue;
            }
            await updateRunItem(job.id, { status: 'running' } as any);
            const signals = await extractJobSignalsOnPage(page, String(job.job_url || ''));
            usedJobPages += 1;
            await incrementUsage(run.user_id, run.workspace_id || run.user_id, dayKey, { job_pages_read: 1 });
            await updateRunItem(job.id, {
              status: signals ? 'success' : 'failed',
              job_data_json: { ...(job.job_data_json || {}), signals, signals_extracted: Boolean(signals) }
            } as any);
            cursor.job_index = i + 1;
            if (i % 5 === 0) {
              await updateRun(runId, { progress_json: { stage: 'analyze_jobs', job_index: cursor.job_index, profile_index: 0 } } as any);
            }
          }
        });
        await updateRun(runId, { progress_json: { stage: 'infer_titles', job_index: 0, profile_index: 0 } } as any);
        cursor.stage = 'infer_titles';
        cursor.job_index = 0;
      }

      // Stage 3: OpenAI inference for target titles
      if (cursor.stage === 'infer_titles') {
        const jobs = await listRunItems(runId, { type: 'job', limit: 5000 });
        for (let i = cursor.job_index; i < jobs.length; i += 1) {
          const job = jobs[i];
          if (job.job_data_json?.inference) {
            cursor.job_index = i + 1;
            continue;
          }
          const signals = job.job_data_json?.signals || {};
          const inferred = await inferHiringManagerTitles({
            jobTitle: job.title || signals?.title || null,
            company: job.company || signals?.company || null,
            location: job.location || signals?.location || null,
            descriptionSnippet: signals?.description_snippet || null,
            context: run.context || null
          });
          await updateRunItem(job.id, {
            job_data_json: { ...(job.job_data_json || {}), inference: inferred.result }
          } as any);
          cursor.job_index = i + 1;
          if (i % 5 === 0) {
            await updateRun(runId, { progress_json: { stage: 'infer_titles', job_index: cursor.job_index, profile_index: 0 } } as any);
          }
        }
        await updateRun(runId, { progress_json: { stage: 'search_people', job_index: 0, profile_index: 0 } } as any);
        cursor.stage = 'search_people';
        cursor.job_index = 0;
      }

      // Stage 4: LinkedIn people search for candidates
      if (cursor.stage === 'search_people') {
        const jobs = await listRunItems(runId, { type: 'job', limit: 5000 });
        const existingTargets = await listRunItems(runId, { type: 'target', limit: 5000 });
        const existingByJob = new Map<string, Set<string>>();
        for (const t of existingTargets) {
          const key = String(t.job_url || '');
          if (!key || !t.target_profile_url) continue;
          if (!existingByJob.has(key)) existingByJob.set(key, new Set<string>());
          existingByJob.get(key)!.add(String(t.target_profile_url));
        }

        await withAirtopLinkedInPage({ userId: run.user_id, workspaceId: run.workspace_id || run.user_id }, async (page) => {
          for (let i = cursor.job_index; i < jobs.length; i += 1) {
            const job = jobs[i];
            const inference = job.job_data_json?.inference;
            const titles: string[] = Array.isArray(inference?.target_titles) ? inference.target_titles : [];
            const fallback: string[] = Array.isArray(inference?.fallback_titles) ? inference.fallback_titles : [];
            const searchTitles = [...titles, ...fallback].slice(0, 5);
            const bucket = existingByJob.get(String(job.job_url || '')) || new Set<string>();

            for (const searchTitle of searchTitles) {
              if (usedProfiles >= settings.daily_profile_limit) {
                await pauseForThrottle(runId, 'daily_profile_limit_reached', nextDayUtc());
                return;
              }
              const searchUrl = buildPeopleSearchUrl(job.company, searchTitle);
              const remaining = Math.max(0, settings.daily_profile_limit - usedProfiles);
              const candidates = await collectPeopleSearchResultsOnPage(page, searchUrl, Math.min(12, remaining));
              const newItems = candidates
                .filter((c) => c.profile_url && !bucket.has(c.profile_url))
                .map((c) => {
                  const score = computeMatchScore(c.title || null, job.title || null, titles);
                  return {
                    run_id: runId,
                    item_type: 'target' as const,
                    job_url: job.job_url,
                    company: job.company,
                    title: job.title,
                    location: job.location,
                    target_profile_url: c.profile_url,
                    target_name: c.name || null,
                    target_title: c.title || null,
                    match_score: score,
                    target_data_json: {
                      matched_job_url: job.job_url,
                      matched_job_title: job.title,
                      matched_company: job.company,
                      search_title: searchTitle,
                      source: 'linkedin_search'
                    },
                    status: 'success'
                  };
                });
              for (const it of newItems) bucket.add(String(it.target_profile_url));
              await insertRunItems(newItems);
              usedProfiles += newItems.length;
              if (newItems.length) {
                await incrementUsage(run.user_id, run.workspace_id || run.user_id, dayKey, { profiles_read: newItems.length });
              }
            }

            cursor.job_index = i + 1;
            if (i % 3 === 0) {
              await updateRun(runId, { progress_json: { stage: 'search_people', job_index: cursor.job_index, profile_index: 0 } } as any);
            }
          }
        });

        const afterTargets = await listRunItems(runId, { type: 'target', limit: 5000 });
        await updateRun(runId, {
          stats_json: { ...(run.stats_json || {}), targets_found: afterTargets.length },
          progress_json: { stage: 'rank_targets', job_index: 0, profile_index: 0 }
        } as any);
        cursor.stage = 'rank_targets';
        cursor.job_index = 0;
      }

      // Stage 5: Rank candidates per job
      if (cursor.stage === 'rank_targets') {
        const targets = await listRunItems(runId, { type: 'target', limit: 5000 });
        const byJob = new Map<string, typeof targets>();
        for (const t of targets) {
          const key = String(t.job_url || '');
          if (!byJob.has(key)) byJob.set(key, []);
          byJob.get(key)!.push(t);
        }
        for (const [jobUrl, list] of byJob.entries()) {
          const jobTitle = list[0]?.title || null;
          const company = list[0]?.company || null;
          const ranked = await rerankTargets({
            jobTitle,
            company,
            targets: list.map((t) => ({
              profile_url: String(t.target_profile_url || ''),
              name: t.target_name,
              title: t.target_title,
              score: Number(t.match_score || 0)
            }))
          });
          const scoreByUrl = new Map(ranked.map((r) => [r.profile_url, r.score]));
          for (const t of list) {
            const score = scoreByUrl.get(String(t.target_profile_url || ''));
            if (score !== undefined) {
              await updateRunItem(t.id, { match_score: score } as any);
            }
          }
        }
        await updateRun(runId, { progress_json: { stage: 'upsert_leads', job_index: 0, profile_index: 0 } } as any);
        cursor.stage = 'upsert_leads';
      }

      // Stage 6: upsert leads is implemented later
      if (cursor.stage === 'upsert_leads') {
      const targets = await listRunItems(runId, { type: 'target', limit: 5000 });
      const workspaceId = run.workspace_id || run.user_id;
      for (const t of targets) {
        const linkedinUrl = String(t.target_profile_url || '').trim();
        if (!linkedinUrl) continue;
        const { data: existing } = await supabaseDb
          .from('leads')
          .select('id')
          .eq('user_id', run.user_id)
          .eq('linkedin_url', linkedinUrl)
          .maybeSingle();
        const payload: any = {
          user_id: run.user_id,
          workspace_id: workspaceId,
          persona_type: 'jobseeker',
          source: 'job_seeker_agent',
          name: t.target_name || null,
          title: t.target_title || null,
          company: t.company || null,
          linkedin_url: linkedinUrl,
          enrichment_data: {
            job_url: t.job_url || null,
            job_title: t.title || null,
            company: t.company || null,
            match_score: t.match_score || null,
            run_id: runId
          }
        };
        if (existing?.id) {
          await supabaseDb.from('leads').update(payload).eq('id', existing.id);
        } else {
          await supabaseDb.from('leads').insert(payload);
        }
      }
        await updateRun(runId, {
          status: 'succeeded',
          finished_at: nowIso(),
          progress_json: { stage: 'upsert_leads', job_index: cursor.job_index, profile_index: cursor.profile_index }
        } as any);
      }

      return { ok: true };
    } catch (e: any) {
      if (isRateLimitError(e)) {
        const nextRunAt = cooldownIso(Number(settings?.cooldown_minutes || 30));
        await pauseForThrottle(runId, 'rate_limited', nextRunAt);
        return { paused: true, reason: 'rate_limited' };
      }
      await updateRun(runId, {
        status: 'failed',
        last_error: String(e?.message || 'run_failed'),
        finished_at: nowIso()
      } as any);
      throw e;
    } finally {
      if (concurrencyAcquired) {
        await decrementConcurrency(run.workspace_id || run.user_id, 'linkedin');
      }
    }
  },
  { connection }
);

try {
  console.log('✅ Jobseeker agent worker online (queue: jobseeker:agent)');
} catch {}
