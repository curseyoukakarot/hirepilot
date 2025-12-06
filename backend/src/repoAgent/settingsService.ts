import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { RepoAgentSettings } from './types';

const DEFAULT_SETTINGS: RepoAgentSettings = {
  slackEnabled: false,
  slackChannel: null,
  slackWebhookUrl: null,
  emailEnabled: false,
  emailRecipients: [],
  nightlyCheckEnabled: false,
  nightlyCheckTimeUtc: '02:00',
  errorAlertThreshold: 5,
};

function mapRowToSettings(row: any): RepoAgentSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slackEnabled: Boolean(row.slack_enabled),
    slackChannel: row.slack_channel,
    slackWebhookUrl: row.slack_webhook_url,
    emailEnabled: Boolean(row.email_enabled),
    emailRecipients: Array.isArray(row.email_recipients) ? row.email_recipients : [],
    nightlyCheckEnabled: Boolean(row.nightly_check_enabled),
    nightlyCheckTimeUtc: row.nightly_check_time_utc || '02:00',
    errorAlertThreshold: typeof row.error_alert_threshold === 'number' ? row.error_alert_threshold : 5,
  };
}

function mapSettingsToRow(partial: Partial<RepoAgentSettings>) {
  const row: Record<string, any> = {};
  if (partial.slackEnabled !== undefined) row.slack_enabled = partial.slackEnabled;
  if (partial.slackChannel !== undefined) row.slack_channel = partial.slackChannel;
  if (partial.slackWebhookUrl !== undefined) row.slack_webhook_url = partial.slackWebhookUrl;
  if (partial.emailEnabled !== undefined) row.email_enabled = partial.emailEnabled;
  if (partial.emailRecipients !== undefined) row.email_recipients = partial.emailRecipients;
  if (partial.nightlyCheckEnabled !== undefined)
    row.nightly_check_enabled = partial.nightlyCheckEnabled;
  if (partial.nightlyCheckTimeUtc !== undefined)
    row.nightly_check_time_utc = partial.nightlyCheckTimeUtc;
  if (partial.errorAlertThreshold !== undefined)
    row.error_alert_threshold = partial.errorAlertThreshold;
  row.updated_at = new Date().toISOString();
  return row;
}

export async function getRepoAgentSettings(): Promise<RepoAgentSettings> {
  const { data, error } = await supabaseAdmin
    .from('repo_agent_settings')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error }, '[repoAgent][settingsService] Failed to load settings');
    return DEFAULT_SETTINGS;
  }

  return mapRowToSettings(data);
}

export async function updateRepoAgentSettings(
  patch: Partial<RepoAgentSettings>
): Promise<RepoAgentSettings> {
  const { data: existing } = await supabaseAdmin
    .from('repo_agent_settings')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const row = mapSettingsToRow(patch);

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('repo_agent_settings')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update settings');
    }

    return mapRowToSettings(data);
  }

  const insertRow = {
    ...DEFAULT_SETTINGS,
    ...patch,
  };
  const dbRow = mapSettingsToRow(insertRow);
  dbRow.created_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('repo_agent_settings')
    .insert([dbRow])
    .select('*')
    .single();

  if (error || !data) {
    throw error || new Error('Failed to insert settings');
  }

  return mapRowToSettings(data);
}

