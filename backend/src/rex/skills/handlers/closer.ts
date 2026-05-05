/**
 * Closer skill handlers — drafts offers, negotiation talking points,
 * counter-offer responses. ALL closer actions are hard-held (always require
 * human approval) because they are commercial and irreversible.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';

const heldStub = (name: string): SkillHandler => async (input, ctx): Promise<SkillResult> => {
  const guard = await guardActions(ctx, {
    decisionType: 'offer_send', // hard-hold type
    payload: { skill: name, input },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: `${name} drafts a commercial communication — always held for review.`,
  });
  return { ok: true, held: { decisionType: 'offer_send', reason: guard.reason, payload: { skill: name, input } } };
};

export const offerDrafter     = heldStub('offer_drafter');
export const negotiationCoach = heldStub('negotiation_coach');
export const counterHandler   = heldStub('counter_handler');
