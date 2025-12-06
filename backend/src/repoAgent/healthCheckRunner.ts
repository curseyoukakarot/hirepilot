import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { runCommand } from './commandRunner';
import { cloneOrUpdateRepo, getCurrentBranch } from './gitClient';
import { summarizeHealthCheck } from './llmClient';
import { HealthCheckRunResult, HealthStatus, SeverityLevel } from './types';

const MAX_LOG_LENGTH = 20000;
const DEFAULT_BRANCH = process.env.REPO_AGENT_DEFAULT_BRANCH || 'main';

const TEST_COMMAND = process.env.REPO_AGENT_TEST_CMD?.split(' ') || ['pnpm', 'test'];
const LINT_COMMAND = process.env.REPO_AGENT_LINT_CMD?.split(' ') || ['pnpm', 'lint'];
const BUILD_COMMAND = process.env.REPO_AGENT_BUILD_CMD?.split(' ') || ['pnpm', 'build'];

function determineStatus(result: { exitCode: number; stderr: string }): HealthStatus {
  if (result.exitCode === 0) {
    return /warn(ing)?/i.test(result.stderr) ? 'warn' : 'pass';
  }
  return 'fail';
}

function toLog(stdout: string, stderr: string) {
  const combined = [stdout, stderr].filter(Boolean).join('\n');
  return combined.slice(-MAX_LOG_LENGTH);
}

async function executeCommand(cmdParts: string[], cwd: string) {
  const [cmd, ...args] = cmdParts;
  return runCommand(cmd, args, cwd);
}

export async function runHealthCheck(
  triggeredBy: 'system' | 'user',
  triggeredByUserId?: string
): Promise<{ id: string; result: HealthCheckRunResult }> {
  const localPath = await cloneOrUpdateRepo();
  const branch = await getCurrentBranch(localPath).catch(() => DEFAULT_BRANCH);

  const testsResult = await executeCommand(TEST_COMMAND, localPath);
  const lintResult = await executeCommand(LINT_COMMAND, localPath);
  const buildResult = await executeCommand(BUILD_COMMAND, localPath);

  const logsTests = toLog(testsResult.stdout, testsResult.stderr);
  const logsLint = toLog(lintResult.stdout, lintResult.stderr);
  const logsBuild = toLog(buildResult.stdout, buildResult.stderr);

  const testsStatus = determineStatus(testsResult);
  const lintStatus = determineStatus(lintResult);
  const buildStatus = determineStatus(buildResult);

  let summary = 'Health check executed.';
  let severity: SeverityLevel = 'low';

  try {
    const llm = await summarizeHealthCheck({
      tests: logsTests,
      lint: logsLint,
      build: logsBuild,
    });
    summary = llm.summary;
    severity = llm.severity;
  } catch (error) {
    logger.warn({ error }, '[repoAgent][healthCheckRunner] summarizeHealthCheck failed');
  }

  const payload = {
    triggered_by: triggeredBy,
    triggered_by_user_id: triggeredByUserId ?? null,
    branch,
    tests_status: testsStatus,
    lint_status: lintStatus,
    build_status: buildStatus,
    severity,
    summary,
    logs_tests: logsTests,
    logs_lint: logsLint,
    logs_build: logsBuild,
  };

  const { data, error } = await supabaseAdmin
    .from('repo_health_checks')
    .insert([payload])
    .select('*')
    .single();

  if (error || !data) {
    logger.error({ error }, '[repoAgent][healthCheckRunner] Failed to persist health check');
    throw error || new Error('Failed to persist health check');
  }

  const result: HealthCheckRunResult = {
    testsStatus,
    lintStatus,
    buildStatus,
    severity,
    logsTests,
    logsLint,
    logsBuild,
    summary,
    branch,
  };

  return { id: data.id, result };
}

