import sgMail from '@sendgrid/mail';
import { logger } from '../lib/logger';
import {
  ErrorAlertPayload,
  HealthCheckNotificationPayload,
  ScenarioAlertPayload,
  SweepAlertPayload,
  FullCheckSummaryPayload,
} from './types';
import { getRepoAgentSettings } from './settingsService';

const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.REPO_AGENT_EMAIL_FROM || process.env.FROM_EMAIL || 'no-reply@thehirepilot.com';

if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
} else {
  logger.warn('[repoAgent][emailNotifier] SENDGRID_API_KEY not configured; emails disabled');
}

async function sendEmail(subject: string, body: string) {
  if (!SENDGRID_KEY) return;
  const settings = await getRepoAgentSettings();
  if (!settings.emailEnabled || !settings.emailRecipients.length) {
    return;
  }

  await sgMail.send({
    from: FROM_EMAIL,
    to: settings.emailRecipients,
    subject,
    html: `<pre style="white-space:pre-wrap;font-family:Inter,system-ui,sans-serif;background-color:#0f172a;color:#e2e8f0;padding:16px;border-radius:8px;">${body}</pre>`,
  });
}

export async function sendHealthCheckSummaryEmail(payload: HealthCheckNotificationPayload) {
  const subject = `Repo Guardian Health Check (${payload.branch}) - ${payload.severity.toUpperCase()}`;
  const body = [
    `Health Check ID: ${payload.healthCheckId}`,
    `Severity: ${payload.severity}`,
    `Triggered By: ${payload.triggeredBy}`,
    '',
    payload.summary,
  ].join('\n');
  await sendEmail(subject, body);
}

export async function sendErrorAlertEmail(payload: ErrorAlertPayload) {
  const subject = `Repo Guardian Error: ${payload.signature}`;
  const body = [
    `Error ID: ${payload.errorId}`,
    `Signature: ${payload.signature}`,
    `Message: ${payload.message}`,
    `Occurrences: ${payload.occurrences}`,
    `Status: ${payload.status}`,
  ].join('\n');
  await sendEmail(subject, body);
}

export async function sendScenarioFailureEmail(payload: ScenarioAlertPayload) {
  const subject = `Scenario Failure: ${payload.scenarioName}`;
  const body = [
    `Scenario Run ID: ${payload.scenarioRunId}`,
    `Failing Step: ${payload.failingStep || 'n/a'}`,
    `Logs: ${payload.logs || 'n/a'}`,
  ].join('\n');
  await sendEmail(subject, body);
}

export async function sendSweepViolationsEmail(payload: SweepAlertPayload) {
  const subject = `Sweep Violations: ${payload.sweepName}`;
  const body = [
    `Sweep Run ID: ${payload.sweepRunId}`,
    `Violations: ${payload.violationCount ?? 'n/a'}`,
    `Summary: ${payload.violationSummary || 'n/a'}`,
  ].join('\n');
  await sendEmail(subject, body);
}

export async function sendFullCheckSummaryEmail(payload: FullCheckSummaryPayload) {
  const subject = `Repo Guardian Full Check – ${
    payload.failingScenarios.length || payload.violatingSweeps.length
      ? 'ATTENTION REQUIRED'
      : 'Healthy'
  }`;
  const bodyLines = [
    `Mode: ${payload.mode}`,
    `Triggered By: ${payload.triggeredBy}`,
    `Health Check ID: ${payload.healthStatus.healthCheckId || 'n/a'}`,
    `Severity: ${payload.healthStatus.severity || 'n/a'}`,
    `Tests/Lint/Build: ${payload.healthStatus.testsStatus || '-'} / ${
      payload.healthStatus.lintStatus || '-'
    } / ${payload.healthStatus.buildStatus || '-'}`,
    `Summary: ${payload.healthStatus.summary || 'n/a'}`,
    '',
    `Failing Scenarios (${payload.failingScenarios.length}):`,
    payload.failingScenarios.length
      ? payload.failingScenarios
          .map(
            (s) =>
              `• ${s.name}${s.failingStep ? ` – ${s.failingStep}` : ''}${
                s.logs ? `\n    Logs: ${s.logs}` : ''
              }`
          )
          .join('\n')
      : '• None',
    '',
    `Sweep Violations (${payload.violatingSweeps.length}):`,
    payload.violatingSweeps.length
      ? payload.violatingSweeps
          .map(
            (s) =>
              `• ${s.name} – ${s.violationSummary || 'See Repo Guardian'} (${
                s.violationCount ?? 'n/a'
              } issues)`
          )
          .join('\n')
      : '• None',
  ];
  await sendEmail(subject, bodyLines.join('\n'));
}

