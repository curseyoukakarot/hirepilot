import { Worker } from 'bullmq';
import axios from 'axios';
import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

import { connection } from '../queues/redis';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { renderHpTemplate } from '../lib/templates/hpTemplate';
import {
  SLACK_ACTION_NEEDED_TEMPLATE,
  SLACK_LOW_RESULTS_TEMPLATE,
  SLACK_SUCCESS_TEMPLATE,
} from '../services/schedulerRunNotifications/slackCopy';

type JobData = { run_log_id: string };

function pctLabel(pct: number): string {
  if (pct >= 70) return '(strong)';
  if (pct >= 40) return '(moderate)';
  return '(low)';
}

function failureModeLabel(mode: string | null | undefined): string {
  switch (mode) {
    case 'too_narrow': return 'Search too narrow';
    case 'geo_mismatch': return 'Location mismatch';
    case 'title_drift': return 'Title drift';
    case 'deliverability_low': return 'Low deliverability';
    case 'duplicates_high': return 'Too many duplicates';
    case 'irrelevant_industries': return 'Industry mismatch';
    default: return 'Needs review';
  }
}

function outreachModeLabel(sendDelayMinutes: number): { label: string; delay_hours?: number } {
  if (!sendDelayMinutes) return { label: 'Send immediately when lead is created' };
  const hours = Math.max(1, Math.round(sendDelayMinutes / 60));
  return { label: 'Send after delay', delay_hours: hours };
}

function humanTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function getSecrets(): { actionSecret?: string } {
  const secret =
    process.env.SCHEDULER_ACTION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    undefined;
  return { actionSecret: secret };
}

function getBases(): { appBase: string; apiBase: string; logoUrl: string } {
  const appBase =
    (process.env.APP_WEB_URL || process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com')
      .replace(/\/$/, '');
  const apiBase =
    (process.env.BACKEND_BASE_URL || process.env.API_BASE_URL || process.env.BACKEND_INTERNAL || 'https://api.thehirepilot.com')
      .replace(/\/$/, '');
  const logoUrl =
    (process.env.HIREPILOT_LOGO_URL || `${appBase}/logo-light.png`);
  return { appBase, apiBase, logoUrl };
}

async function loadEmailTemplate(): Promise<string> {
  const tplPath = path.resolve(__dirname, '../../emails/schedulerRunResult.html');
  try {
    return fs.readFileSync(tplPath, 'utf-8');
  } catch {
    return '';
  }
}

async function sendSlackWebhook(webhook: string, text: string, actions: Array<{ text: string; url: string }>) {
  const blocks: any[] = [
    { type: 'section', text: { type: 'mrkdwn', text } },
  ];
  if (actions.length) {
    blocks.push({
      type: 'actions',
      elements: actions.slice(0, 5).map((a) => ({
        type: 'button',
        text: { type: 'plain_text', text: a.text },
        url: a.url,
      })),
    });
  }
  await axios.post(webhook, { text, blocks });
}

const worker = new Worker('scheduler:notify', async (job) => {
  const { run_log_id } = job.data as JobData;
  if (!run_log_id) return { ok: false, error: 'missing_run_log_id' };

  const { data: logRow, error: logErr } = await supabaseAdmin
    .from('schedule_run_logs')
    .select('*')
    .eq('id', run_log_id)
    .single();
  if (logErr || !logRow) throw new Error('schedule_run_log_not_found');

  const scheduleId = (logRow as any).schedule_id as string;
  const userId = (logRow as any).user_id as string;
  const personaId = (logRow as any).persona_id as string | null;
  const campaignId = (logRow as any).campaign_id as string | null;

  const [{ data: sched }, { data: persona }, { data: campaign }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('schedules').select('id,name,send_delay_minutes,daily_send_cap,agentic_prefs').eq('id', scheduleId).maybeSingle(),
    personaId ? supabaseAdmin.from('personas').select('id,name').eq('id', personaId).maybeSingle() : Promise.resolve({ data: null } as any),
    campaignId ? supabaseAdmin.from('sourcing_campaigns').select('id,title').eq('id', campaignId).maybeSingle() : Promise.resolve({ data: null } as any),
    supabaseAdmin.from('user_settings').select('email,slack_webhook_url,scheduler_email_results,scheduler_slack_results').eq('user_id', userId).maybeSingle(),
  ]);

  const scheduleName = (sched as any)?.name || 'Scheduler';
  const personaName = (persona as any)?.name || 'Persona';
  const campaignTitle = (campaign as any)?.title || 'Campaign';

  const foundCount = Number((logRow as any)?.leads_found_count || 0);
  const insertedCount = Number((logRow as any)?.leads_inserted_count || 0);
  const dedupedCount = Number((logRow as any)?.leads_deduped_count || 0);
  const attemptsUsed = Array.isArray((logRow as any)?.attempts) ? (logRow as any).attempts.length : Number((logRow as any)?.metrics?.attempts_used || 1);
  const qualityScore = Number((logRow as any)?.quality_score ?? (logRow as any)?.metrics?.quality_score ?? 0);
  const confidence = Number((logRow as any)?.confidence ?? (logRow as any)?.metrics?.confidence ?? 0);

  const metrics = ((logRow as any)?.metrics || {}) as any;
  const emailCoveragePct = Number(metrics?.email_coverage_pct || 0);
  const geoMatchPct = Number(metrics?.geo_match_pct || 0);
  const titleMatchPct = Number(metrics?.title_match_pct || 0);

  const decision = String((logRow as any)?.decision || '');
  const failureMode = String((logRow as any)?.failure_mode || '');
  const failureReasonShort = String((metrics?.failure_reason_short || metrics?.judge_reasons_bad?.[0] || '')).slice(0, 220);
  const recommendedFixSummary = String((metrics?.recommended_fix_summary || metrics?.judge_recommended_adjustment_notes || '')).trim();
  const suggestedExpansionPreview = String((metrics?.suggested_expansion_preview || recommendedFixSummary || 'broaden location or paginate')).slice(0, 120);

  const outreachEnabled = Boolean((logRow as any)?.outreach_enabled);
  const outreachQueuedCount = Number((logRow as any)?.outreach_queued_count || 0);
  const sendDelayMinutes = Number((sched as any)?.send_delay_minutes || 0);
  const dailySendCap = (sched as any)?.daily_send_cap;

  const { appBase, apiBase, logoUrl } = getBases();
  const { actionSecret } = getSecrets();

  const agentModeUrl = campaignId ? `${appBase}/agent/campaign/${encodeURIComponent(campaignId)}` : `${appBase}/agent/advanced/schedules`;
  const campaignUrl = campaignId ? `${appBase}/agent/campaign/${encodeURIComponent(campaignId)}` : `${appBase}/agent/advanced/schedules`;
  const leadsUrl = `${appBase}/leads?run_id=${encodeURIComponent(run_log_id)}`;
  const scheduleSettingsUrl = `${appBase}/agent/advanced/schedules`;

  const tokenPayloadBase = { user_id: userId, schedule_id: scheduleId, run_log_id };
  const approveToken = actionSecret
    ? jwt.sign({ ...tokenPayloadBase, action: 'approve_expansion' }, actionSecret, { expiresIn: '7d' })
    : '';
  const keepToken = actionSecret
    ? jwt.sign({ ...tokenPayloadBase, action: 'keep_criteria' }, actionSecret, { expiresIn: '7d' })
    : '';
  const approveExpansionUrl = approveToken ? `${apiBase}/api/schedules/${encodeURIComponent(scheduleId)}/approve-expansion?t=${encodeURIComponent(approveToken)}` : scheduleSettingsUrl;
  const keepCriteriaUrl = keepToken ? `${apiBase}/api/schedules/${encodeURIComponent(scheduleId)}/keep-criteria?t=${encodeURIComponent(keepToken)}` : scheduleSettingsUrl;

  const { label: outreachMode, delay_hours } = outreachModeLabel(sendDelayMinutes);
  const dailySendCapLabel = typeof dailySendCap === 'number' && dailySendCap > 0 ? `${dailySendCap} sends/day` : 'Use campaign default limits';

  const actionNeeded = decision === 'NOTIFY_USER' || (decision === 'FALLBACK' && attemptsUsed >= 4) || insertedCount === 0;
  const lowResults = !actionNeeded && insertedCount > 0 && insertedCount < 10;

  const vars = {
    // Core
    schedule_name: scheduleName,
    persona_name: personaName,
    attempts_used: attemptsUsed,
    quality_score: qualityScore,
    confidence: confidence.toFixed(2),

    // Results
    found_count: foundCount,
    inserted_count: insertedCount,
    deduped_count: dedupedCount,
    email_coverage_pct: Math.round(emailCoveragePct),
    email_coverage_label: pctLabel(Math.round(emailCoveragePct)),
    geo_match_pct: Math.round(geoMatchPct),
    title_match_pct: Math.round(titleMatchPct),

    // Outreach
    outreach_enabled: outreachEnabled,
    outreach_queued_count: outreachQueuedCount,
    outreach_mode_label: outreachMode,
    delay_hours: delay_hours,
    daily_send_cap_label: dailySendCapLabel,

    // Timing + links
    run_at_human: humanTime((logRow as any)?.ran_at),
    next_run_at_human: humanTime((logRow as any)?.next_run_at),
    agent_mode_url: agentModeUrl,
    campaign_url: campaignUrl,
    leads_url: leadsUrl,
    schedule_settings_url: scheduleSettingsUrl,

    // Action-needed extras
    action_needed: actionNeeded,
    failure_mode_label: failureModeLabel(failureMode),
    failure_reason_short: failureReasonShort || 'No matches after 4 attempts.',
    recommended_fix_summary: recommendedFixSummary || suggestedExpansionPreview,
    suggested_expansion_preview: suggestedExpansionPreview,
    approve_expansion_url: approveExpansionUrl,
    keep_criteria_url: keepCriteriaUrl,

    // Email template extras
    preheader_text: actionNeeded
      ? 'Results are in — open Agent Mode to review or approve an expansion.'
      : 'View sourced leads, outreach status, and what’s scheduled next.',
    hirepilot_logo_url: logoUrl,
    notification_settings_url: `${appBase}/settings/notifications`,
    unsubscribe_url: `${appBase}/settings/notifications`,
    year: String(new Date().getFullYear()),

    campaign_name: campaignTitle,
  };

  // ---- Slack ----
  const slackEnabled = Boolean((settings as any)?.scheduler_slack_results);
  const slackWebhook = (settings as any)?.slack_webhook_url || process.env.SLACK_WEBHOOK_URL || '';
  if (slackEnabled && slackWebhook) {
    const template = actionNeeded
      ? SLACK_ACTION_NEEDED_TEMPLATE
      : lowResults
        ? SLACK_LOW_RESULTS_TEMPLATE
        : SLACK_SUCCESS_TEMPLATE;

    const slackText = renderHpTemplate(template, vars);
    const actions = actionNeeded
      ? [
        { text: 'Approve Suggested Expansion', url: approveExpansionUrl },
        { text: 'Keep Criteria (try again next run)', url: keepCriteriaUrl },
        { text: 'View Schedule', url: scheduleSettingsUrl },
      ]
      : lowResults
        ? [
          { text: 'View Leads', url: leadsUrl },
          { text: 'View Campaign', url: campaignUrl },
          { text: 'Adjust Schedule', url: scheduleSettingsUrl },
        ]
        : [
          { text: 'View in Agent Mode', url: agentModeUrl },
          { text: 'View Campaign', url: campaignUrl },
          { text: 'View Leads', url: leadsUrl },
        ];

    try {
      await sendSlackWebhook(slackWebhook, slackText, actions);
    } catch (e: any) {
      console.warn('[scheduler:notify] slack failed', { userId, error: e?.message || String(e) });
    }
  }

  // ---- Email ----
  const emailEnabled = Boolean((settings as any)?.scheduler_email_results);
  const toEmail = (settings as any)?.email as string | undefined;
  if (emailEnabled && toEmail && process.env.SENDGRID_API_KEY) {
    if (!sgMail) {
      // no-op
    }
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const htmlTpl = await loadEmailTemplate();
      const html = renderHpTemplate(htmlTpl, vars);
      const subjectTpl = 'Scheduler results: {{inserted_count}} leads added ({{schedule_name}})';
      const subject = renderHpTemplate(subjectTpl, vars);
      await sgMail.send({
        to: toEmail,
        from: process.env.SENDGRID_FROM || process.env.FROM_EMAIL || 'noreply@hirepilot.ai',
        subject,
        html,
      });
    } catch (e: any) {
      console.warn('[scheduler:notify] email failed', { userId, error: e?.message || String(e) });
    }
  }

  return { ok: true, user_id: userId, schedule_id: scheduleId, run_log_id };
}, { connection });

worker.on('completed', (job) => {
  console.log(`✅ scheduler:notify job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`💥 scheduler:notify job ${job?.id} failed:`, err);
});

console.log('🚀 Scheduler notifications worker started');

export default worker;

