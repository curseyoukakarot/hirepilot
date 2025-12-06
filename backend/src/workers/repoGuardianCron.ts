import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { getRepoAgentSettings } from '../repoAgent/settingsService';
import { runHealthCheck } from '../repoAgent/healthCheckRunner';
import { runScenarioById } from '../repoAgent/scenarioRunner';
import { runSweepById } from '../repoAgent/sweepRunner';
import {
  sendFullCheckSummary,
  sendHealthCheckSummary,
} from '../repoAgent/slackNotifier';
import {
  sendFullCheckSummaryEmail,
  sendHealthCheckSummaryEmail,
} from '../repoAgent/emailNotifier';
import {
  FullCheckSummaryPayload,
  HealthCheckRunResult,
  SeverityLevel,
} from '../repoAgent/types';

type TriggerSource = 'system' | 'user';

interface RunOptions {
  force?: boolean;
  triggeredBy?: TriggerSource;
  userId?: string;
}

interface ScenarioRunSnapshot {
  scenarioId: string;
  name: string;
  label?: string;
  run?: any;
}

interface SweepRunSnapshot {
  sweepId: string;
  name: string;
  label?: string;
  run?: any;
}

export async function runScheduledRepoGuardianCheck(
  options: RunOptions = {}
) {
  const triggeredBy: TriggerSource = options.triggeredBy || 'system';
  const triggeredByUserId =
    triggeredBy === 'user' ? options.userId : undefined;

  const settings = await getRepoAgentSettings();
  if (triggeredBy === 'system' && !options.force && !settings.nightlyCheckEnabled) {
    logger.info('[repoGuardianCron] Nightly check disabled via settings; skipping run');
    return { skipped: true };
  }

  const summaryPayload: FullCheckSummaryPayload = {
    mode: triggeredBy === 'user' ? 'manual' : 'scheduled',
    triggeredBy,
    triggeredByUserId,
    healthStatus: {},
    failingScenarios: [],
    violatingSweeps: [],
  };

  const healthInfo = await runAndFetchHealthCheck(triggeredBy, triggeredByUserId);
  if (healthInfo?.detail) {
    summaryPayload.healthStatus = {
      healthCheckId: healthInfo.detail.id,
      severity: healthInfo.detail.result.severity,
      testsStatus: healthInfo.detail.result.testsStatus,
      lintStatus: healthInfo.detail.result.lintStatus,
      buildStatus: healthInfo.detail.result.buildStatus,
      summary: healthInfo.detail.result.summary,
    };
    if (healthInfo.shouldAlert) {
      const payload = {
        healthCheckId: healthInfo.detail.id,
        summary: healthInfo.detail.result.summary,
        severity: healthInfo.detail.result.severity as SeverityLevel,
        branch: healthInfo.detail.branch,
        triggeredBy,
      };
      notifyAll([
        sendHealthCheckSummary(payload),
        sendHealthCheckSummaryEmail(payload),
      ]);
    }
  }

  const scenarioRuns = await runActiveScenarios();
  summaryPayload.failingScenarios = scenarioRuns
    .filter((run) => ['fail', 'running'].includes(String(run.run?.status).toLowerCase()))
    .map((run) => ({
      scenarioId: run.scenarioId,
      name: run.label || run.name,
      failingStep: run.run?.failing_step || undefined,
      logs: run.run?.logs || undefined,
    }));

  const sweepRuns = await runActiveSweeps();
  summaryPayload.violatingSweeps = sweepRuns
    .filter((run) => String(run.run?.status).toLowerCase() === 'violations')
    .map((run) => ({
      sweepId: run.sweepId,
      name: run.label || run.name,
      violationSummary: run.run?.violation_summary || undefined,
      violationCount: run.run?.violation_count ?? null,
    }));

  notifyAll([
    sendFullCheckSummary(summaryPayload),
    sendFullCheckSummaryEmail(summaryPayload),
  ]);

  return {
    summary: summaryPayload,
    healthCheck: healthInfo?.detail,
    scenarioRuns,
    sweepRuns,
  };
}

async function runAndFetchHealthCheck(
  triggeredBy: TriggerSource,
  triggeredByUserId?: string
) {
  try {
    const { id } = await runHealthCheck(triggeredBy, triggeredByUserId);
    const detail = await fetchHealthCheck(id);
    return {
      detail,
      shouldAlert: detail ? shouldAlertOnHealthCheck(detail.result) : false,
    };
  } catch (error) {
    logger.error({ error }, '[repoGuardianCron] Health check failed');
    return null;
  }
}

async function fetchHealthCheck(id: string) {
  const { data, error } = await supabaseAdmin
    .from('repo_health_checks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logger.error({ error }, '[repoGuardianCron] Failed to fetch health check detail');
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    branch: data.branch,
    result: {
      testsStatus: data.tests_status,
      lintStatus: data.lint_status,
      buildStatus: data.build_status,
      severity: data.severity,
      logsTests: data.logs_tests,
      logsLint: data.logs_lint,
      logsBuild: data.logs_build,
      summary: data.summary,
      branch: data.branch,
    } as HealthCheckRunResult,
  };
}

async function runActiveScenarios(): Promise<ScenarioRunSnapshot[]> {
  const snapshots: ScenarioRunSnapshot[] = [];
  const { data: scenarios, error } = await supabaseAdmin
    .from('repo_scenarios')
    .select('*')
    .eq('active', true);
  if (error) {
    logger.error({ error }, '[repoGuardianCron] Failed to load active scenarios');
    return snapshots;
  }
  for (const scenario of scenarios || []) {
    try {
      const { runId } = await runScenarioById(scenario.id);
      const run = await fetchScenarioRun(runId);
      snapshots.push({
        scenarioId: scenario.id,
        name: scenario.name,
        label: scenario.label,
        run,
      });
    } catch (err) {
      logger.error(
        { error: err, scenarioId: scenario.id },
        '[repoGuardianCron] Scenario run failed'
      );
      snapshots.push({
        scenarioId: scenario.id,
        name: scenario.name,
        label: scenario.label,
        run: {
          status: 'fail',
          logs: `Scenario runner threw: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  }
  return snapshots;
}

async function runActiveSweeps(): Promise<SweepRunSnapshot[]> {
  const snapshots: SweepRunSnapshot[] = [];
  const { data: sweeps, error } = await supabaseAdmin
    .from('repo_integrity_sweeps')
    .select('*')
    .eq('active', true);
  if (error) {
    logger.error({ error }, '[repoGuardianCron] Failed to load sweeps');
    return snapshots;
  }
  for (const sweep of sweeps || []) {
    try {
      const { runId } = await runSweepById(sweep.id);
      const run = await fetchSweepRun(runId);
      snapshots.push({
        sweepId: sweep.id,
        name: sweep.name,
        label: sweep.label,
        run,
      });
    } catch (err) {
      logger.error(
        { error: err, sweepId: sweep.id },
        '[repoGuardianCron] Sweep run failed'
      );
      snapshots.push({
        sweepId: sweep.id,
        name: sweep.name,
        label: sweep.label,
        run: {
          status: 'violations',
          violation_summary: `Sweep runner threw: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      });
    }
  }
  return snapshots;
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

async function fetchSweepRun(runId: string) {
  const { data, error } = await supabaseAdmin
    .from('repo_integrity_sweep_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
    logger.warn({ error }, '[repoGuardianCron] notifier error')
  );
}

if (require.main === module) {
  runScheduledRepoGuardianCheck()
    .then((result) => {
      logger.info({ result }, '[repoGuardianCron] completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, '[repoGuardianCron] failed');
      process.exit(1);
    });
}

/**
 * Schedule: run once nightly shortly after repo_agent_settings.nightly_check_time_utc
 * (e.g., via Railway cron). This script expects to be invoked around the desired
 * time; future iterations can add stricter time-window enforcement.
 */

