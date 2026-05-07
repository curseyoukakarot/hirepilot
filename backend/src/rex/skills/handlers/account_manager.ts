/**
 * Account Manager skill handlers — client communications. Most are scheduled
 * (weekly digests, renewal nudges); pipeline updates are autopilot-safe but
 * client-facing notifications get held.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';
import { llmText } from '../llm';
import { supabase } from '../../../lib/supabase';

/**
 * Weekly Status Reports — drafts a client-facing weekly digest from the
 * workspace's recent activity (decisions resolved, candidates advanced,
 * goals completed). Held for review by default.
 *
 * Input: { client_name, sinceDays?: number, includeMetrics?: boolean }
 */
export const weeklyReports: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { client_name, sinceDays = 7 } = input || {};
  if (!client_name) return { ok: false, error: 'client_name_required' };

  // Pull rough metrics from the activity log + decisions for the window.
  const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: activity } = await supabase
    .from('rex_activity_log')
    .select('event_type, summary, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .gte('created_at', sinceIso)
    .limit(100);

  const counts = (activity || []).reduce((acc: Record<string, number>, row: any) => {
    acc[row.event_type] = (acc[row.event_type] || 0) + 1;
    return acc;
  }, {});

  let draft = '';
  try {
    draft = await llmText({
      system: `You write a recruiting agency's weekly client digest. Format: 3-line opener acknowledging the week, then bullet list of what shipped (use the activity counts), then 1-line "next week" plan. Honest about gaps. No happy-talk filler.`,
      user: `Client: ${client_name}\nWindow: last ${sinceDays} days\n\nActivity counters: ${JSON.stringify(counts)}\nRecent events (newest first):\n${(activity || []).slice(0, 12).map((a: any) => `- ${a.summary}`).join('\n')}`,
      max_tokens: 380,
      temperature: 0.5,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions(ctx, {
    decisionType: 'reply_draft',
    payload: { skill: 'weekly_reports', client_name, draft, counts },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, client_name },
    reason: `Weekly digest drafted for ${client_name}.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: 'weekly_reports', client_name, draft, counts } } };
  }
  return { ok: true, data: { approved: true, client_name, draft, counts } };
};

/**
 * Pipeline Updater — generates a structured per-client pipeline summary
 * (advancing / stalled / at-risk). Read-only, autopilot-safe.
 *
 * Input: { client_name, jobs?: Array<{ id, title }> }
 */
export const pipelineUpdater: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { client_name, jobs = [] } = input || {};
  if (!client_name) return { ok: false, error: 'client_name_required' };

  // Pull recent activity summary (agent_role='recruiter' captures pipeline moves).
  const { data: recent } = await supabase
    .from('rex_activity_log')
    .select('summary, event_type, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('agent_role', 'recruiter')
    .order('created_at', { ascending: false })
    .limit(40);

  try {
    const { llmJSON } = await import('../llm');
    const data = await llmJSON({
      system: `You summarize a recruiter's hiring pipeline for a client. Output JSON: advancing (array of {candidate_or_job, note}), stalled (array same shape), at_risk (array same shape), bottom_line (1 sentence). Concise — recruiters skim before they read.`,
      user: `Client: ${client_name}\nJobs in scope: ${jobs.map((j: any) => j.title).join(', ') || '(any)'}\n\nRecent pipeline events:\n${(recent || []).map((r: any) => `- ${r.summary}`).join('\n')}`,
      max_tokens: 600,
    });
    return { ok: true, data: { ...data, source: 'activity_log_summary', client_name } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'pipeline_updater_failed' };
  }
};

/**
 * Renewal Nudge — checks the workspace's recent activity and drafts a
 * recruiter-facing nudge when a client retainer is approaching renewal.
 * (For now: takes renewal_date as an input from the caller; future: pull
 * from a `clients` table when that schema lands.)
 *
 * Input: { client_name, renewal_date (ISO), days_threshold?: number }
 */
export const renewalNudge: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { client_name, renewal_date, days_threshold = 30 } = input || {};
  if (!client_name || !renewal_date) return { ok: false, error: 'client_name_and_renewal_date_required' };

  const renewalTs = new Date(renewal_date).getTime();
  if (isNaN(renewalTs)) return { ok: false, error: 'invalid_renewal_date' };
  const daysUntil = Math.floor((renewalTs - Date.now()) / (24 * 60 * 60 * 1000));

  if (daysUntil > days_threshold) {
    return {
      ok: true,
      data: { client_name, daysUntil, action: 'no_nudge_yet', message: `Renewal in ${daysUntil} days — outside the ${days_threshold}-day window.` },
    };
  }

  let draft = '';
  try {
    draft = await llmText({
      system: `You draft a short internal Slack message reminding a recruiter to nudge a client about renewal. 2-3 sentences. Mention the days remaining + suggest a specific next step. No fluff.`,
      user: `Client: ${client_name}\nRenewal date: ${renewal_date} (${daysUntil} days away)`,
      max_tokens: 180,
      temperature: 0.5,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  // Recruiter-facing nudge — autopilot-safe (no client-side action), but we
  // still hold under suggest mode so the user can edit before any send.
  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: { skill: 'renewal_nudge', client_name, renewal_date, daysUntil, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, client_name },
    reason: `Renewal for ${client_name} in ${daysUntil} days — drafted nudge.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: 'renewal_nudge', client_name, renewal_date, daysUntil, draft } } };
  }
  return { ok: true, data: { client_name, daysUntil, draft } };
};
