import sgMail from '@sendgrid/mail';
import { logger } from '../lib/logger';
import {
  ErrorAlertPayload,
  HealthCheckNotificationPayload,
  ScenarioAlertPayload,
  SweepAlertPayload,
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

