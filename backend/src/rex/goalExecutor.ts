/**
 * Goal execution engine.
 *
 * Two responsibilities:
 *   1. generatePlan(goal) — call OpenAI to break the goal's natural-language
 *      prompt into a structured `plan.steps[]` that maps to the Skills the
 *      user's hired specialists can run.
 *   2. executeNextStep(goal) — pick the next pending step, look up the right
 *      specialist + skill, invoke via the registry, write a goal_step_logs
 *      row, advance progress, mark the goal completed if no steps remain.
 *
 * Synchronous step-by-step execution (no worker yet). The frontend calls
 * `/api/v2/goals/:id/execute-step` repeatedly to drive the goal forward.
 * A future cron worker can replace the user-driven loop without changing
 * any of this code.
 */

import { supabase } from '../lib/supabase';
import { loadAgentContext } from './agentLoader';
import { getSkillHandler } from './skills/registry';
import type { AgentRole } from './skills/types';

export interface PlanStep {
  index: number;
  title: string;
  role: AgentRole;
  skill_id: string;
  input: Record<string, any>;
  status?: 'pending' | 'running' | 'done' | 'held' | 'failed' | 'skipped';
  // Updated by execution; not authored by the planner.
  rationale?: string;
}

export interface GoalPlan {
  steps: PlanStep[];
  /** Human-readable summary the planner produced (1–2 sentences). */
  summary?: string;
  /** Estimated total credit cost, when knowable up-front. */
  estimated_credits?: number;
  /** Specialists this plan will use. */
  assigned_agents?: AgentRole[];
}

const VALID_ROLES: AgentRole[] = [
  'sourcer', 'recruiter', 'coordinator', 'researcher',
  'business_dev', 'closer', 'account_manager', 'reference_checker',
];

function loadOpenAI(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('openai');
  const OpenAI = mod.default || mod.OpenAI || mod;
  return new (OpenAI as any)({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Generate a plan from a goal's prompt + the workspace's hired specialists.
 * The planner only schedules Skills that are actually installed.
 */
export async function generatePlan(opts: {
  workspaceId: string;
  userId: string;
  prompt: string;
  goalTitle: string;
}): Promise<GoalPlan> {
  // 1) Pull hired specialists + their installed skills so the planner only
  //    proposes things the user can actually run.
  const { data: agents } = await supabase
    .from('agents')
    .select('id, role, paused')
    .eq('workspace_id', opts.workspaceId);

  const ids = (agents || []).map((a: any) => a.id);
  const { data: skillsRows } = ids.length
    ? await supabase
        .from('agent_skills')
        .select('agent_id, skill_id, enabled')
        .in('agent_id', ids)
    : { data: [] };

  const teamCard = (agents || [])
    .filter((a: any) => !a.paused)
    .map((a: any) => {
      const installed = (skillsRows || [])
        .filter((s: any) => s.agent_id === a.id && s.enabled)
        .map((s: any) => s.skill_id);
      return `- ${a.role}: ${installed.join(', ') || '(no skills installed)'}`;
    }).join('\n');

  // 2) Ask OpenAI for a structured JSON plan.
  const openai = loadOpenAI();
  const sys = `You are a recruiting workflow planner. Break a recruiter's goal into a sequence of Skill invocations that the user's hired specialists can run.

Output JSON with shape:
{
  "summary": "1-2 sentences describing what this plan does",
  "estimated_credits": <integer>,
  "assigned_agents": ["sourcer", "recruiter", ...],
  "steps": [
    { "index": 0, "title": "...", "role": "sourcer", "skill_id": "linkedin_sourcer", "input": { ... }, "rationale": "..." },
    ...
  ]
}

Rules:
- Only use skill_ids from the team card. NEVER invent a skill.
- Only assign a step to a role that has the skill installed.
- 2-7 steps is ideal. Fewer if the goal is simple.
- Each step's input should be a partial — concrete values where the prompt provides them, sensible defaults otherwise.
- If the goal cannot be done with the current team, return an empty steps array and put a clear explanation in summary (e.g., "Hire a Sourcer first.").`;

  const user = `Goal: ${opts.goalTitle}
Prompt: ${opts.prompt}

Team card (only these roles + skills are available):
${teamCard || '(no specialists hired)'}

Plan it.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    max_tokens: 900,
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  const txt = completion.choices?.[0]?.message?.content?.trim() || '{}';
  let parsed: any;
  try { parsed = JSON.parse(txt); } catch { parsed = { steps: [] }; }

  // 3) Sanitize: strip any steps with invalid roles/skills.
  const installedByRole: Record<string, Set<string>> = {};
  for (const a of agents || []) {
    installedByRole[(a as any).role] = new Set(
      (skillsRows || []).filter((s: any) => s.agent_id === a.id && s.enabled).map((s: any) => s.skill_id),
    );
  }
  const cleanSteps: PlanStep[] = ((parsed.steps as any[]) || [])
    .filter((s) => s && VALID_ROLES.includes(s.role) && installedByRole[s.role]?.has(s.skill_id))
    .map((s: any, i: number) => ({
      index: i,
      title: String(s.title || '').slice(0, 120) || `Step ${i + 1}`,
      role: s.role,
      skill_id: s.skill_id,
      input: s.input && typeof s.input === 'object' ? s.input : {},
      rationale: s.rationale ? String(s.rationale).slice(0, 240) : undefined,
      status: 'pending',
    }));

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 280) : undefined,
    estimated_credits: typeof parsed.estimated_credits === 'number' ? parsed.estimated_credits : undefined,
    assigned_agents: Array.from(new Set(cleanSteps.map((s) => s.role))),
    steps: cleanSteps,
  };
}

/**
 * Execute the next pending step on a goal. Returns the updated plan + the
 * step result. Idempotent: calling repeatedly drives the goal to completion.
 */
export async function executeNextStep(opts: {
  workspaceId: string;
  userId: string;
  goalId: string;
}): Promise<{
  done: boolean;
  step?: PlanStep;
  result?: any;
  goalStatus: string;
  remaining: number;
}> {
  // 1) Load the goal.
  const { data: goal, error } = await supabase
    .from('goals')
    .select('id, workspace_id, status, plan, metadata')
    .eq('id', opts.goalId)
    .eq('workspace_id', opts.workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!goal) throw new Error('goal_not_found');
  if (goal.status !== 'running') {
    return { done: true, goalStatus: goal.status, remaining: 0 };
  }

  const plan: GoalPlan = (goal.plan as any) || { steps: [] };
  const steps = plan.steps || [];
  const nextIdx = steps.findIndex((s) => !s.status || s.status === 'pending' || s.status === 'running');
  if (nextIdx === -1) {
    // No more pending steps — mark complete.
    await supabase
      .from('goals')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', opts.goalId);
    return { done: true, goalStatus: 'completed', remaining: 0 };
  }

  const step = steps[nextIdx];

  // 2) Load the specialist's context.
  const ctx = await loadAgentContext(opts.workspaceId, opts.userId, step.role);
  if (!ctx) {
    return await failStep(opts, plan, nextIdx, `${step.role} not hired`);
  }
  if (ctx.paused) {
    return await failStep(opts, plan, nextIdx, `${step.role} is paused`);
  }
  if (!ctx.installedSkills.some((s) => s.skill_id === step.skill_id)) {
    return await failStep(opts, plan, nextIdx, `${step.skill_id} not installed on ${step.role}`);
  }

  const handler = getSkillHandler(step.skill_id);
  if (!handler) {
    return await failStep(opts, plan, nextIdx, `no handler registered for ${step.skill_id}`);
  }

  // 3) Mark step running, write a log row.
  steps[nextIdx] = { ...step, status: 'running' };
  await supabase.from('goals').update({ plan: { ...plan, steps } }).eq('id', opts.goalId);

  const startedAt = new Date();
  const { data: logRow } = await supabase
    .from('goal_step_logs')
    .insert({
      workspace_id: opts.workspaceId,
      goal_id: opts.goalId,
      step_index: nextIdx,
      agent_id: ctx.agentId,
      skill_id: step.skill_id,
      status: 'running',
      input: step.input,
      started_at: startedAt.toISOString(),
    })
    .select('id')
    .single();

  // 4) Invoke the Skill.
  let result: any;
  let stepStatus: PlanStep['status'] = 'done';
  let errorMsg: string | null = null;
  try {
    result = await handler(step.input || {}, ctx);
    if (result?.held) {
      stepStatus = 'held';
    } else if (result?.ok === false) {
      stepStatus = 'failed';
      errorMsg = result.error || result.message || 'handler returned ok:false';
    }
  } catch (e: any) {
    stepStatus = 'failed';
    errorMsg = e?.message || String(e);
  }

  // 5) Persist the outcome.
  const completedAt = new Date();
  steps[nextIdx] = { ...step, status: stepStatus, rationale: step.rationale };
  await supabase.from('goals').update({ plan: { ...plan, steps } }).eq('id', opts.goalId);

  if (logRow?.id) {
    await supabase
      .from('goal_step_logs')
      .update({
        status: stepStatus,
        output: result?.data || null,
        error: errorMsg,
        decision_id: null, // could be wired if guardrails returned a decision id
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      })
      .eq('id', logRow.id);
  }

  // Bump agent_skills.last_run_at so UIs reflect this.
  await supabase
    .from('agent_skills')
    .update({ last_run_at: completedAt.toISOString() })
    .eq('agent_id', ctx.agentId)
    .eq('skill_id', step.skill_id);

  // 6) If a step failed, mark the goal failed too. Held steps don't block —
  //    the user resolves them on the Decisions page and re-runs from there.
  const remaining = steps.filter((s) => s.status === 'pending').length;
  if (stepStatus === 'failed') {
    await supabase
      .from('goals')
      .update({ status: 'failed', completed_at: completedAt.toISOString() })
      .eq('id', opts.goalId);
    return { done: true, step: steps[nextIdx], result, goalStatus: 'failed', remaining };
  }
  if (remaining === 0 && steps.every((s) => s.status === 'done' || s.status === 'held')) {
    const allHeld = steps.every((s) => s.status === 'held');
    const finalStatus = allHeld ? 'awaiting_approval' : 'completed';
    await supabase
      .from('goals')
      .update({ status: finalStatus, completed_at: completedAt.toISOString() })
      .eq('id', opts.goalId);
    return { done: true, step: steps[nextIdx], result, goalStatus: finalStatus, remaining: 0 };
  }
  return { done: false, step: steps[nextIdx], result, goalStatus: 'running', remaining };
}

async function failStep(
  opts: { workspaceId: string; userId: string; goalId: string },
  plan: GoalPlan,
  idx: number,
  reason: string,
) {
  const steps = plan.steps;
  steps[idx] = { ...steps[idx], status: 'failed' };
  await supabase
    .from('goals')
    .update({ plan: { ...plan, steps }, status: 'failed', completed_at: new Date().toISOString() })
    .eq('id', opts.goalId);
  await supabase.from('goal_step_logs').insert({
    workspace_id: opts.workspaceId,
    goal_id: opts.goalId,
    step_index: idx,
    skill_id: steps[idx].skill_id,
    status: 'failed',
    input: steps[idx].input,
    error: reason,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: 0,
  });
  return { done: true, step: steps[idx], goalStatus: 'failed', remaining: 0 };
}
