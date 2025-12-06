import express, { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { runHealthCheck } from '../repoAgent/healthCheckRunner';
import { runScenarioById } from '../repoAgent/scenarioRunner';
import { runSweepById } from '../repoAgent/sweepRunner';
import { handleChatMessage } from '../repoAgent/chatService';
import {
  getRepoAgentSettings,
  updateRepoAgentSettings,
} from '../repoAgent/settingsService';
import {
  sendHealthCheckSummary,
  sendScenarioFailureAlert,
  sendSweepViolationsAlert,
} from '../repoAgent/slackNotifier';
import {
  sendHealthCheckSummaryEmail,
  sendScenarioFailureEmail,
  sendSweepViolationsEmail,
} from '../repoAgent/emailNotifier';
import { explainError, proposePatch } from '../repoAgent/llmClient';
import { storeProposedPatch } from '../repoAgent/patchService';
import {
  RepoAgentConversation,
  RepoAgentMessage,
  RepoAgentSettings,
} from '../repoAgent/types';
import { HealthCheckRunResult, SeverityLevel } from '../repoAgent/types';
import { runScheduledRepoGuardianCheck } from '../workers/repoGuardianCron';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role?: string; email?: string };
}

const router = express.Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get('/health-checks', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const { data, error, count } = await supabaseAdmin
      .from('repo_health_checks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      items: (data || []).map((row) => mapHealthCheck(row, false)),
      count: count ?? data?.length ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    handleRouteError(res, error, 'list_health_checks');
  }
});

router.get('/health-checks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('repo_health_checks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(mapHealthCheck(data, true));
  } catch (error) {
    handleRouteError(res, error, 'get_health_check');
  }
});

router.post('/health-checks/run', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const manual = Boolean(req.body?.manual ?? true);
    const triggeredBy: 'system' | 'user' = manual ? 'user' : 'system';
    const triggeredByUserId = triggeredBy === 'user' ? userId : undefined;

    const { id } = await runHealthCheck(triggeredBy, triggeredByUserId);
    const detail = await fetchHealthCheckById(id);
    if (!detail) {
      res.status(500).json({ error: 'health_check_missing' });
      return;
    }

    if (shouldAlertOnHealthCheck(detail.result)) {
      const payload = {
        healthCheckId: detail.id,
        summary: detail.result.summary,
        severity: detail.result.severity as SeverityLevel,
        branch: detail.branch,
        triggeredBy,
      };
      notifyAll([
        sendHealthCheckSummary(payload),
        sendHealthCheckSummaryEmail(payload),
      ]);
    }

    res.json(detail);
  } catch (error) {
    handleRouteError(res, error, 'run_health_check');
  }
});

router.post('/run-full-check', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const result = await runScheduledRepoGuardianCheck({
      force: true,
      triggeredBy: 'user',
      userId,
    });
    res.json(result);
  } catch (error) {
    handleRouteError(res, error, 'run_full_check');
  }
});

router.get('/errors', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const { data, error, count } = await supabaseAdmin
      .from('repo_errors')
      .select('*', { count: 'exact' })
      .order('last_seen_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    res.json({
      items: (data || []).map(mapRepoError),
      count: count ?? data?.length ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    handleRouteError(res, error, 'list_errors');
  }
});

router.get('/errors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('repo_errors')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(mapRepoError(data));
  } catch (error) {
    handleRouteError(res, error, 'get_error');
  }
});

router.post('/errors/:id/auto-fix', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: errorRow, error } = await supabaseAdmin
      .from('repo_errors')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!errorRow) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const explanation = await explainError({
      errorMessage: errorRow.error_message,
      stackTrace: errorRow.stack_trace || undefined,
      contextJson: errorRow.context_json || undefined,
    });

    const diffs = await proposePatch({
      context: {
        error: errorRow,
      },
      codeSnippets: [],
      errorDescription: errorRow.error_message,
    });

    const storedPatch = await storeProposedPatch({
      diffs,
      summary: explanation,
      relatedErrorId: errorRow.id,
    });

    res.json({
      explanation,
      diffs,
      patch: storedPatch,
    });
  } catch (error) {
    handleRouteError(res, error, 'auto_fix_error');
  }
});

router.post('/errors/report', async (req, res) => {
  try {
    const { message, stack, context, route } = req.body || {};
    if (!message) {
      res.status(400).json({ error: 'missing_message' });
      return;
    }
    const normalizedStack =
      typeof stack === 'string' ? stack : JSON.stringify(stack || {});
    const signature = createHash('sha256')
      .update(`${message}::${route || ''}::${normalizedStack || ''}`)
      .digest('hex');
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from('repo_errors')
      .select('*')
      .eq('error_signature', signature)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('repo_errors')
        .update({
          error_message: message,
          last_seen_at: now,
          last_context_route: route || existing.last_context_route,
          stack_trace: stack || existing.stack_trace,
          context_json: context ?? existing.context_json,
          occurrences: (existing.occurrences || 0) + 1,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('repo_errors')
        .insert([
          {
            error_signature: signature,
            error_message: message,
            first_seen_at: now,
            last_seen_at: now,
            occurrences: 1,
            status: 'open',
            last_context_route: route || null,
            stack_trace: stack || null,
            context_json: context ?? null,
          },
        ])
        .select('*')
        .single();
      if (error) throw error;
      result = data;
    }

    res.json(mapRepoError(result));
  } catch (error) {
    handleRouteError(res, error, 'report_error');
  }
});

router.get('/scenarios', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('repo_scenarios')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    handleRouteError(res, error, 'list_scenarios');
  }
});

router.get('/scenarios/:id/latest-run', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('repo_scenario_runs')
      .select('*')
      .eq('scenario_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(mapScenarioRun(data));
  } catch (error) {
    handleRouteError(res, error, 'get_latest_scenario_run');
  }
});

router.post('/scenarios/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const scenario = await fetchScenario(id);
    if (!scenario) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const { runId, result } = await runScenarioById(id);
    const runRecord = await fetchScenarioRun(runId);
    if (!runRecord) {
      res.status(500).json({ error: 'scenario_run_missing' });
      return;
    }

    if (result.status === 'fail') {
      await upsertSyntheticError({
        signature: `scenario:${scenario.id}`,
        message: `Scenario ${scenario.name} failed`,
        context: { failingStep: result.failingStep, logs: result.logs },
      });
      notifyAll([
        sendScenarioFailureAlert({
          scenarioRunId: runId,
          scenarioName: scenario.label || scenario.name,
          failingStep: result.failingStep,
          logs: result.logs,
        }),
        sendScenarioFailureEmail({
          scenarioRunId: runId,
          scenarioName: scenario.label || scenario.name,
          failingStep: result.failingStep,
          logs: result.logs,
        }),
      ]);
    }

    res.json(mapScenarioRun(runRecord));
  } catch (error) {
    handleRouteError(res, error, 'run_scenario');
  }
});

router.get('/sweeps', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('repo_integrity_sweeps')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    handleRouteError(res, error, 'list_sweeps');
  }
});

router.get('/sweeps/:id/latest-run', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('repo_integrity_sweep_runs')
      .select('*')
      .eq('sweep_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(mapSweepRun(data));
  } catch (error) {
    handleRouteError(res, error, 'get_latest_sweep_run');
  }
});

router.post('/sweeps/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const sweep = await fetchSweep(id);
    if (!sweep) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const { runId, result } = await runSweepById(id);
    const runRecord = await fetchSweepRun(runId);
    if (!runRecord) {
      res.status(500).json({ error: 'sweep_run_missing' });
      return;
    }

    if (result.status === 'violations') {
      await upsertSyntheticError({
        signature: `sweep:${sweep.id}`,
        message: `Sweep ${sweep.name} detected violations`,
        context: {
          violationSummary: result.violationSummary,
          violationCount: result.violationCount,
        },
      });
      notifyAll([
        sendSweepViolationsAlert({
          sweepRunId: runId,
          sweepName: sweep.label || sweep.name,
          violationSummary: result.violationSummary,
          violationCount: result.violationCount,
        }),
        sendSweepViolationsEmail({
          sweepRunId: runId,
          sweepName: sweep.label || sweep.name,
          violationSummary: result.violationSummary,
          violationCount: result.violationCount,
        }),
      ]);
    }

    res.json(mapSweepRun(runRecord));
  } catch (error) {
    handleRouteError(res, error, 'run_sweep');
  }
});

router.get('/chat/:conversationId', async (req, res) => {
  try {
    const conversation = await loadConversation(req.params.conversationId);
    if (!conversation) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(conversation);
  } catch (error) {
    handleRouteError(res, error, 'get_chat');
  }
});

router.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { conversationId, message, relatedErrorId, relatedHealthCheckId, relatedScenarioRunId, relatedSweepRunId } =
      req.body || {};
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'missing_message' });
      return;
    }

    const conversation = await handleChatMessage({
      conversationId,
      userId,
      message,
      relatedErrorId,
      relatedHealthCheckId,
      relatedScenarioRunId,
      relatedSweepRunId,
    });

    res.json(conversation);
  } catch (error) {
    handleRouteError(res, error, 'chat_message');
  }
});

router.get('/settings', async (_req, res) => {
  try {
    const settings = await getRepoAgentSettings();
    res.json(settings);
  } catch (error) {
    handleRouteError(res, error, 'get_settings');
  }
});

router.put('/settings', async (req, res) => {
  try {
    const partial = req.body as Partial<RepoAgentSettings>;
    const updated = await updateRepoAgentSettings(partial || {});
    if (
      Object.prototype.hasOwnProperty.call(partial || {}, 'nightlyCheckEnabled') ||
      Object.prototype.hasOwnProperty.call(partial || {}, 'nightlyCheckTimeUtc')
    ) {
      logger.info(
        '[repoAgent][settings] Nightly schedule updated – TODO: ensure cron job reflects new schedule.'
      );
    }
    res.json(updated);
  } catch (error) {
    handleRouteError(res, error, 'update_settings');
  }
});

export default router;

async function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user;
    if (!user?.id) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const cachedRole = String(user.role || '').toLowerCase();
    if (cachedRole === 'super_admin') {
      return next();
    }
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (String(data?.role || '').toLowerCase() === 'super_admin') {
      return next();
    }
    res.status(403).json({ error: 'forbidden' });
  } catch (error) {
    logger.error({ error }, '[repoAgent][requireSuperAdmin] verification failed');
    res.status(500).json({ error: 'server_error' });
  }
}

function parsePagination(req: Request) {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || ''), 10) || 20, 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset || ''), 10) || 0, 0);
  return { limit, offset };
}

function mapHealthCheck(row: any, includeLogs: boolean) {
  const base = {
    id: row.id,
    createdAt: row.created_at,
    triggeredBy: row.triggered_by,
    triggeredByUserId: row.triggered_by_user_id,
    branch: row.branch,
    testsStatus: row.tests_status,
    lintStatus: row.lint_status,
    buildStatus: row.build_status,
    severity: row.severity,
    summary: row.summary,
    result: {
      testsStatus: row.tests_status,
      lintStatus: row.lint_status,
      buildStatus: row.build_status,
      severity: row.severity,
      logsTests: includeLogs ? row.logs_tests : undefined,
      logsLint: includeLogs ? row.logs_lint : undefined,
      logsBuild: includeLogs ? row.logs_build : undefined,
      summary: row.summary,
      branch: row.branch,
    } as HealthCheckRunResult,
  };
  if (includeLogs) {
    return {
      ...base,
      logs: {
        tests: row.logs_tests,
        lint: row.logs_lint,
        build: row.logs_build,
      },
    };
  }
  return base;
}

async function fetchHealthCheckById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('repo_health_checks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logger.error({ error }, '[repoAgent][fetchHealthCheckById] query failed');
    return null;
  }
  if (!data) return null;
  return mapHealthCheck(data, true);
}

function mapRepoError(row: any) {
  return {
    id: row.id,
    createdAt: row.created_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    errorSignature: row.error_signature,
    errorMessage: row.error_message,
    occurrences: row.occurrences,
    status: row.status,
    lastContextRoute: row.last_context_route,
    stackTrace: row.stack_trace,
    contextJson: row.context_json,
    lastHealthCheckId: row.last_health_check_id,
    lastExplanation: row.last_explanation,
  };
}

function mapScenarioRun(row: any) {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    status: row.status,
    failingStep: row.failing_step,
    logs: row.logs,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function mapSweepRun(row: any) {
  return {
    id: row.id,
    sweepId: row.sweep_id,
    status: row.status,
    violationSummary: row.violation_summary,
    violationCount: row.violation_count,
    rawReport: row.raw_report,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

async function fetchScenario(id: string) {
  const { data, error } = await supabaseAdmin
    .from('repo_scenarios')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchScenarioRun(runId: string) {
  const { data, error } = await supabaseAdmin
    .from('repo_scenario_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchSweep(id: string) {
  const { data, error } = await supabaseAdmin
    .from('repo_integrity_sweeps')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchSweepRun(runId: string) {
  const { data, error } = await supabaseAdmin
    .from('repo_integrity_sweep_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertSyntheticError({
  signature,
  message,
  context,
}: {
  signature: string;
  message: string;
  context?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from('repo_errors')
    .select('*')
    .eq('error_signature', signature)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('repo_errors')
      .update({
        error_message: message,
        last_seen_at: now,
        occurrences: (existing.occurrences || 0) + 1,
        context_json: context ?? existing.context_json,
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await supabaseAdmin
    .from('repo_errors')
    .insert([
      {
        error_signature: signature,
        error_message: message,
        first_seen_at: now,
        last_seen_at: now,
        occurrences: 1,
        status: 'open',
        context_json: context ?? null,
      },
    ])
    .select('id')
    .single();
  if (error) throw error;
  return data?.id;
}

function shouldAlertOnHealthCheck(result: HealthCheckRunResult) {
  return (
    result.severity === 'medium' ||
    result.severity === 'high' ||
    result.testsStatus !== 'pass' ||
    result.lintStatus !== 'pass' ||
    result.buildStatus !== 'pass'
  );
}

function notifyAll(promises: Promise<unknown>[]) {
  Promise.allSettled(promises).catch((error) =>
    logger.warn({ error }, '[repoAgent][notifyAll] notifier error')
  );
}

async function loadConversation(id: string): Promise<RepoAgentConversation | null> {
  const { data: convo, error } = await supabaseAdmin
    .from('repo_agent_conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!convo) return null;
  const { data: messages, error: msgError } = await supabaseAdmin
    .from('repo_agent_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });
  if (msgError) throw msgError;
  return mapConversation(convo, messages || []);
}

function mapConversation(row: any, messages: any[]): RepoAgentConversation {
  const mappedMessages: RepoAgentMessage[] = (messages || []).map((msg) => ({
    id: msg.id,
    conversationId: msg.conversation_id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.created_at,
  }));

  return {
    id: row.id,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    relatedErrorId: row.related_error_id,
    relatedHealthCheckId: row.related_health_check_id,
    relatedScenarioRunId: row.related_scenario_run_id,
    relatedSweepRunId: row.related_sweep_run_id,
    messages: mappedMessages,
  };
}

function handleRouteError(res: Response, error: any, context: string) {
  logger.error({ error, context }, '[repoAgent][router] request failed');
  res.status(500).json({
    error: 'server_error',
    message: error?.message || 'Unexpected server error',
  });
}

