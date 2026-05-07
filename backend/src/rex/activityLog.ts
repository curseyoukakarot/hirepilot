/**
 * Activity log writer for REX/specialist events.
 *
 * Every meaningful action goes here so the Today page + Team activity
 * strip + per-agent "Right now" line have a single source of truth.
 *
 * Failures are non-fatal — never block a successful action because we
 * couldn't log it.
 */

import { supabase } from '../lib/supabase';

export type ActivityEventType =
  | 'skill_executed'
  | 'skill_held'
  | 'skill_failed'
  | 'goal_planned'
  | 'goal_started'
  | 'goal_step_done'
  | 'goal_completed'
  | 'goal_failed'
  | 'decision_resolved'
  | 'agent_hired'
  | 'agent_fired'
  | 'agent_trust_changed';

export interface ActivityRow {
  workspaceId: string;
  userId?: string | null;
  agentId?: string | null;
  agentRole?: string | null;
  eventType: ActivityEventType;
  goalId?: string | null;
  decisionId?: string | null;
  skillId?: string | null;
  summary: string;
  detail?: any;
}

export async function logActivity(row: ActivityRow): Promise<void> {
  try {
    await supabase.from('rex_activity_log').insert({
      workspace_id: row.workspaceId,
      user_id: row.userId || null,
      agent_id: row.agentId || null,
      agent_role: row.agentRole || null,
      event_type: row.eventType,
      goal_id: row.goalId || null,
      decision_id: row.decisionId || null,
      skill_id: row.skillId || null,
      summary: row.summary.slice(0, 280),
      detail: row.detail || null,
    });
  } catch (e: any) {
    console.warn('[activityLog] insert failed (non-fatal):', e?.message || e);
  }
}

/**
 * Friendly skill labels for activity summaries — keeps the timeline scannable.
 */
const SKILL_LABEL: Record<string, string> = {
  apollo_enrich: 'Apollo enrich',
  linkedin_sourcer: 'LinkedIn sourcing',
  hunter_skill: 'Hunter find',
  skrapp_skill: 'Skrapp find',
  icp_researcher: 'ICP fingerprint',
  browser_researcher: 'browser research',
  github_sourcer: 'GitHub sourcing',
  twitter_sourcer: 'X / Twitter sourcing',
  outreach_writer: 'outreach draft',
  reply_handler: 'reply draft',
  submittal_drafter: 'submittal draft',
  pipeline_manager: 'pipeline move',
  calendar_sync_google: 'Google calendar sync',
  calendar_sync_outlook: 'Outlook calendar sync',
  interview_booker: 'interview booking',
  reminder_bot: 'reminder',
  reschedule_mgr: 'reschedule',
  company_intel: 'company intel',
  comp_benchmark: 'comp benchmark',
  news_watch: 'news watch',
  hiring_signal_watch: 'hiring signal watch',
  cold_outreach_bd: 'BD cold outreach',
  job_board_scrape: 'job board scrape',
  offer_drafter: 'offer draft',
  negotiation_coach: 'negotiation talking points',
  counter_handler: 'counter-offer draft',
  weekly_reports: 'weekly status digest',
  pipeline_updater: 'client pipeline update',
  renewal_nudge: 'renewal nudge',
  reference_outreach: 'reference request draft',
  back_channel: 'back-channel inquiry draft',
  reference_synthesis: 'reference synthesis',
};

export function skillLabel(skillId?: string | null): string {
  if (!skillId) return 'Skill';
  return SKILL_LABEL[skillId] || skillId.replace(/_/g, ' ');
}
