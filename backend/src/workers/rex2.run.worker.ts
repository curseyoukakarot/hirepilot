import { Worker } from 'bullmq';
import { connection } from '../queues/redis';
import { supabaseDb } from '../lib/supabase';
import { buildRex2Event, publishRex2Event } from '../rex2/pubsub';
import { launchSniperCapture, pollSniperCapture, resolveSniperTargetsFromPlan } from '../services/rex2/sniperBridge';

const QUEUE = 'rex2:run';

type RunStatus = 'queued' | 'running' | 'success' | 'failure' | 'cancelled';

type RunStep = {
  step_id: string;
  title?: string;
  category?: string;
  status?: string;
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
  const { data, error } = await supabaseDb
    .from('rex_agent_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

async function updateRun(runId: string, patch: Record<string, any>) {
  const { data, error } = await supabaseDb
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
    { step_id: 'source_candidates', title: 'Source candidates', category: 'sourcing', status: 'queued' },
    { step_id: 'enrich_profiles', title: 'Enrich profiles', category: 'enrichment', status: 'queued' },
    { step_id: 'score_and_rank', title: 'Score and rank', category: 'scoring', status: 'queued' },
    { step_id: 'create_artifacts', title: 'Create artifacts', category: 'crm', status: 'queued' }
  ];
}

function normalizeSteps(planJson: any): RunStep[] {
  const raw = Array.isArray(planJson?.steps) ? planJson.steps : [];
  const mapped = raw
    .map((s: any, i: number) => ({
      step_id: String(s?.step_id || `step_${i + 1}`),
      title: s?.title ? String(s.title) : undefined,
      category: s?.category ? String(s.category) : 'other',
      status: 'queued'
    }))
    .filter((s: RunStep) => s.step_id);
  return mapped.length ? mapped : defaultSteps();
}

function buildProgressSnapshot(runId: string, status: RunStatus, steps: RunStep[], currentStepId: string | null, startedAt: string | null, completedAt: string | null, updatedAt: string) {
  const completed = steps.filter((s) => s.status === 'success' || s.status === 'skipped').length;
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
      items_processed: Math.min(100, Math.round((completed / Math.max(1, steps.length)) * 100))
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
      for (let i = 0; i < steps.length; i += 1) {
        const latest = await getRun(runId);
        if (String(latest?.status || '') === 'cancelled') {
          const cancelledAt = new Date().toISOString();
          const cancelledProgress = buildProgressSnapshot(runId, 'cancelled', steps, null, startedAt, cancelledAt, cancelledAt);
          await updateRun(runId, { status: 'cancelled', progress_json: cancelledProgress });
          return { cancelled: true };
        }

        const step = steps[i];
        step.status = 'running';
        const stepStart = Date.now();
        step.started_at = new Date().toISOString();
        step.ended_at = null;
        step.duration_ms = 0;
        step.errors = [];
        step.external_refs = [];
        step.results = {};
        step.progress = { percent: 10, current: i, total: steps.length, label: step.title || step.step_id };

        await updateRun(runId, {
          progress_json: buildProgressSnapshot(runId, 'running', steps, step.step_id, startedAt, null, new Date().toISOString())
        });
        publishRex2Event(
          buildRex2Event(runId, 'step.updated', {
            step_id: step.step_id,
            status: 'running',
            progress: step.progress
          })
        );

        const toolCall = {
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
        const shouldUseSniperBridge = isSourceCandidateStep(step, i);
        let durationMs = 0;
        let creditsUsed = Math.max(1, i + 1);

        if (shouldUseSniperBridge) {
          const stepToolcalls: any[] = [];
          const targets = resolveSniperTargetsFromPlan(run.plan_json || {}, step.step_id);
          if (!targets.length) {
            const fallbackUrl = 'https://www.linkedin.com/jobs';
            const err = {
              code: 'missing_sniper_targets',
              message: `No Sniper target URLs found in plan input_hint.sniper_targets. Provide URL targets (example placeholder: ${fallbackUrl}).`
            };
            step.status = 'failure';
            step.errors = [err];
            step.results = {
              summary: 'Source candidates failed: missing Sniper URLs in plan input hint.',
              metrics: { discovered_count: 0, profiles_found: 0 }
            };
            step.progress = { percent: 100, current: i + 1, total: steps.length, label: 'Missing input' };
            step.ended_at = new Date().toISOString();
            step.duration_ms = Date.now() - stepStart;
            durationMs = step.duration_ms;
            creditsUsed = 0;
            await updateRun(runId, {
              progress_json: buildProgressSnapshot(runId, 'running', steps, step.step_id, startedAt, null, new Date().toISOString())
            });
            publishRex2Event(
              buildRex2Event(runId, 'step.updated', {
                step_id: step.step_id,
                status: 'failure',
                progress: step.progress,
                results: step.results,
                errors: step.errors,
                external_refs: []
              })
            );
          } else {
            const launched = await launchSniperCapture({
              userId: String(run.user_id),
              workspaceId: String(run.workspace_id || run.user_id),
              targets
            });

            for (const launch of launched) {
              const createToolcall = {
                schema_version: 'rex.toolcall.v1',
                toolcall_id: `${runId}:${step.step_id}:sniper-target:${launch.targetId}`,
                timestamp: new Date().toISOString(),
                step_id: step.step_id,
                tool: {
                  tool_id: 'sniper.targets.create',
                  transport: 'worker',
                  display_name: 'Sniper Target Created',
                  source: { worker: QUEUE }
                },
                status: 'success',
                input: { label: launch.label, post_url: launch.url },
                output: { target_id: launch.targetId, platform: launch.platform },
                metrics: { duration_ms: 0, credits_used: 0 },
                ui: { icon: null, badge: 'Complete', collapsible: true },
                errors: []
              };
              const captureToolcall = {
                schema_version: 'rex.toolcall.v1',
                toolcall_id: `${runId}:${step.step_id}:sniper-capture:${launch.jobId}`,
                timestamp: new Date().toISOString(),
                step_id: step.step_id,
                tool: {
                  tool_id: 'sniper.captureNow',
                  transport: 'worker',
                  display_name: 'Sniper Capture Run',
                  source: { worker: QUEUE }
                },
                status: 'running',
                input: { target_id: launch.targetId, url: launch.url },
                output: { queued: true, sniper_run_id: launch.jobId },
                metrics: { duration_ms: 0, credits_used: 0 },
                ui: { icon: null, badge: 'Running', collapsible: true },
                errors: []
              };
              stepToolcalls.push(createToolcall, captureToolcall);
              publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: createToolcall }));
              publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: captureToolcall }));
            }

            let poll = await pollSniperCapture({
              launches: launched,
              userId: String(run.user_id),
              startedAtIso: step.started_at || new Date().toISOString()
            });
            step.external_refs = poll.externalRefs as any[];

            while (!poll.done) {
              const percent = Math.max(10, Math.min(95, Math.round((poll.completedJobs / Math.max(1, poll.totalJobs)) * 100)));
              step.progress = {
                percent,
                current: Math.max(poll.discoveredCount, poll.resultsCount),
                total: Math.max(Math.max(poll.discoveredCount, poll.resultsCount), 1),
                label: `Sniper ${poll.completedJobs}/${poll.totalJobs} runs`
              };
              step.results = {
                summary: `Sniper sourcing in progress (${poll.completedJobs}/${poll.totalJobs} runs).`,
                metrics: { discovered_count: poll.discoveredCount, profiles_found: poll.resultsCount, jobs_total: poll.totalJobs }
              };
              await updateRun(runId, {
                progress_json: buildProgressSnapshot(runId, 'running', steps, step.step_id, startedAt, null, new Date().toISOString())
              });
              publishRex2Event(
                buildRex2Event(runId, 'step.updated', {
                  step_id: step.step_id,
                  status: 'running',
                  progress: step.progress,
                  results: step.results,
                  external_refs: step.external_refs
                })
              );
              await sleep(2500);
              poll = await pollSniperCapture({
                launches: launched,
                userId: String(run.user_id),
                startedAtIso: step.started_at || new Date().toISOString()
              });
            }

            const finalCount = Math.max(poll.resultsCount, poll.discoveredCount, 0);
            step.progress = {
              percent: 100,
              current: finalCount,
              total: Math.max(finalCount, 1),
              label: poll.hasFailures ? 'Completed with issues' : 'Complete'
            };
            step.results = {
              summary: `Candidate sourcing complete. ${finalCount} profiles captured.`,
              metrics: { discovered_count: poll.discoveredCount, profiles_found: poll.resultsCount, jobs_total: poll.totalJobs }
            };
            step.external_refs = poll.externalRefs as any[];
            step.errors = poll.hasFailures ? [{ code: 'sniper_partial_failure', message: 'One or more Sniper runs failed.' }] : [];
            step.status = poll.hasFailures && finalCount <= 0 ? 'failure' : 'success';
            step.ended_at = new Date().toISOString();
            step.duration_ms = Date.now() - stepStart;
            durationMs = step.duration_ms;
            creditsUsed = 0;

            for (const tc of stepToolcalls) {
              if (tc.tool?.tool_id === 'sniper.captureNow') {
                tc.status = step.status === 'success' ? 'success' : 'failure';
                tc.ui = { ...(tc.ui || {}), badge: step.status === 'success' ? 'Complete' : 'Failed' };
                tc.metrics = { duration_ms: durationMs, credits_used: 0 };
                tc.output = { ...(tc.output || {}), profiles_found: finalCount };
                if (step.status !== 'success') {
                  tc.errors = step.errors || [];
                }
                publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));
              }
            }

            const primaryRef = (Array.isArray(step.external_refs) ? step.external_refs[0] : null) as any;
            const firstPlatform = launched[0]?.platform || 'web';
            const artifact = {
              artifact_id: `${runId}:artifact:candidate-profiles`,
              type: 'leads',
              title: `Candidate Profiles (${finalCount})`,
              description: `Profiles sourced from ${firstPlatform}.`,
              status: step.status === 'success' ? 'complete' : 'failed',
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
              meta: { external_refs: step.external_refs || [] }
            };
            artifacts = upsertArtifact(artifacts, artifact);
            publishRex2Event(buildRex2Event(runId, 'artifact.created', { artifact }));

            await updateRun(runId, {
              progress_json: buildProgressSnapshot(runId, 'running', steps, step.step_id, startedAt, null, new Date().toISOString()),
              artifacts_json: artifacts
            });

            publishRex2Event(
              buildRex2Event(runId, 'step.updated', {
                step_id: step.step_id,
                status: step.status,
                progress: step.progress,
                results: step.results,
                errors: step.errors,
                external_refs: step.external_refs
              })
            );
          }
        } else {
          publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: toolCall }));
          for (const percent of [30, 55, 80, 100]) {
            await sleep(350);
            step.progress = { percent, current: i + 1, total: steps.length, label: `${percent}%` };
            step.results = { summary: `${step.title || step.step_id} in progress...`, metrics: {} };
            publishRex2Event(
              buildRex2Event(runId, 'step.updated', {
                step_id: step.step_id,
                status: 'running',
                progress: step.progress,
                results: step.results,
                external_refs: []
              })
            );
          }

          step.status = 'success';
          step.ended_at = new Date().toISOString();
          step.duration_ms = Date.now() - stepStart;
          durationMs = step.duration_ms;
        }

        const nextStats = {
          schema_version: 'rex.stats.v1',
          credits: {
            estimated: Number(stats?.credits?.estimated || steps.length * 2),
            used: Number(stats?.credits?.used || 0) + creditsUsed,
            remaining: Number(stats?.credits?.remaining || 0),
            notes: ''
          },
          timing: {
            eta_seconds: Math.max(0, (steps.length - (i + 1)) * 3),
            elapsed_seconds: Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
          },
          counts: {
            profiles_found: Number(stats?.counts?.profiles_found || 0) + (step.step_id === 'source_candidates' ? Number(step?.results?.metrics?.profiles_found ?? 0) : 0),
            profiles_enriched: Number(stats?.counts?.profiles_enriched || 0) + (step.step_id === 'enrich_profiles' ? 20 : 0),
            leads_created: Number(stats?.counts?.leads_created || 0) + (step.step_id === 'create_artifacts' ? 12 : 0),
            messages_scheduled: Number(stats?.counts?.messages_scheduled || 0)
          },
          quality: {
            avg_score_percent: Math.min(100, Math.round(((Number(stats?.quality?.avg_score_percent || 70) + 72) / 2))),
            notes: ''
          },
          toolcalls: [
            ...(Array.isArray(stats?.toolcalls) ? stats.toolcalls : []),
            {
              ...toolCall,
              status: step.status === 'failure' ? 'failure' : 'success',
              output: step.status === 'failure' ? { ok: false, error: step?.errors?.[0] || { code: 'step_failed' } } : { ok: true },
              metrics: { duration_ms: durationMs, credits_used: creditsUsed },
              ui: { ...toolCall.ui, badge: step.status === 'failure' ? 'Failed' : 'Complete' },
              errors: step.status === 'failure' ? (step.errors || []) : []
            }
          ]
        };

        if (step.step_id === 'create_artifacts') {
          const artifact = {
            artifact_id: `${runId}:artifact:campaign`,
            type: 'campaign',
            title: 'REX Campaign Output',
            description: 'Campaign artifact generated by REX run.',
            status: 'complete',
            created_at: new Date().toISOString(),
            refs: {
              campaign_id: run.campaign_id || null,
              table_id: null,
              dashboard_id: null,
              file: null,
              source: { sniper_run_id: null, job_id: null }
            },
            preview: { kind: 'text', data: { summary: 'Campaign created.' } },
            actions: [],
            meta: {}
          };
          const items = Array.isArray(artifacts?.items) ? artifacts.items : [];
          artifacts = { schema_version: 'rex.artifacts.v1', items: [...items, artifact] };
          publishRex2Event(buildRex2Event(runId, 'artifact.created', { artifact }));
        }

        stats = nextStats;
        await updateRun(runId, {
          status: 'running',
          progress_json: buildProgressSnapshot(runId, 'running', steps, step.step_id, startedAt, null, new Date().toISOString()),
          stats_json: nextStats,
          artifacts_json: artifacts
        });
        publishRex2Event(
          buildRex2Event(runId, 'step.updated', {
            step_id: step.step_id,
            status: step.status === 'failure' ? 'failure' : 'success',
            progress: step.progress || { percent: 100, current: i + 1, total: steps.length, label: step.status === 'failure' ? 'Failed' : 'Complete' },
            results: step.results || { summary: `${step.title || step.step_id} completed.`, metrics: {} },
            errors: step.errors || [],
            external_refs: step.external_refs || []
          })
        );
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

