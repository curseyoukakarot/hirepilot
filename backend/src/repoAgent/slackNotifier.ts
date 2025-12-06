import fetch from 'node-fetch';
import { logger } from '../lib/logger';
import {
  ErrorAlertPayload,
  HealthCheckNotificationPayload,
  ScenarioAlertPayload,
  SweepAlertPayload,
} from './types';
import { getRepoAgentSettings } from './settingsService';

async function postMessage(text: string) {
  const settings = await getRepoAgentSettings();
  if (!settings.slackEnabled) {
    return;
  }

  if (!settings.slackWebhookUrl) {
    logger.warn(
      '[repoAgent][slackNotifier] Slack enabled but webhook URL missing. Configure repo_agent_settings.'
    );
    return;
  }

  await fetch(settings.slackWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      channel: settings.slackChannel || undefined,
    }),
  });
}

export async function sendHealthCheckSummary(payload: HealthCheckNotificationPayload) {
  const text = [
    `🛡️ Repo Guardian Health Check (${payload.branch})`,
    `Summary: ${payload.summary}`,
    `Severity: *${payload.severity.toUpperCase()}*`,
    `Triggered by: ${payload.triggeredBy}`,
    `Check ID: ${payload.healthCheckId}`,
  ].join('\n');
  await postMessage(text);
}

export async function sendErrorAlert(payload: ErrorAlertPayload) {
  const text = [
    `❗ Repo Guardian Error Alert`,
    `Signature: ${payload.signature}`,
    `Message: ${payload.message}`,
    `Occurrences: ${payload.occurrences}`,
    `Status: ${payload.status}`,
    `Error ID: ${payload.errorId}`,
  ].join('\n');
  await postMessage(text);
}

export async function sendScenarioFailureAlert(payload: ScenarioAlertPayload) {
  const text = [
    `🧪 Scenario Failure Alert`,
    `Scenario: ${payload.scenarioName}`,
    `Failing Step: ${payload.failingStep || 'n/a'}`,
    `Logs: ${payload.logs || 'n/a'}`,
    `Run ID: ${payload.scenarioRunId}`,
  ].join('\n');
  await postMessage(text);
}

export async function sendSweepViolationsAlert(payload: SweepAlertPayload) {
  const text = [
    `🧹 Integrity Sweep Violations`,
    `Sweep: ${payload.sweepName}`,
    `Violations: ${payload.violationCount ?? 'n/a'}`,
    `Summary: ${payload.violationSummary || 'n/a'}`,
    `Run ID: ${payload.sweepRunId}`,
  ].join('\n');
  await postMessage(text);
}

