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

export const outreachWriter   = stub('outreach_writer',  'reply_draft');
export const replyHandler     = stub('reply_handler',    'reply_draft');
export const submittalDrafter = stub('submittal_drafter','submittal_send');
export const pipelineManager  = stub('pipeline_manager', 'pipeline_move');
