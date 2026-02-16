import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace from '../middleware/activeWorkspace';
import { supabase as supabaseClient, supabaseAdmin, supabaseDb as supabaseDbClient } from '../lib/supabase';
import { applyWorkspaceScope } from '../lib/workspaceScope';
import { rex2RunQueue } from '../queues/redis';
import { buildRex2Event, publishRex2Event, subscribeRex2Events } from '../rex2/pubsub';

const router = express.Router();
// EventSource cannot set custom Authorization headers in browsers.
// Allow token passthrough via query string for SSE GET only.
router.use((req, _res, next) => {
  if (req.method === 'GET' && req.path.endsWith('/stream')) {
    const auth = String(req.headers.authorization || '').trim();
    const token = String((req.query as any)?.access_token || '').trim();
    if (!auth && token) {
      (req.headers as any).authorization = `Bearer ${token}`;
    }
  }
  next();
});
router.use(requireAuth as any, activeWorkspace as any);

type RunStatus = 'queued' | 'running' | 'success' | 'failure' | 'cancelled';

function getDb() {
  const db = (supabaseDbClient as any) || (supabaseAdmin as any) || (supabaseClient as any);
  if (!db || typeof db.from !== 'function') {
    throw new Error('supabase_db_client_unavailable');
  }
  return db;
}

const scopedRuns = (req: Request) =>
  applyWorkspaceScope(getDb().from('rex_agent_runs'), {
    workspaceId: (req as any).workspaceId || null,
    userId: (req as any)?.user?.id || null,
    ownerColumn: 'user_id'
  });

function normalizePlan(planJson: any, runContext: { conversationId: string | null; campaignId: string | null }) {
  const steps = Array.isArray(planJson?.steps) ? planJson.steps : [];
  return {
    schema_version: 'rex.plan.v1',
    plan_id: String(planJson?.plan_id || randomUUID()),
    created_at: new Date().toISOString(),
    source: {
      generator: String(planJson?.source?.generator || 'rex2'),
      model: planJson?.source?.model || null,
      conversation_id: runContext.conversationId,
      campaign_id: runContext.campaignId
    },
    goal: {
      title: String(planJson?.goal?.title || 'Recruiting execution plan'),
      description: String(planJson?.goal?.description || ''),
      constraints: {
        location: Array.isArray(planJson?.goal?.constraints?.location) ? planJson.goal.constraints.location : [],
        seniority: Array.isArray(planJson?.goal?.constraints?.seniority) ? planJson.goal.constraints.seniority : [],
        skills: Array.isArray(planJson?.goal?.constraints?.skills) ? planJson.goal.constraints.skills : [],
        must_have: Array.isArray(planJson?.goal?.constraints?.must_have) ? planJson.goal.constraints.must_have : [],
        nice_to_have: Array.isArray(planJson?.goal?.constraints?.nice_to_have) ? planJson.goal.constraints.nice_to_have : [],
        exclude: Array.isArray(planJson?.goal?.constraints?.exclude) ? planJson.goal.constraints.exclude : [],
        time_window: planJson?.goal?.constraints?.time_window || null
      }
    },
    assumptions: Array.isArray(planJson?.assumptions) ? planJson.assumptions : [],
    estimates: planJson?.estimates || {
      credits: { min: 0, max: 0, unit: 'credits', notes: '' },
      time: { min_minutes: 0, max_minutes: 0, notes: '' },
      risk: { level: 'low', notes: '' }
    },
    steps,
    approval: {
      required: Boolean(planJson?.approval?.required ?? true),
      reason: String(planJson?.approval?.reason || 'User approval required before run execution.'),
      approved_at: planJson?.approval?.approved_at || null,
      approved_by: planJson?.approval?.approved_by || null
    }
  };
}

function makeInitialProgress(plan: any) {
  const steps = (Array.isArray(plan?.steps) ? plan.steps : []).map((s: any, i: number) => ({
    step_id: String(s?.step_id || `step_${i + 1}`),
    status: 'queued',
    progress: { percent: 0, label: 'Queued', current: 0, total: 0 },
    timing: { started_at: null, ended_at: null, duration_ms: 0 },
    results: { summary: '', metrics: {}, quality: { score_percent: 0, notes: '', breakdown: {} } },
    links: { run_detail: null, artifact_refs: [] },
    errors: [],
    external_refs: []
  }));
  return {
    schema_version: 'rex.runprogress.v1',
    run_id: null,
    status: 'queued',
    current_step_id: null,
    started_at: null,
    updated_at: new Date().toISOString(),
    completed_at: null,
    counters: {
      steps_total: steps.length,
      steps_completed: 0,
      items_total: 0,
      items_processed: 0
    },
    steps
  };
}

// POST /api/rex2/runs
router.post('/runs', async (req: Request, res: Response) => {
  try {
    const userId = String((req as any)?.user?.id || '').trim();
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = ((req as any).workspaceId as string | undefined) || null;

    const body = req.body || {};
    const conversationId = body?.conversation_id ? String(body.conversation_id) : (body?.conversationId ? String(body.conversationId) : null);
    const campaignId = body?.campaign_id ? String(body.campaign_id) : (body?.campaignId ? String(body.campaignId) : null);

    const plan = normalizePlan(body?.plan_json || body?.plan || {}, { conversationId, campaignId });
    const initialProgress = makeInitialProgress(plan);
    const artifacts = { schema_version: 'rex.artifacts.v1', items: [] };
    const stats = {
      schema_version: 'rex.stats.v1',
      credits: { estimated: 0, used: 0, remaining: 0, notes: '' },
      timing: { eta_seconds: 0, elapsed_seconds: 0 },
      counts: { profiles_found: 0, profiles_enriched: 0, leads_created: 0, messages_scheduled: 0 },
      quality: { avg_score_percent: 0, notes: '' },
      toolcalls: []
    };

    const insertPayload = {
      user_id: userId,
      workspace_id: workspaceId,
      conversation_id: conversationId,
      campaign_id: campaignId,
      status: 'queued' as RunStatus,
      plan_json: plan,
      progress_json: initialProgress,
      artifacts_json: artifacts,
      stats_json: stats
    };

    const { data, error } = await scopedRuns(req)
      .insert(insertPayload as any)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message || 'failed_to_create_run' });
    return res.status(201).json({ run: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_run' });
  }
});

// GET /api/rex2/runs/:id
router.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    const runId = String(req.params.id || '').trim();
    if (!runId) return res.status(400).json({ error: 'missing_run_id' });

    const { data, error } = await scopedRuns(req)
      .select('*')
      .eq('id', runId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message || 'failed_to_fetch_run' });
    if (!data) return res.status(404).json({ error: 'run_not_found' });
    return res.json({ run: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_run' });
  }
});

// POST /api/rex2/runs/:id/start
router.post('/runs/:id/start', async (req: Request, res: Response) => {
  try {
    const runId = String(req.params.id || '').trim();
    const userId = String((req as any)?.user?.id || '').trim();
    if (!runId) return res.status(400).json({ error: 'missing_run_id' });
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data: run, error: readErr } = await scopedRuns(req)
      .select('*')
      .eq('id', runId)
      .maybeSingle();
    if (readErr) return res.status(500).json({ error: readErr.message || 'failed_to_load_run' });
    if (!run) return res.status(404).json({ error: 'run_not_found' });
    if (['success', 'failure', 'cancelled'].includes(String((run as any).status || ''))) {
      return res.status(409).json({ error: 'run_already_terminal', run });
    }

    const now = new Date().toISOString();
    const existingProgress = ((run as any).progress_json && typeof (run as any).progress_json === 'object')
      ? (run as any).progress_json
      : makeInitialProgress((run as any).plan_json || {});
    const nextProgress = {
      ...existingProgress,
      run_id: runId,
      status: 'running',
      started_at: existingProgress.started_at || now,
      updated_at: now
    };

    const { data: updated, error: upErr } = await scopedRuns(req)
      .update({
        status: 'running',
        progress_json: nextProgress,
        updated_at: now
      } as any)
      .eq('id', runId)
      .select('*')
      .single();
    if (upErr) return res.status(500).json({ error: upErr.message || 'failed_to_start_run' });

    await rex2RunQueue.add(
      'rex2_run',
      { runId, userId },
      { removeOnComplete: 200, removeOnFail: 500, attempts: 1 }
    );

    publishRex2Event(
      buildRex2Event(runId, 'run.started', {
        status: 'running',
        started_at: nextProgress.started_at
      })
    );

    return res.status(202).json({ run: updated, queued: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_start_run' });
  }
});

// GET /api/rex2/runs/:id/stream (SSE)
router.get('/runs/:id/stream', async (req: Request, res: Response) => {
  try {
    const runId = String(req.params.id || '').trim();
    if (!runId) return res.status(400).json({ error: 'missing_run_id' });

    const { data: run, error } = await scopedRuns(req)
      .select('*')
      .eq('id', runId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message || 'failed_to_load_run' });
    if (!run) return res.status(404).json({ error: 'run_not_found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as any).flushHeaders?.();

    res.write('retry: 2000\n\n');

    const snapshotEvent = buildRex2Event(runId, 'run.snapshot', {
      status: (run as any).status,
      progress_json: (run as any).progress_json || {},
      artifacts_json: (run as any).artifacts_json || {},
      stats_json: (run as any).stats_json || {}
    });
    res.write(`event: ${snapshotEvent.type}\n`);
    res.write(`data: ${JSON.stringify(snapshotEvent)}\n\n`);

    const unsubscribe = subscribeRex2Events(runId, (event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      try {
        res.end();
      } catch {}
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_stream_run' });
  }
});

export default router;

