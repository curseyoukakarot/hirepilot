import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { sniperSupabaseDb } from './supabase';
import { sendEmail as sendgridSend } from '../../integrations/sendgrid';

type SniperNotifyVars = {
  profiles_found: string;
  workspace_name: string;
  post_url: string;
  results_url: string;
  import_url: string;
  settings_url: string;
  run_id: string;
  error_message?: string;
};

function renderTemplate(html: string, vars: Record<string, string | null | undefined>) {
  return html.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

function findTemplatePath(template: string) {
  const candidates = [
    path.resolve(process.cwd(), 'frontend', 'src', 'templates', 'emails', template),
    path.resolve(process.cwd(), '..', 'frontend', 'src', 'templates', 'emails', template),
    path.resolve(__dirname, '../../../frontend/src/templates/emails', template),
    path.resolve(__dirname, `../../frontend/src/templates/emails/${template}`)
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function getFrontendBase(): string {
  const raw =
    (process.env.FRONTEND_BASE_URL || '').trim() ||
    (process.env.FRONTEND_URL || '').trim() ||
    (process.env.NEXT_PUBLIC_APP_URL || '').trim() ||
    'https://app.thehirepilot.com';
  return raw.replace(/\/$/, '');
}

async function fetchWorkspaceName(workspaceId: string): Promise<string> {
  try {
    const { data } = await sniperSupabaseDb.from('teams').select('name').eq('id', workspaceId).maybeSingle();
    return (data as any)?.name || 'Workspace';
  } catch {
    return 'Workspace';
  }
}

async function countExtractedProfiles(jobId: string): Promise<number> {
  const { count } = await sniperSupabaseDb
    .from('sniper_job_items')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('action_type', 'extract');
  return Number(count || 0);
}

function slackBlockKit(vars: SniperNotifyVars) {
  return {
    text: '✅ Sniper run complete — prospects ready',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '✅ Sniper run complete', emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Profiles Found*\n${vars.profiles_found}` },
          { type: 'mrkdwn', text: `*Workspace*\n${vars.workspace_name}` },
          { type: 'mrkdwn', text: '*Target*\nLinkedIn Post Engagement' },
          { type: 'mrkdwn', text: `*Run ID*\n\`${vars.run_id}\`` }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Post:* <${vars.post_url}|Open target post>` }
      },
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'View Results', emoji: true }, style: 'primary', url: vars.results_url },
          { type: 'button', text: { type: 'plain_text', text: 'Import to Leads', emoji: true }, url: vars.import_url }
        ]
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Sniper obeys your throttle settings (max/day, delays, active hours).' }]
      }
    ]
  };
}

function slackBlockKitFailed(vars: SniperNotifyVars) {
  return {
    text: '❌ Sniper run failed — action required',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '❌ Sniper run failed', emoji: true } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Workspace*\n${vars.workspace_name}` },
          { type: 'mrkdwn', text: `*Run ID*\n\`${vars.run_id}\`` }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Reason:*\n${(vars.error_message || 'Unknown error').slice(0, 500)}` }
      },
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'View Run Details', emoji: true }, style: 'primary', url: vars.results_url },
          { type: 'button', text: { type: 'plain_text', text: 'Open Settings', emoji: true }, url: vars.settings_url }
        ]
      }
    ]
  };
}

/**
 * Best-effort notifications (email + slack) for completed/failed Sniper jobs.
 * Idempotent via sniper_jobs.notified_at.
 */
export async function notifySniperJobFinished(jobId: string): Promise<{ ok: boolean; skipped?: boolean }> {
  const nowIso = new Date().toISOString();

  // Claim notification (idempotent): only one worker should send.
  const { data: claimed, error: claimErr } = await sniperSupabaseDb
    .from('sniper_jobs')
    .update({ notified_at: nowIso })
    .eq('id', jobId)
    .is('notified_at', null)
    .select('id, workspace_id, created_by, status, job_type, target_id, input_json, error_message')
    .maybeSingle();

  if (claimErr) throw claimErr;
  if (!claimed) return { ok: true, skipped: true };

  const job: any = claimed;
  const frontendBase = getFrontendBase();

  const [workspaceName, extractedCount] = await Promise.all([
    fetchWorkspaceName(String(job.workspace_id)),
    job.job_type === 'prospect_post_engagers' ? countExtractedProfiles(jobId) : Promise.resolve(0)
  ]);

  const targetId = job.target_id ? String(job.target_id) : null;
  let postUrl = String(job.input_json?.post_url || '');
  if (!postUrl && targetId) {
    const { data: target } = await sniperSupabaseDb.from('sniper_targets').select('post_url').eq('id', targetId).maybeSingle();
    postUrl = String((target as any)?.post_url || '');
  }

  const resultsUrl = `${frontendBase}/sniper/activity?job=${encodeURIComponent(jobId)}`;
  const importUrl = `${frontendBase}/leads?import_sniper_job=${encodeURIComponent(jobId)}`;
  const settingsUrl = `${frontendBase}/sniper/settings`;

  const vars: SniperNotifyVars = {
    profiles_found: String(extractedCount || 0),
    workspace_name: workspaceName,
    post_url: postUrl || frontendBase,
    results_url: resultsUrl,
    import_url: importUrl,
    settings_url: settingsUrl,
    run_id: String(jobId),
    error_message: String(job.error_message || '')
  };

  // Load user notification settings
  const [{ data: user }, { data: settings }] = await Promise.all([
    sniperSupabaseDb.from('users').select('email, first_name').eq('id', String(job.created_by)).maybeSingle(),
    sniperSupabaseDb.from('user_settings').select('email_notifications,email,slack_notifications,campaign_updates,slack_webhook_url').eq('user_id', String(job.created_by)).maybeSingle()
  ]);

  const toEmail = String((settings as any)?.email || (user as any)?.email || '').trim();
  const firstName = String((user as any)?.first_name || '').trim() || 'there';
  const success = String(job.status) === 'succeeded' || String(job.status) === 'partially_succeeded';

  // Email (best-effort)
  const emailAllowed = Boolean((settings as any)?.email_notifications);
  if (emailAllowed && toEmail) {
    const tplFile = success ? 'sniper-run-success.html' : 'sniper-run-failed.html';
    const tplPath = findTemplatePath(tplFile);
    if (tplPath) {
      const raw = fs.readFileSync(tplPath, 'utf8');
      const html = renderTemplate(raw, { ...vars, first_name: firstName } as any);
      const subject = success ? 'Sniper run completed' : 'Sniper run failed';
      const fromEmail = (process.env.SENDGRID_FROM_EMAIL || '').trim() || 'noreply@hirepilot.com';
      const fromName = (process.env.SENDGRID_FROM_NAME || '').trim() || 'HirePilot';
      const from = `${fromName} <${fromEmail}>`;
      try {
        await sendgridSend({ from, to: toEmail, subject, html });
      } catch (e) {
        // non-fatal
        // eslint-disable-next-line no-console
        console.warn('[sniper.notify] email send failed (non-fatal):', (e as any)?.message || e);
      }
    }
  }

  // Slack (best-effort) — "enabled" = slack_notifications OR campaign_updates
  const slackAllowed = Boolean((settings as any)?.slack_notifications ?? (settings as any)?.campaign_updates);
  const slackWebhook = String((settings as any)?.slack_webhook_url || process.env.SLACK_WEBHOOK_URL || '').trim();
  if (slackAllowed && slackWebhook) {
    try {
      await axios.post(slackWebhook, success ? slackBlockKit(vars) : slackBlockKitFailed(vars));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sniper.notify] slack send failed (non-fatal):', (e as any)?.message || e);
    }
  }

  return { ok: true };
}


