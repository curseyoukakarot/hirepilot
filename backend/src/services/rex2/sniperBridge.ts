import { sniperV1Queue } from '../../queues/redis';
import { supabase as supabaseClient, supabaseAdmin, supabaseDb as supabaseDbClient } from '../../lib/supabase';
import { createJob, createTarget, countJobItems, getJob } from '../sniperV1/db';
import { fetchSniperV1Settings } from '../sniperV1/settings';

export type SniperBridgeTarget = {
  label: string;
  url: string;
  platform: string;
};

export type SniperBridgeLaunch = {
  targetId: string;
  jobId: string;
  url: string;
  label: string;
  platform: string;
};

export type SniperBridgePoll = {
  done: boolean;
  hasFailures: boolean;
  completedJobs: number;
  totalJobs: number;
  resultsCount: number;
  discoveredCount: number;
  statuses: Array<{ jobId: string; status: string }>;
  externalRefs: Array<{ type: 'sniper_run'; id: string; meta: Record<string, any> }>;
};

function getDb() {
  const db = (supabaseDbClient as any) || (supabaseAdmin as any) || (supabaseClient as any);
  if (!db || typeof db.from !== 'function') {
    throw new Error('supabase_db_client_unavailable');
  }
  return db;
}

function inferPlatform(url: string): string {
  try {
    const host = String(new URL(url).hostname || '').toLowerCase();
    if (host.includes('linkedin')) return 'linkedin';
    if (host.includes('indeed')) return 'indeed';
    if (host.includes('ziprecruiter')) return 'ziprecruiter';
    return host.replace(/^www\./, '') || 'web';
  } catch {
    return 'web';
  }
}

function pullTargetsFromInputHint(raw: any): SniperBridgeTarget[] {
  const out: SniperBridgeTarget[] = [];
  const arr = Array.isArray(raw) ? raw : [];
  for (const item of arr) {
    const url = String(item?.url || '').trim();
    if (!url) continue;
    out.push({
      label: String(item?.label || 'Sniper Target').trim() || 'Sniper Target',
      url,
      platform: inferPlatform(url)
    });
  }
  return out;
}

function pullUrlsFromText(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  return Array.from(new Set(matches.map((m) => m.trim()).filter(Boolean)));
}

export function resolveSniperTargetsFromPlan(planJson: any, sourceStepId?: string): SniperBridgeTarget[] {
  const targets: SniperBridgeTarget[] = [];

  const topHint = planJson?.input_hint?.sniper_targets;
  targets.push(...pullTargetsFromInputHint(topHint));

  const steps = Array.isArray(planJson?.steps) ? planJson.steps : [];
  for (const s of steps) {
    if (sourceStepId && String(s?.step_id || '') !== sourceStepId) continue;
    targets.push(...pullTargetsFromInputHint(s?.input_hint?.sniper_targets));
  }

  if (!targets.length) {
    const urlPool = [
      ...pullUrlsFromText(String(planJson?.goal?.description || '')),
      ...steps.flatMap((s: any) => pullUrlsFromText(String(s?.description || ''))),
      ...steps.flatMap((s: any) => pullUrlsFromText(String(s?.title || '')))
    ];
    for (const u of urlPool) {
      targets.push({ label: 'Sniper Target', url: u, platform: inferPlatform(u) });
    }
  }

  const seen = new Set<string>();
  const deduped: SniperBridgeTarget[] = [];
  for (const t of targets) {
    const key = t.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }
  return deduped;
}

export async function launchSniperCapture(args: {
  userId: string;
  workspaceId: string;
  targets: SniperBridgeTarget[];
  limit?: number;
}): Promise<SniperBridgeLaunch[]> {
  const settings = await fetchSniperV1Settings(args.workspaceId);
  if (!settings.cloud_engine_enabled) {
    throw Object.assign(new Error('Cloud Engine is disabled. Enable Sniper Cloud Engine in settings.'), {
      code: 'CLOUD_ENGINE_DISABLED'
    });
  }

  const launches: SniperBridgeLaunch[] = [];
  const perTargetLimit = Math.max(1, Math.min(Number(args.limit || 200), 1000));

  for (const t of args.targets) {
    const target = await createTarget({
      workspace_id: args.workspaceId,
      created_by: args.userId,
      name: `${t.label} (${t.platform})`.slice(0, 160),
      post_url: t.url
    });
    const job = await createJob({
      workspace_id: args.workspaceId,
      created_by: args.userId,
      target_id: target.id,
      job_type: 'prospect_post_engagers',
      provider: 'airtop',
      input_json: { post_url: t.url, limit: perTargetLimit }
    });
    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    launches.push({
      targetId: target.id,
      jobId: job.id,
      url: t.url,
      label: t.label,
      platform: t.platform
    });
  }
  return launches;
}

async function readSniperDiscoveryCounts(userId: string, startedAtIso: string): Promise<{ discoveredCount: number; resultsCount: number }> {
  try {
    const { data: runs } = await getDb()
      .from('sniper_runs')
      .select('id,discovered_count')
      .eq('user_id', userId)
      .gte('created_at', startedAtIso)
      .order('created_at', { ascending: false })
      .limit(50);
    const runRows = Array.isArray(runs) ? runs : [];
    const discoveredCount = runRows.reduce((acc: number, row: any) => acc + Number(row?.discovered_count || 0), 0);
    const runIds = runRows.map((r: any) => String(r?.id || '')).filter(Boolean);
    if (!runIds.length) return { discoveredCount, resultsCount: 0 };
    const { count } = await getDb()
      .from('sniper_results')
      .select('id', { count: 'exact', head: true })
      .in('run_id', runIds);
    return { discoveredCount, resultsCount: Number(count || 0) };
  } catch {
    return { discoveredCount: 0, resultsCount: 0 };
  }
}

export async function pollSniperCapture(args: {
  launches: SniperBridgeLaunch[];
  userId: string;
  startedAtIso: string;
}): Promise<SniperBridgePoll> {
  const statuses: Array<{ jobId: string; status: string }> = [];
  let completedJobs = 0;
  let failedJobs = 0;
  let resultsCount = 0;

  for (const launch of args.launches) {
    const job = await getJob(launch.jobId);
    const status = String(job?.status || 'queued');
    statuses.push({ jobId: launch.jobId, status });
    const itemCount = await countJobItems(launch.jobId).catch(() => 0);
    resultsCount += Number(itemCount || 0);
    if (['succeeded', 'partially_succeeded', 'failed', 'canceled'].includes(status)) {
      completedJobs += 1;
    }
    if (['failed', 'canceled'].includes(status)) {
      failedJobs += 1;
    }
  }

  const discoveryCounts = await readSniperDiscoveryCounts(args.userId, args.startedAtIso);
  const mergedResults = Math.max(resultsCount, discoveryCounts.resultsCount);
  const discoveredCount = Math.max(mergedResults, discoveryCounts.discoveredCount);

  return {
    done: completedJobs === args.launches.length,
    hasFailures: failedJobs > 0,
    completedJobs,
    totalJobs: args.launches.length,
    resultsCount: mergedResults,
    discoveredCount,
    statuses,
    externalRefs: args.launches.map((l) => ({
      type: 'sniper_run',
      id: l.jobId,
      meta: {
        target_id: l.targetId,
        url: l.url,
        platform: l.platform,
        label: l.label
      }
    }))
  };
}

