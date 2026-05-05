/**
 * Loads everything REX needs to act as a specific specialist agent in a
 * given workspace: trust level, autopilot guardrails, installed Skills,
 * and the agent's system prompt.
 *
 * Usage from rex/server.ts:
 *
 *   const ctx = await loadAgentContext(workspaceId, userId, 'sourcer');
 *   if (!ctx) return reply("That specialist isn't hired yet — visit /v2/hire.");
 *   // Drive REX with ctx.systemPrompt + ctx.installedSkills + ctx.guardrails.
 */

import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import type { AgentRole, TrustLevel } from './skills/types';
import type { SkillContext } from './skills/registry';

export interface AgentContext extends SkillContext {
  agentRole: AgentRole;
  agentId: string;
  trustLevel: TrustLevel;
  paused: boolean;
  systemPrompt: string;
  installedSkills: Array<{
    skill_id: string;
    enabled: boolean;
    schedule_cron: string | null;
    config: any;
  }>;
}

const PROMPT_DIR = path.join(__dirname, 'prompts', 'agents');
const promptCache = new Map<AgentRole, string>();

function loadPrompt(role: AgentRole): string {
  if (promptCache.has(role)) return promptCache.get(role)!;
  try {
    const filePath = path.join(PROMPT_DIR, `${role}.md`);
    const content = fs.readFileSync(filePath, 'utf-8');
    promptCache.set(role, content);
    return content;
  } catch (e) {
    console.warn(`[agentLoader] no prompt file for role ${role} — falling back to generic.`);
    const fallback = `You are the ${role.replace('_', ' ')} specialist on a recruiter's HirePilot team. Help the user accomplish recruiting tasks within your domain.`;
    promptCache.set(role, fallback);
    return fallback;
  }
}

/**
 * Load the full execution context for a specialist agent in a workspace.
 * Returns null if the agent isn't hired (no row in `agents` table).
 */
export async function loadAgentContext(
  workspaceId: string,
  userId: string,
  role: AgentRole
): Promise<AgentContext | null> {
  // 1. Find the agent row
  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id, role, trust_level, paused, config')
    .eq('workspace_id', workspaceId)
    .eq('role', role)
    .maybeSingle();

  if (agentErr) {
    console.error('[agentLoader] supabase error:', agentErr);
    return null;
  }
  if (!agent) return null;

  // 2. Pull installed skills
  const { data: skills } = await supabase
    .from('agent_skills')
    .select('skill_id, enabled, schedule_cron, config')
    .eq('agent_id', agent.id);

  // 3. Pull autopilot guardrails from team_settings (via workspace.team_id)
  let autopilotScoreThreshold = 90;
  let autopilotMaxSpendCents = 5000;
  try {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('team_id')
      .eq('id', workspaceId)
      .maybeSingle();
    const teamId = (ws as any)?.team_id;
    if (teamId) {
      const { data: ts } = await supabase
        .from('team_settings')
        .select('autopilot_score_threshold, autopilot_max_spend_per_run_cents')
        .eq('team_id', teamId)
        .maybeSingle();
      if ((ts as any)?.autopilot_score_threshold != null) {
        autopilotScoreThreshold = Number((ts as any).autopilot_score_threshold);
      }
      if ((ts as any)?.autopilot_max_spend_per_run_cents != null) {
        autopilotMaxSpendCents = Number((ts as any).autopilot_max_spend_per_run_cents);
      }
    }
  } catch (e: any) {
    console.warn('[agentLoader] guardrail lookup failed:', e?.message || e);
  }

  return {
    workspaceId,
    userId,
    agentId: agent.id,
    agentRole: role,
    trustLevel: (agent.trust_level || 'suggest') as TrustLevel,
    paused: !!agent.paused,
    autopilotScoreThreshold,
    autopilotMaxSpendCents,
    installedSkills: (skills || []) as any,
    systemPrompt: loadPrompt(role),
  };
}

/** For tests / runtime introspection. */
export function clearPromptCache(): void {
  promptCache.clear();
}
