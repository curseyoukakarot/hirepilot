/**
 * Skill schedule cron tick.
 *
 * For every agent_skills row with a schedule_cron set, check if the next
 * scheduled run has passed (based on last_run_at + cron expression). If so,
 * invoke the Skill via the registry. Mirrors the goal worker pattern.
 *
 * Use cases:
 *   - Sourcer's `news_watch` running nightly
 *   - Account Manager's `weekly_reports` running every Monday 9am
 *   - Coordinator's `reminder_bot` running every morning
 *
 * Conservative: a Skill must be `enabled = true` AND `schedule_capable = true`
 * (per skills_catalog) before this worker will fire it. Misconfigured cron
 * strings are skipped, not crashed on.
 */

import { supabaseDb } from '../lib/supabase';

const MAX_INVOCATIONS_PER_TICK = 20; // safety cap

export async function runSkillScheduleTick(): Promise<{
  candidates: number;
  invoked: number;
  skipped: number;
  errors: number;
}> {
  const counters = { candidates: 0, invoked: 0, skipped: 0, errors: 0 };

  // 1) Pull every agent_skill that has a schedule + is enabled + is schedule_capable.
  const { data: rows, error } = await supabaseDb
    .from('agent_skills')
    .select(`
      agent_id,
      skill_id,
      enabled,
      schedule_cron,
      config,
      last_run_at,
      installed_at,
      agents:agent_id ( id, workspace_id, role, paused, hired_by ),
      skills_catalog:skill_id ( id, schedule_capable )
    `)
    .not('schedule_cron', 'is', null)
    .eq('enabled', true);

  if (error) {
    console.warn('[skillScheduleTick] failed to list scheduled skills:', error.message);
    counters.errors++;
    return counters;
  }
  if (!rows || rows.length === 0) return counters;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CronExpressionParser } = require('cron-parser');

  for (const row of rows as any[]) {
    counters.candidates++;
    if (counters.invoked >= MAX_INVOCATIONS_PER_TICK) break;

    const agent = row.agents;
    const catalog = row.skills_catalog;
    if (!agent || !catalog) { counters.skipped++; continue; }
    if (agent.paused) { counters.skipped++; continue; }
    if (!catalog.schedule_capable) { counters.skipped++; continue; }
    if (!row.schedule_cron) { counters.skipped++; continue; }

    // Determine if the next scheduled time has passed.
    let dueNow = false;
    try {
      const since = row.last_run_at ? new Date(row.last_run_at) : new Date(row.installed_at);
      const interval = CronExpressionParser.parse(row.schedule_cron, { currentDate: since, tz: 'UTC' });
      const next = interval.next().toDate();
      if (next.getTime() <= Date.now()) dueNow = true;
    } catch (e: any) {
      console.warn('[skillScheduleTick] bad cron:', row.schedule_cron, e?.message);
      counters.skipped++;
      continue;
    }

    if (!dueNow) { counters.skipped++; continue; }

    // 2) Resolve the user context (agent's hirer; falls back to workspace owner).
    let userId: string | null = agent.hired_by || null;
    if (!userId) {
      const { data: owner } = await supabaseDb
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', agent.workspace_id)
        .eq('role', 'owner')
        .eq('status', 'active')
        .maybeSingle();
      userId = (owner as any)?.user_id || null;
    }
    if (!userId) { counters.skipped++; continue; }

    // 3) Invoke via the registry, with the saved config as input.
    try {
      const { loadAgentContext } = await import('../src/rex/agentLoader');
      const { getSkillHandler } = await import('../src/rex/skills/registry');
      const { logActivity, skillLabel } = await import('../src/rex/activityLog');

      const ctx = await loadAgentContext(agent.workspace_id, userId, agent.role);
      if (!ctx) { counters.skipped++; continue; }

      const handler = getSkillHandler(row.skill_id);
      if (!handler) { counters.skipped++; continue; }

      const result = await handler(row.config || {}, ctx);

      await supabaseDb
        .from('agent_skills')
        .update({ last_run_at: new Date().toISOString() })
        .eq('agent_id', agent.id)
        .eq('skill_id', row.skill_id);

      const sLabel = skillLabel(row.skill_id);
      const summary = result?.held
        ? `${agent.role} held scheduled ${sLabel} for review`
        : result?.ok === false
          ? `${agent.role} scheduled ${sLabel} failed`
          : `${agent.role} ran scheduled ${sLabel}`;
      await logActivity({
        workspaceId: agent.workspace_id,
        userId,
        agentId: agent.id,
        agentRole: agent.role,
        eventType: result?.held ? 'skill_held' : (result?.ok === false ? 'skill_failed' : 'skill_executed'),
        skillId: row.skill_id,
        summary,
        detail: { invokedFrom: 'schedule', cron: row.schedule_cron },
      });

      counters.invoked++;
    } catch (e: any) {
      console.warn('[skillScheduleTick] invoke failed for', row.skill_id, ':', e?.message);
      counters.errors++;
    }
  }

  return counters;
}
