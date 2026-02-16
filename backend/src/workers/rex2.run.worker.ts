import { Worker } from 'bullmq';
import { connection } from '../queues/redis';
import { supabase as supabaseClient, supabaseAdmin, supabaseDb as supabaseDbClient } from '../lib/supabase';
import { buildRex2Event, publishRex2Event } from '../rex2/pubsub';
import { launchSniperCapture, pollSniperCapture, resolveSniperTargetsFromPlan } from '../services/rex2/sniperBridge';

const QUEUE = 'rex2:run';
const MAX_PARALLEL_STEPS = Math.max(1, Number(process.env.REX2_MAX_PARALLEL_STEPS || 2));

function getDb() {
  const db = (supabaseDbClient as any) || (supabaseAdmin as any) || (supabaseClient as any);
  if (!db || typeof db.from !== 'function') {
    throw new Error('supabase_db_client_unavailable');
  }
  return db;
}

type RunStatus = 'queued' | 'running' | 'success' | 'failure' | 'cancelled';
type StepStatus = 'queued' | 'running' | 'success' | 'failure' | 'skipped';

type RetryPolicy = {
  max_attempts?: number;
  backoff_seconds?: number;
};

type StepPolicy = {
  stop_on_failure?: boolean;
  require_minimum_results?: number;
  on_dependency_failure?: 'skip' | 'fail_run' | 'continue_with_partial';
  retry?: RetryPolicy;
  required?: boolean;
};

type RunStep = {
  step_id: string;
  title?: string;
  category?: string;
  status?: StepStatus;
  depends_on?: string[];
  policy?: StepPolicy;
  progress?: Record<string, any>;
  results?: Record<string, any>;
  errors?: Array<Record<string, any>>;
  external_refs?: Array<Record<string, any>>;
  started_at?: string | null;
  ended_at?: string | null;
  duration_ms?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRun(runId: string) {
  const { data, error } = await getDb()
    .from('rex_agent_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

async function updateRun(runId: string, patch: Record<string, any>) {
  const { data, error } = await getDb()
    .from('rex_agent_runs')
    .update({ ...patch, updated_at: new Date().toISOString() } as any)
    .eq('id', runId)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

function defaultSteps(): RunStep[] {
  return [
    { step_id: 'source_candidates', title: 'Source candidates', category: 'sourcing', status: 'queued', depends_on: [] },
    { step_id: 'enrich_profiles', title: 'Enrich profiles', category: 'enrichment', status: 'queued', depends_on: ['source_candidates'] },
    { step_id: 'score_and_rank', title: 'Score and rank', category: 'scoring', status: 'queued', depends_on: ['enrich_profiles'] },
    { step_id: 'create_artifacts', title: 'Create artifacts', category: 'crm', status: 'queued', depends_on: ['score_and_rank'] }
  ];
}

function normalizeSteps(planJson: any): RunStep[] {
  const raw = Array.isArray(planJson?.steps) ? planJson.steps : [];
  const mapped = raw
    .map((s: any, i: number) => ({
      step_id: String(s?.step_id || `step_${i + 1}`),
      title: s?.title ? String(s.title) : undefined,
      category: s?.category ? String(s.category) : 'other',
      status: 'queued',
      depends_on: Array.isArray(s?.depends_on) ? s.depends_on.map((d: any) => String(d)).filter(Boolean) : [],
      policy: (s?.policy && typeof s.policy === 'object') ? s.policy : {}
    }))
    .filter((s: RunStep) => s.step_id);
  return mapped.length ? mapped : defaultSteps();
}

function buildProgressSnapshot(runId: string, status: RunStatus, steps: RunStep[], currentStepId: string | null, startedAt: string | null, completedAt: string | null, updatedAt: string) {
  const completed = steps.filter((s) => ['success', 'skipped', 'failure'].includes(String(s.status || ''))).length;
  const processed = Math.max(0, Math.min(steps.length, completed));
  return {
    schema_version: 'rex.runprogress.v1',
    run_id: runId,
    status,
    current_step_id: currentStepId,
    started_at: startedAt,
    updated_at: updatedAt,
    completed_at: completedAt,
    counters: {
      steps_total: steps.length,
      steps_completed: completed,
      items_total: 100,
      items_processed: Math.min(100, Math.round((processed / Math.max(1, steps.length)) * 100))
    },
    steps: steps.map((s, i) => ({
      step_id: s.step_id,
      status: s.status || 'queued',
      progress: s.progress || {
        percent: s.status === 'success' ? 100 : s.status === 'running' ? 50 : 0,
        label: s.status === 'success' ? 'Complete' : s.status === 'running' ? 'Running' : 'Queued',
        current: s.status === 'success' ? i + 1 : 0,
        total: steps.length
      },
      timing: {
        started_at: s.started_at || null,
        ended_at: s.ended_at || null,
        duration_ms: Number(s.duration_ms || 0)
      },
      results: s.results || {
        summary: s.status === 'success' ? `${s.title || s.step_id} completed.` : '',
        metrics: {},
        quality: { score_percent: s.status === 'success' ? 75 : 0, notes: '', breakdown: {} }
      },
      links: { run_detail: null, artifact_refs: [] },
      errors: Array.isArray(s.errors) ? s.errors : [],
      external_refs: Array.isArray(s.external_refs) ? s.external_refs : []
    }))
  };
}

function isSourceCandidateStep(step: RunStep, idx: number): boolean {
  if (String(step.step_id || '') === 'source_candidates') return true;
  const title = String(step.title || '').toLowerCase();
  if (title.includes('source candidate') || title.includes('source profiles')) return true;
  return idx === 0;
}

function upsertArtifact(artifacts: any, nextArtifact: Record<string, any>) {
  const items = Array.isArray(artifacts?.items) ? artifacts.items : [];
  const filtered = items.filter((a: any) => String(a?.artifact_id || '') !== String(nextArtifact.artifact_id || ''));
  return { schema_version: 'rex.artifacts.v1', items: [...filtered, nextArtifact] };
}

function getStepPolicy(step: RunStep): Required<Pick<StepPolicy, 'stop_on_failure' | 'on_dependency_failure' | 'required'>> & StepPolicy {
  const p = (step.policy || {}) as StepPolicy;
  return {
    ...p,
    stop_on_failure: Boolean(p.stop_on_failure),
    on_dependency_failure: (p.on_dependency_failure || 'skip') as 'skip' | 'fail_run' | 'continue_with_partial',
    required: Boolean(p.required)
  };
}

function isTerminal(status: string | undefined): boolean {
  return ['success', 'failure', 'skipped', 'cancelled'].includes(String(status || ''));
}

function validateDag(steps: RunStep[]) {
  const ids = new Set(steps.map((s) => s.step_id));
  for (const step of steps) {
    for (const dep of step.depends_on || []) {
      if (!ids.has(dep)) {
        throw new Error(`dag_validation_failed: step "${step.step_id}" depends on missing step "${dep}"`);
      }
    }
  }

  const indegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  for (const s of steps) {
    indegree.set(s.step_id, 0);
    graph.set(s.step_id, []);
  }
  for (const s of steps) {
    for (const dep of s.depends_on || []) {
      graph.get(dep)?.push(s.step_id);
      indegree.set(s.step_id, Number(indegree.get(s.step_id) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of indegree.entries()) {
    if (deg === 0) queue.push(id);
  }
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited += 1;
    for (const next of graph.get(id) || []) {
      const nextDeg = Number(indegree.get(next) || 0) - 1;
      indegree.set(next, nextDeg);
      if (nextDeg === 0) queue.push(next);
    }
  }
  if (visited !== steps.length) {
    throw new Error('dag_validation_failed: cycle_detected_in_plan_steps');
  }
}

type StepOutcome = {
  status: 'success' | 'failure' | 'skipped';
  progress: Record<string, any>;
  results: Record<string, any>;
  errors: Array<Record<string, any>>;
  external_refs: Array<Record<string, any>>;
  duration_ms: number;
  credits_used: number;
  stats_delta?: Record<string, number>;
  toolcalls?: any[];
  artifacts?: any[];
};

function buildMockToolCall(runId: string, step: RunStep) {
  return {
    schema_version: 'rex.toolcall.v1',
    toolcall_id: `${runId}:${step.step_id}:${Date.now()}`,
    timestamp: new Date().toISOString(),
    step_id: step.step_id,
    tool: {
      tool_id: `mock.${step.step_id}`,
      transport: 'worker',
      display_name: step.title || step.step_id,
      source: { worker: QUEUE }
    },
    status: 'running',
    input: {},
    output: {},
    metrics: { duration_ms: 0, credits_used: 0 },
    ui: { icon: null, badge: 'Running', collapsible: true },
    errors: []
  };
}

function applyStatsDelta(baseStats: any, delta: Record<string, number> | undefined, durationMs: number, creditsUsed: number, appendedToolcalls: any[]) {
  const counts = baseStats?.counts || {};
  const nextCounts = {
    profiles_found: Number(counts.profiles_found || 0) + Number(delta?.profiles_found || 0),
    profiles_enriched: Number(counts.profiles_enriched || 0) + Number(delta?.profiles_enriched || 0),
    leads_created: Number(counts.leads_created || 0) + Number(delta?.leads_created || 0),
    messages_scheduled: Number(counts.messages_scheduled || 0) + Number(delta?.messages_scheduled || 0)
  };
  return {
    schema_version: 'rex.stats.v1',
    credits: {
      estimated: Number(baseStats?.credits?.estimated || 0),
      used: Number(baseStats?.credits?.used || 0) + Number(creditsUsed || 0),
      remaining: Number(baseStats?.credits?.remaining || 0),
      notes: ''
    },
    timing: {
      eta_seconds: Number(baseStats?.timing?.eta_seconds || 0),
      elapsed_seconds: Math.max(Number(baseStats?.timing?.elapsed_seconds || 0), Math.round(durationMs / 1000))
    },
    counts: nextCounts,
    quality: {
      avg_score_percent: Number(baseStats?.quality?.avg_score_percent || 0),
      notes: String(baseStats?.quality?.notes || '')
    },
    toolcalls: [...(Array.isArray(baseStats?.toolcalls) ? baseStats.toolcalls : []), ...appendedToolcalls]
  };
}

async function runSourceCandidatesStep(args: {
  run: any;
  runId: string;
  step: RunStep;
}): Promise<StepOutcome> {
  const { run, runId, step } = args;
  const policy = getStepPolicy(step);
  const retryCfg = policy.retry || {};
  const maxAttempts = Math.max(1, Number(retryCfg.max_attempts || 1));
  const backoffMs = Math.max(0, Number(retryCfg.backoff_seconds || 0) * 1000);
  const requireMinimum = Math.max(0, Number(policy.require_minimum_results || 0));
  const stepStart = Date.now();
  let lastError: Record<string, any> | null = null;
  let lastExternalRefs: Array<Record<string, any>> = [];
  let lastProfilesFound = 0;
  const toolcalls: any[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    publishRex2Event(
      buildRex2Event(runId, 'step.updated', {
        step_id: step.step_id,
        status: 'running',
        progress: {
          percent: 10,
          current: attempt,
          total: maxAttempts,
          label: `Attempt ${attempt}/${maxAttempts}`
        },
        results: { summary: `Starting sourcing attempt ${attempt}/${maxAttempts}.`, metrics: {} },
        external_refs: lastExternalRefs
      })
    );

    try {
      const targets = resolveSniperTargetsFromPlan(run.plan_json || {}, step.step_id);
      if (!targets.length) {
        throw { code: 'missing_sniper_targets', message: 'No Sniper target URLs found in plan input_hint.sniper_targets.' };
      }

      const launched = await launchSniperCapture({
        userId: String(run.user_id),
        workspaceId: String(run.workspace_id || run.user_id),
        targets
      });

      for (const launch of launched) {
        const createToolcall = {
          schema_version: 'rex.toolcall.v1',
          toolcall_id: `${runId}:${step.step_id}:sniper-target:${launch.targetId}:a${attempt}`,
          timestamp: new Date().toISOString(),
          step_id: step.step_id,
          tool: { tool_id: 'sniper.targets.create', transport: 'worker', display_name: 'Sniper Target Created', source: { worker: QUEUE } },
          status: 'success',
          input: { label: launch.label, post_url: launch.url },
          output: { target_id: launch.targetId, platform: launch.platform },
          metrics: { duration_ms: 0, credits_used: 0 },
          ui: { icon: null, badge: 'Complete', collapsible: true },
          errors: []
        };
        const captureToolcall = {
          schema_version: 'rex.toolcall.v1',
          toolcall_id: `${runId}:${step.step_id}:sniper-capture:${launch.jobId}:a${attempt}`,
          timestamp: new Date().toISOString(),
          step_id: step.step_id,
          tool: { tool_id: 'sniper.captureNow', transport: 'worker', display_name: 'Sniper Capture Run', source: { worker: QUEUE } },
          status: 'running',
          input: { target_id: launch.targetId, url: launch.url },
          output: { queued: true, sniper_run_id: launch.jobId },
          metrics: { duration_ms: 0, credits_used: 0 },
          ui: { icon: null, badge: 'Running', collapsible: true },
          errors: []
        };
        toolcalls.push(createToolcall, captureToolcall);
        publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: createToolcall }));
        publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: captureToolcall }));
      }

      let poll = await pollSniperCapture({
        launches: launched,
        userId: String(run.user_id),
        startedAtIso: new Date(stepStart).toISOString()
      });
      lastExternalRefs = poll.externalRefs as any[];

      while (!poll.done) {
        const currentCount = Math.max(poll.discoveredCount, poll.resultsCount, 0);
        publishRex2Event(
          buildRex2Event(runId, 'step.updated', {
            step_id: step.step_id,
            status: 'running',
            progress: {
              percent: Math.max(10, Math.min(95, Math.round((poll.completedJobs / Math.max(1, poll.totalJobs)) * 100))),
              current: currentCount,
              total: Math.max(currentCount, 1),
              label: `Sniper ${poll.completedJobs}/${poll.totalJobs} runs`
            },
            results: {
              summary: `Sniper sourcing in progress (${poll.completedJobs}/${poll.totalJobs} runs).`,
              metrics: { discovered_count: poll.discoveredCount, profiles_found: poll.resultsCount, jobs_total: poll.totalJobs, attempt }
            },
            external_refs: lastExternalRefs
          })
        );
        await sleep(2500);
        poll = await pollSniperCapture({
          launches: launched,
          userId: String(run.user_id),
          startedAtIso: new Date(stepStart).toISOString()
        });
        lastExternalRefs = poll.externalRefs as any[];
      }

      const finalCount = Math.max(poll.resultsCount, poll.discoveredCount, 0);
      lastProfilesFound = finalCount;
      const attemptFailed = poll.hasFailures && finalCount <= 0;
      if (attemptFailed) {
        throw { code: 'sniper_capture_failed', message: 'Sniper run failed with no results.', metrics: { finalCount } };
      }
      if (requireMinimum > 0 && finalCount < requireMinimum) {
        throw {
          code: 'minimum_results_not_met',
          message: `Sourcing produced ${finalCount} results; requires at least ${requireMinimum}.`,
          metrics: { finalCount, required: requireMinimum }
        };
      }

      for (const tc of toolcalls) {
        if (tc.tool?.tool_id === 'sniper.captureNow' && tc.status === 'running') {
          tc.status = 'success';
          tc.ui = { ...(tc.ui || {}), badge: 'Complete' };
          tc.output = { ...(tc.output || {}), profiles_found: finalCount };
          tc.metrics = { duration_ms: Date.now() - stepStart, credits_used: 0 };
          publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));
        }
      }

      const primaryRef = (Array.isArray(lastExternalRefs) ? lastExternalRefs[0] : null) as any;
      const artifact = {
        artifact_id: `${runId}:artifact:candidate-profiles`,
        type: 'leads',
        title: `Candidate Profiles (${finalCount})`,
        description: `Profiles sourced from ${String(primaryRef?.meta?.platform || 'web')}.`,
        status: 'complete',
        created_at: new Date().toISOString(),
        refs: {
          campaign_id: run.campaign_id || null,
          table_id: null,
          dashboard_id: null,
          file: null,
          source: {
            sniper_run_id: primaryRef?.id || null,
            job_id: primaryRef?.id || null
          }
        },
        preview: { kind: 'text', data: { summary: `${finalCount} candidate profiles captured.` } },
        actions: [],
        meta: { external_refs: lastExternalRefs || [] }
      };

      return {
        status: 'success',
        progress: { percent: 100, current: finalCount, total: Math.max(finalCount, 1), label: 'Complete' },
        results: {
          summary: `Candidate sourcing complete. ${finalCount} profiles captured.`,
          metrics: { discovered_count: poll.discoveredCount, profiles_found: poll.resultsCount, jobs_total: poll.totalJobs, attempt }
        },
        errors: [],
        external_refs: lastExternalRefs,
        duration_ms: Date.now() - stepStart,
        credits_used: 0,
        stats_delta: { profiles_found: finalCount },
        toolcalls,
        artifacts: [artifact]
      };
    } catch (e: any) {
      lastError = { code: String(e?.code || 'source_candidates_failed'), message: String(e?.message || e), meta: e?.metrics || {} };
      if (attempt < maxAttempts) {
        publishRex2Event(
          buildRex2Event(runId, 'step.updated', {
            step_id: step.step_id,
            status: 'running',
            progress: {
              percent: 15,
              current: attempt,
              total: maxAttempts,
              label: `Retrying (${attempt + 1}/${maxAttempts})`
            },
            results: { summary: `Attempt ${attempt} failed. Retrying...`, metrics: { attempt, max_attempts: maxAttempts } },
            errors: [lastError],
            external_refs: lastExternalRefs
          })
        );
        if (backoffMs > 0) await sleep(backoffMs);
        continue;
      }
      for (const tc of toolcalls) {
        if (tc.tool?.tool_id === 'sniper.captureNow' && tc.status === 'running') {
          tc.status = 'failure';
          tc.ui = { ...(tc.ui || {}), badge: 'Failed' };
          tc.errors = [lastError];
          tc.metrics = { duration_ms: Date.now() - stepStart, credits_used: 0 };
          publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));
        }
      }
      return {
        status: 'failure',
        progress: { percent: 100, current: lastProfilesFound, total: Math.max(lastProfilesFound, 1), label: 'Failed' },
        results: {
          summary: `Source candidates failed after ${maxAttempts} attempt(s).`,
          metrics: { profiles_found: lastProfilesFound, attempts: maxAttempts }
        },
        errors: [lastError],
        external_refs: lastExternalRefs,
        duration_ms: Date.now() - stepStart,
        credits_used: 0,
        stats_delta: { profiles_found: lastProfilesFound },
        toolcalls,
        artifacts: []
      };
    }
  }

  return {
    status: 'failure',
    progress: { percent: 100, current: 0, total: 1, label: 'Failed' },
    results: { summary: 'Source candidates failed.', metrics: {} },
    errors: [lastError || { code: 'source_candidates_failed', message: 'Unknown failure.' }],
    external_refs: lastExternalRefs,
    duration_ms: Date.now() - stepStart,
    credits_used: 0,
    toolcalls,
    artifacts: []
  };
}

async function runMockStep(args: { runId: string; step: RunStep; stepIndex: number; steps: RunStep[] }): Promise<StepOutcome> {
  const { runId, step, stepIndex, steps } = args;
  const stepStart = Date.now();
  const toolCall = buildMockToolCall(runId, step);
  publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: toolCall }));

  for (const percent of [30, 55, 80, 100]) {
    await sleep(350);
    publishRex2Event(
      buildRex2Event(runId, 'step.updated', {
        step_id: step.step_id,
        status: 'running',
        progress: { percent, current: stepIndex + 1, total: steps.length, label: `${percent}%` },
        results: { summary: `${step.title || step.step_id} in progress...`, metrics: {} },
        external_refs: []
      })
    );
  }

  const baseDelta: Record<string, number> = {};
  if (step.step_id === 'enrich_profiles') baseDelta.profiles_enriched = 20;
  if (step.step_id === 'create_artifacts') baseDelta.leads_created = 12;
  const artifacts: any[] = [];
  if (step.step_id === 'create_artifacts') {
    artifacts.push({
      artifact_id: `${runId}:artifact:campaign`,
      type: 'campaign',
      title: 'REX Campaign Output',
      description: 'Campaign artifact generated by REX run.',
      status: 'complete',
      created_at: new Date().toISOString(),
      refs: {
        campaign_id: null,
        table_id: null,
        dashboard_id: null,
        file: null,
        source: { sniper_run_id: null, job_id: null }
      },
      preview: { kind: 'text', data: { summary: 'Campaign created.' } },
      actions: [],
      meta: {}
    });
  }

  const finishedToolCall = {
    ...toolCall,
    status: 'success',
    output: { ok: true },
    metrics: { duration_ms: Date.now() - stepStart, credits_used: Math.max(1, stepIndex + 1) },
    ui: { ...(toolCall.ui || {}), badge: 'Complete' }
  };
  return {
    status: 'success',
    progress: { percent: 100, current: stepIndex + 1, total: steps.length, label: 'Complete' },
    results: { summary: `${step.title || step.step_id} completed.`, metrics: {} },
    errors: [],
    external_refs: [],
    duration_ms: Date.now() - stepStart,
    credits_used: Math.max(1, stepIndex + 1),
    stats_delta: baseDelta,
    toolcalls: [finishedToolCall],
    artifacts
  };
}

export const rex2RunWorker = new Worker(
  QUEUE,
  async (job) => {
    const runId = String((job.data as any)?.runId || '');
    if (!runId) throw new Error('missing_run_id');

    const now = new Date().toISOString();
    const run = await getRun(runId);
    if (!run) return { skipped: true, reason: 'run_not_found' };
    if (['success', 'failure', 'cancelled'].includes(String(run.status || ''))) {
      return { skipped: true, reason: 'terminal_status' };
    }

    let steps = normalizeSteps(run.plan_json || {});
    const startedAt = String(run?.progress_json?.started_at || now);
    let stats = (run.stats_json && typeof run.stats_json === 'object') ? run.stats_json : {};
    let artifacts = (run.artifacts_json && typeof run.artifacts_json === 'object') ? run.artifacts_json : { schema_version: 'rex.artifacts.v1', items: [] };

    await updateRun(runId, {
      status: 'running',
      progress_json: buildProgressSnapshot(runId, 'running', steps, null, startedAt, null, now),
      stats_json: {
        schema_version: 'rex.stats.v1',
        credits: { estimated: Number(stats?.credits?.estimated || 0), used: 0, remaining: Number(stats?.credits?.remaining || 0), notes: '' },
        timing: { eta_seconds: steps.length * 4, elapsed_seconds: 0 },
        counts: { profiles_found: 0, profiles_enriched: 0, leads_created: 0, messages_scheduled: 0 },
        quality: { avg_score_percent: 0, notes: '' },
        toolcalls: Array.isArray(stats?.toolcalls) ? stats.toolcalls : []
      }
    });

    try {
      validateDag(steps);

      const stepById = new Map(steps.map((s) => [s.step_id, s]));
      const running = new Map<string, Promise<{ stepId: string; outcome: StepOutcome }>>();
      let stopTriggered = false;
      let stopReason: string | null = null;

      const persistRunningSnapshot = async (currentStepId: string | null = null) => {
        await updateRun(runId, {
          status: 'running',
          progress_json: buildProgressSnapshot(runId, 'running', steps, currentStepId, startedAt, null, new Date().toISOString()),
          stats_json: stats,
          artifacts_json: artifacts
        });
      };

      const maybeMarkBlockedSteps = async () => {
        for (const step of steps) {
          if (step.status !== 'queued') continue;
          const deps = step.depends_on || [];
          if (!deps.length) continue;
          const depSteps = deps.map((d) => stepById.get(d)).filter(Boolean) as RunStep[];
          const allDepsTerminal = depSteps.every((d) => isTerminal(d.status));
          if (!allDepsTerminal) continue;
          const failedDeps = depSteps.filter((d) => ['failure', 'skipped'].includes(String(d.status || '')));
          if (!failedDeps.length) continue;

          const policy = getStepPolicy(step);
          if (policy.on_dependency_failure === 'continue_with_partial') continue;
          if (policy.on_dependency_failure === 'fail_run') {
            step.status = 'failure';
            step.errors = [{
              code: 'dependency_failure',
              message: `Dependency failed: ${failedDeps.map((d) => d.step_id).join(', ')}`
            }];
            step.results = { summary: 'Step failed because dependency failed.', metrics: {} };
            step.progress = { percent: 100, current: 0, total: 1, label: 'Blocked' };
            step.ended_at = new Date().toISOString();
            step.duration_ms = 0;
            await persistRunningSnapshot(null);
            publishRex2Event(buildRex2Event(runId, 'step.updated', {
              step_id: step.step_id,
              status: 'failure',
              progress: step.progress,
              results: step.results,
              errors: step.errors,
              external_refs: []
            }));
            stopTriggered = true;
            stopReason = `Step "${step.step_id}" configured fail_run on dependency failure.`;
            return;
          }

          step.status = 'skipped';
          step.errors = [{
            code: 'blocked_by_dependency',
            message: `Skipped because dependency failed: ${failedDeps.map((d) => d.step_id).join(', ')}`
          }];
          step.results = { summary: 'Skipped due to dependency failure.', metrics: {} };
          step.progress = { percent: 100, current: 0, total: 1, label: 'Skipped' };
          step.ended_at = new Date().toISOString();
          step.duration_ms = 0;
          await persistRunningSnapshot(null);
          publishRex2Event(buildRex2Event(runId, 'step.updated', {
            step_id: step.step_id,
            status: 'skipped',
            progress: step.progress,
            results: step.results,
            errors: step.errors,
            external_refs: []
          }));
        }
      };

      const isRunnable = (step: RunStep) => {
        if (step.status !== 'queued') return false;
        const deps = step.depends_on || [];
        if (!deps.length) return true;
        const depSteps = deps.map((d) => stepById.get(d)).filter(Boolean) as RunStep[];
        if (!depSteps.every((d) => isTerminal(d.status))) return false;
        const failedDeps = depSteps.filter((d) => ['failure', 'skipped'].includes(String(d.status || '')));
        if (!failedDeps.length) return true;
        return getStepPolicy(step).on_dependency_failure === 'continue_with_partial';
      };

      const startStep = async (step: RunStep, index: number) => {
        step.status = 'running';
        step.started_at = new Date().toISOString();
        step.ended_at = null;
        step.duration_ms = 0;
        step.errors = [];
        step.external_refs = [];
        step.results = {};
        step.progress = { percent: 10, current: index + 1, total: steps.length, label: step.title || step.step_id };
        await persistRunningSnapshot(step.step_id);
        publishRex2Event(buildRex2Event(runId, 'step.updated', {
          step_id: step.step_id,
          status: 'running',
          progress: step.progress
        }));

        const runner = (async (): Promise<StepOutcome> => {
          if (isSourceCandidateStep(step, index)) {
            return runSourceCandidatesStep({ run, runId, step });
          }
          return runMockStep({ runId, step, stepIndex: index, steps });
        })();

        running.set(
          step.step_id,
          runner.then((outcome) => ({ stepId: step.step_id, outcome })).catch((e: any) => ({
            stepId: step.step_id,
            outcome: {
              status: 'failure',
              progress: { percent: 100, current: index + 1, total: steps.length, label: 'Failed' },
              results: { summary: `${step.title || step.step_id} failed.`, metrics: {} },
              errors: [{ code: 'step_failed', message: String(e?.message || e) }],
              external_refs: [],
              duration_ms: Math.max(0, Date.now() - new Date(step.started_at || new Date().toISOString()).getTime()),
              credits_used: 0,
              stats_delta: {},
              toolcalls: [],
              artifacts: []
            }
          }))
        );
      };

      while (true) {
        const latest = await getRun(runId);
        if (String(latest?.status || '') === 'cancelled') {
          const cancelledAt = new Date().toISOString();
          const cancelledProgress = buildProgressSnapshot(runId, 'cancelled', steps, null, startedAt, cancelledAt, cancelledAt);
          await updateRun(runId, { status: 'cancelled', progress_json: cancelledProgress });
          return { cancelled: true };
        }
        if (stopTriggered) break;

        await maybeMarkBlockedSteps();
        if (stopTriggered) break;

        const queuedRunnable = steps
          .map((s, idx) => ({ step: s, idx }))
          .filter(({ step }) => isRunnable(step))
          .filter(({ step }) => !running.has(step.step_id));

        while (running.size < MAX_PARALLEL_STEPS && queuedRunnable.length > 0) {
          const next = queuedRunnable.shift()!;
          await startStep(next.step, next.idx);
        }

        if (running.size === 0) {
          const remainingQueued = steps.filter((s) => s.status === 'queued');
          if (!remainingQueued.length) break;
          // No runnable queued steps left -> skip unresolved to avoid deadlock.
          for (const step of remainingQueued) {
            step.status = 'skipped';
            step.errors = [{ code: 'not_runnable', message: 'Step remained non-runnable based on dependencies/policy.' }];
            step.results = { summary: 'Skipped because prerequisites were not satisfied.', metrics: {} };
            step.progress = { percent: 100, current: 0, total: 1, label: 'Skipped' };
            step.ended_at = new Date().toISOString();
            step.duration_ms = 0;
            publishRex2Event(buildRex2Event(runId, 'step.updated', {
              step_id: step.step_id,
              status: 'skipped',
              progress: step.progress,
              results: step.results,
              errors: step.errors,
              external_refs: []
            }));
          }
          await persistRunningSnapshot(null);
          break;
        }

        const completed = await Promise.race(
          Array.from(running.values()).map((p) => p.then((value) => value))
        );
        running.delete(completed.stepId);
        const completedStep = stepById.get(completed.stepId);
        if (!completedStep) continue;
        const policy = getStepPolicy(completedStep);
        const outcome = completed.outcome;

        completedStep.status = outcome.status as StepStatus;
        completedStep.progress = outcome.progress;
        completedStep.results = outcome.results;
        completedStep.errors = outcome.errors || [];
        completedStep.external_refs = outcome.external_refs || [];
        completedStep.ended_at = new Date().toISOString();
        completedStep.duration_ms = Number(outcome.duration_ms || 0);

        const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
        const doneCount = steps.filter((s) => isTerminal(s.status)).length;
        const remaining = Math.max(0, steps.length - doneCount);

        const appendedToolcalls = Array.isArray(outcome.toolcalls) ? outcome.toolcalls : [];
        stats = applyStatsDelta(
          {
            ...(stats || {}),
            timing: { ...(stats?.timing || {}), elapsed_seconds: elapsed, eta_seconds: remaining * 3 }
          },
          outcome.stats_delta || {},
          (Number(stats?.timing?.elapsed_seconds || 0) * 1000) + (outcome.duration_ms || 0),
          outcome.credits_used || 0,
          appendedToolcalls
        );
        stats.timing.eta_seconds = remaining * 3;
        stats.timing.elapsed_seconds = elapsed;

        for (const artifact of Array.isArray(outcome.artifacts) ? outcome.artifacts : []) {
          artifacts = upsertArtifact(artifacts, artifact);
          publishRex2Event(buildRex2Event(runId, 'artifact.created', { artifact }));
        }

        await persistRunningSnapshot(completedStep.step_id);
        publishRex2Event(buildRex2Event(runId, 'step.updated', {
          step_id: completedStep.step_id,
          status: completedStep.status,
          progress: completedStep.progress,
          results: completedStep.results,
          errors: completedStep.errors,
          external_refs: completedStep.external_refs
        }));

        if (completedStep.status === 'failure' && policy.stop_on_failure) {
          stopTriggered = true;
          stopReason = `Step "${completedStep.step_id}" failed and stop_on_failure=true`;
        }
      }

      const requiredFailures = steps.filter((s) => getStepPolicy(s).required && s.status !== 'success');
      const shouldFailRun = Boolean(stopTriggered || requiredFailures.length > 0);
      if (shouldFailRun) {
        const failedAt = new Date().toISOString();
        const errorMessage = stopReason || `Required step(s) did not succeed: ${requiredFailures.map((s) => s.step_id).join(', ')}`;
        await updateRun(runId, {
          status: 'failure',
          progress_json: {
            ...buildProgressSnapshot(runId, 'failure', steps, null, startedAt, failedAt, failedAt),
            error: { code: 'run_failed', message: errorMessage }
          },
          stats_json: stats,
          artifacts_json: artifacts
        });
        publishRex2Event(buildRex2Event(runId, 'run.failed', {
          status: 'failure',
          error: { code: 'run_failed', message: errorMessage }
        }));
        return { ok: false, reason: errorMessage };
      }

      const completedAt = new Date().toISOString();
      const finalProgress = buildProgressSnapshot(runId, 'success', steps, null, startedAt, completedAt, completedAt);
      await updateRun(runId, {
        status: 'success',
        progress_json: finalProgress,
        stats_json: {
          ...(stats || {}),
          timing: {
            ...(stats?.timing || {}),
            eta_seconds: 0,
            elapsed_seconds: Math.max(
              Number(stats?.timing?.elapsed_seconds || 0),
              Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
            )
          }
        }
      });
      publishRex2Event(buildRex2Event(runId, 'run.completed', { status: 'success', completed_at: completedAt }));
      return { ok: true };
    } catch (e: any) {
      const failedAt = new Date().toISOString();
      await updateRun(runId, {
        status: 'failure',
        progress_json: {
          ...buildProgressSnapshot(runId, 'failure', steps, null, startedAt, failedAt, failedAt),
          error: { code: 'run_failed', message: String(e?.message || e) }
        }
      });
      publishRex2Event(
        buildRex2Event(runId, 'run.failed', {
          status: 'failure',
          error: { code: 'run_failed', message: String(e?.message || e) }
        })
      );
      throw e;
    }
  },
  { connection, concurrency: 2 }
);

