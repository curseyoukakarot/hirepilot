/**
 * Recruiter skill handlers.
 *
 * Recruiter Skills DO send messages and submittals, so guardrails matter
 * here more than for Sourcer. Reply Handler especially: comp answers,
 * negotiation back-and-forth, and anything off-script gets held.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';

const stub = (name: string, decisionType: 'reply_draft' | 'submittal_send' | 'pipeline_move' | 'custom' = 'custom'): SkillHandler =>
  async (input, ctx): Promise<SkillResult> => {
    const guard = await guardActions(ctx, {
      decisionType,
      score: input?.score,
      spendCents: input?.spendCents,
      payload: { skill: name, input },
      context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, lead: input?.lead },
      reason: `${name} not yet wired — surfaced for human review.`,
    });
    if (guard.decision === 'hold') {
      return { ok: true, held: { decisionType, reason: guard.reason, payload: { skill: name, input } } };
    }
    return { ok: true, data: { stub: true, skill: name, input } };
  };

const SENSITIVE_PATTERNS = [
  /\b(comp|salary|equity|signing|relocation|bonus|offer)\b/i,
  /\$\d/,
  /\b(decline|reject|pass|withdraw)\b/i,
];

/**
 * Reply Handler — drafts a response to an incoming reply, ALWAYS held when
 * the original message contains sensitive topics (comp, decline, etc.) even
 * under autopilot. Otherwise routes through normal guardrails.
 *
 * Input: { lead: { id, first_name, last_name, ... }, original_text, draft_text, score? }
 */
export const replyHandler: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { lead, original_text = '', draft_text = '', score } = input || {};
  const sensitive = SENSITIVE_PATTERNS.some((rx) => rx.test(original_text));

  // Force-hold sensitive replies regardless of trust level.
  if (sensitive) {
    const proposed = {
      decisionType: 'reply_draft' as const,
      score,
      payload: { skill: 'reply_handler', lead, original_text, draft_text, sensitive_topic: true },
      context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, lead },
      reason: 'Original message references comp / negotiation / decline — held for human review.',
    };
    const guard = await guardActions(
      { ...ctx, trustLevel: 'manual' }, // force-manual for sensitive topics
      proposed,
    );
    return {
      ok: true,
      held: { decisionType: 'reply_draft', reason: guard.reason, payload: proposed.payload },
    };
  }

  // Otherwise apply normal trust-ladder guardrails.
  const guard = await guardActions(ctx, {
    decisionType: 'reply_draft',
    score,
    payload: { skill: 'reply_handler', lead, original_text, draft_text },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, lead },
    reason: `Reply draft ready (score ${score ?? 'n/a'}).`,
  });

  if (guard.decision === 'hold') {
    return {
      ok: true,
      held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: 'reply_handler', lead, original_text, draft_text } },
    };
  }
  // Real send is handled by REX legacy send_email tool — this handler returns
  // the approved draft for the caller to actually send.
  return { ok: true, data: { approved: true, lead, draft_text } };
};

export const outreachWriter   = stub('outreach_writer',  'reply_draft');
export const submittalDrafter = stub('submittal_drafter','submittal_send');
export const pipelineManager  = stub('pipeline_manager', 'pipeline_move');
