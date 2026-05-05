/**
 * MCP tools that let REX inspect the user's hired team and invoke any
 * Skill installed on any specialist. This is the bridge between REX's
 * legacy tool surface and the v2 skill registry.
 *
 * Tools exported:
 *   hp_list_specialists  — what's hired, what's paused, what's installed
 *   hp_invoke_skill      — call a Skill on a hired specialist (with guardrails)
 *
 * REX picks tools dynamically based on the system-prompt context that
 * `rexChat.ts` injects (see "Your team" block).
 */

import { supabase } from '../lib/supabase';
import { getSkillHandler } from './skills/registry';
import { loadAgentContext } from './agentLoader';
import type { AgentRole } from './skills/types';

const VALID_ROLES: AgentRole[] = [
  'sourcer',
  'recruiter',
  'coordinator',
  'researcher',
  'business_dev',
  'closer',
  'account_manager',
  'reference_checker',
];

async function resolveWorkspaceId(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.rpc('ensure_default_workspace_for_user', { p_user_id: userId });
    if (!error && data) return String(data);
  } catch {}
  try {
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if ((data as any)?.workspace_id) return String((data as any).workspace_id);
  } catch {}
  return null;
}

export const specialistTools = {
  /**
   * Returns the user's hired specialists, their trust levels, and the Skills
   * installed on each. REX consults this at the start of any task that
   * could be delegated.
   */
  hp_list_specialists: {
    parameters: {
      userId: { type: 'string' },
    },
    handler: async ({ userId }: { userId: string }) => {
      const workspaceId = await resolveWorkspaceId(userId);
      if (!workspaceId) {
        return { specialists: [], note: 'No workspace found for this user.' };
      }

      const { data: agents } = await supabase
        .from('agents')
        .select('id, role, display_name, trust_level, paused, hired_at')
        .eq('workspace_id', workspaceId)
        .order('hired_at', { ascending: true });

      const ids = (agents || []).map((a: any) => a.id);
      const skillsByAgent: Record<string, any[]> = {};
      if (ids.length) {
        const { data: skills } = await supabase
          .from('agent_skills')
          .select('agent_id, skill_id, enabled, schedule_cron, skills_catalog ( id, name, agent_role )')
          .in('agent_id', ids);
        for (const row of (skills || []) as any[]) {
          if (!skillsByAgent[row.agent_id]) skillsByAgent[row.agent_id] = [];
          skillsByAgent[row.agent_id].push({
            skill_id: row.skill_id,
            name: row.skills_catalog?.name || row.skill_id,
            enabled: row.enabled,
            scheduled: !!row.schedule_cron,
          });
        }
      }

      return {
        workspace_id: workspaceId,
        specialists: (agents || []).map((a: any) => ({
          id: a.id,
          role: a.role,
          display_name: a.display_name || roleLabel(a.role),
          trust_level: a.trust_level,
          paused: a.paused,
          hired_at: a.hired_at,
          skills: skillsByAgent[a.id] || [],
        })),
      };
    },
  },

  /**
   * Invokes a Skill on a hired specialist. The skill_id must match the
   * specialist's role (validated at the registry layer). Guardrails decide
   * whether to execute or hold; either way REX gets a structured result.
   */
  hp_invoke_skill: {
    parameters: {
      userId:   { type: 'string' },
      role:     { type: 'string', description: 'sourcer | recruiter | coordinator | researcher | business_dev | closer | account_manager | reference_checker' },
      skill_id: { type: 'string', description: 'The skills_catalog.id to invoke (e.g. apollo_enrich, reply_handler)' },
      input:    { type: 'object', description: 'Skill-specific input payload', optional: true },
    },
    handler: async ({ userId, role, skill_id, input }: { userId: string; role: AgentRole; skill_id: string; input?: any }) => {
      if (!VALID_ROLES.includes(role)) {
        return { ok: false, error: 'invalid_role', valid_roles: VALID_ROLES };
      }
      const workspaceId = await resolveWorkspaceId(userId);
      if (!workspaceId) return { ok: false, error: 'no_workspace' };

      const ctx = await loadAgentContext(workspaceId, userId, role);
      if (!ctx) {
        return {
          ok: false,
          error: 'specialist_not_hired',
          message: `${roleLabel(role)} isn't on your team yet. Visit /v2/hire to hire one — REX can suggest it now.`,
        };
      }
      if (ctx.paused) {
        return { ok: false, error: 'specialist_paused', message: `${roleLabel(role)} is currently paused.` };
      }

      const installed = new Set(ctx.installedSkills.map((s) => s.skill_id));
      if (!installed.has(skill_id)) {
        return {
          ok: false,
          error: 'skill_not_installed',
          message: `${skill_id} isn't installed on your ${roleLabel(role)}. Install it from the catalog or pick a different Skill.`,
          installed_skills: Array.from(installed),
        };
      }

      const handler = getSkillHandler(skill_id);
      if (!handler) {
        return { ok: false, error: 'no_handler_registered', skill_id };
      }

      try {
        const result = await handler(input || {}, ctx);
        if (result.held) {
          // Mark touched: we still record `last_run_at` for held actions so the UI
          // can show "Last surfaced at..." even when REX held it for review.
          await supabase
            .from('agent_skills')
            .update({ last_run_at: new Date().toISOString() })
            .eq('agent_id', ctx.agentId)
            .eq('skill_id', skill_id);
          return {
            ok: true,
            held: true,
            decision_type: result.held.decisionType,
            reason: result.held.reason,
            message: `Held for review on the Decisions page (trust = ${ctx.trustLevel}).`,
          };
        }
        // Track successful execution
        await supabase
          .from('agent_skills')
          .update({ last_run_at: new Date().toISOString() })
          .eq('agent_id', ctx.agentId)
          .eq('skill_id', skill_id);
        return { ok: true, held: false, data: result.data };
      } catch (e: any) {
        return { ok: false, error: 'handler_threw', message: e?.message || String(e) };
      }
    },
  },
};

function roleLabel(role: string): string {
  switch (role) {
    case 'sourcer':           return 'Sourcer';
    case 'recruiter':         return 'Recruiter';
    case 'coordinator':       return 'Coordinator';
    case 'researcher':        return 'Researcher';
    case 'business_dev':      return 'Business Dev';
    case 'closer':            return 'Closer';
    case 'account_manager':   return 'Account Manager';
    case 'reference_checker': return 'Reference Checker';
    default:                  return role;
  }
}

export { resolveWorkspaceId };
