/**
 * Autopilot guardrails for skill handlers.
 *
 * Every handler that has a side effect (sends a message, spends credits, books
 * a meeting) calls `guardActions(ctx, proposed)` before executing. The result
 * tells the handler whether to:
 *
 *   - 'execute' — go ahead and apply the side effect
 *   - 'hold'    — write a `decisions` row instead and return `held` to REX
 *
 * Decision logic:
 *   - trust_level = 'manual'    → always hold
 *   - trust_level = 'suggest'   → always hold (human reviews drafts before sending)
 *   - trust_level = 'autopilot' → execute IFF score ≥ threshold AND spend ≤ cap
 */

import { supabase } from '../../lib/supabase';
import type { SkillContext } from './registry';

export interface ProposedAction {
  /** Confidence/quality score 0–100. Above the workspace threshold = auto-go. */
  score?: number;
  /** Estimated spend in cents for this single action. */
  spendCents?: number;
  /** Decision type that gets written if we hold the action. */
  decisionType:
    | 'reply_draft'
    | 'scale_recommendation'
    | 'guardrail_override'
    | 'offer_send'
    | 'pipeline_move'
    | 'submittal_send'
    | 'custom';
  /** What we'd do (UI renders this). */
  payload: any;
  /** Original trigger context (lead, message, candidate, etc.). */
  context: any;
  /** Goal that triggered this action, if any. */
  goalId?: string;
  /** Free-form "why I'm holding this" copy. */
  reason?: string;
}

export interface GuardResult {
  decision: 'execute' | 'hold';
  /** Why this decision was made (telemetry). */
  reason: string;
  /** When held, the id of the freshly-written `decisions` row. */
  decisionId?: string;
}

const HARD_HOLD_TYPES = new Set([
  'offer_send',         // Always require human approval
  'guardrail_override', // Always require human approval
]);

export async function guardActions(ctx: SkillContext, proposed: ProposedAction): Promise<GuardResult> {
  // Hard-stop types always hold regardless of trust level.
  if (HARD_HOLD_TYPES.has(proposed.decisionType)) {
    const decisionId = await writeDecision(ctx, proposed, `Always-hold type: ${proposed.decisionType}`);
    return { decision: 'hold', reason: 'always_hold_type', decisionId };
  }

  // Manual + Suggest = always hold for review.
  if (ctx.trustLevel === 'manual') {
    const decisionId = await writeDecision(ctx, proposed, 'Trust level is Manual — every action requires approval.');
    return { decision: 'hold', reason: 'trust_manual', decisionId };
  }
  if (ctx.trustLevel === 'suggest') {
    const decisionId = await writeDecision(ctx, proposed, 'Trust level is Suggest — drafts are reviewed before sending.');
    return { decision: 'hold', reason: 'trust_suggest', decisionId };
  }

  // Autopilot — apply guardrails.
  const score = proposed.score ?? 100;
  const spend = proposed.spendCents ?? 0;

  if (score < ctx.autopilotScoreThreshold) {
    const reason = `Held back: score ${score} below your autopilot threshold (${ctx.autopilotScoreThreshold}).`;
    const decisionId = await writeDecision(ctx, proposed, reason);
    return { decision: 'hold', reason: 'below_score_threshold', decisionId };
  }
  if (spend > ctx.autopilotMaxSpendCents) {
    const reason = `Held back: $${(spend / 100).toFixed(2)} over your $${(ctx.autopilotMaxSpendCents / 100).toFixed(2)} per-run cap.`;
    const decisionId = await writeDecision(ctx, proposed, reason);
    return { decision: 'hold', reason: 'over_spend_cap', decisionId };
  }

  // All good — execute.
  return { decision: 'execute', reason: 'autopilot_passed' };
}

async function writeDecision(ctx: SkillContext, proposed: ProposedAction, holdReason: string): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from('decisions')
      .insert({
        workspace_id: ctx.workspaceId,
        goal_id: proposed.goalId || null,
        agent_id: ctx.agentId,
        type: proposed.decisionType,
        context: proposed.context,
        payload: proposed.payload,
        reason: proposed.reason || holdReason,
        assigned_to: ctx.userId,
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[guardrails] failed to write decision:', error.message);
      return undefined;
    }
    return (data as any)?.id;
  } catch (e: any) {
    console.warn('[guardrails] decision write threw:', e?.message || e);
    return undefined;
  }
}
