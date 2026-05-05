/**
 * Reference Checker skill handlers — outreach to references and synthesis
 * of feedback. Outreach gets held by guardrails (sensitive); synthesis is
 * read-only.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';

const heldStub = (name: string): SkillHandler => async (input, ctx): Promise<SkillResult> => {
  const guard = await guardActions(ctx, {
    decisionType: 'reply_draft',
    payload: { skill: name, input },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: `${name} drafts an outbound message — surfaced for review.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: name, input } } };
  }
  return { ok: true, data: { stub: true, skill: name, input } };
};

export const referenceOutreach  = heldStub('reference_outreach');
export const backChannel        = heldStub('back_channel');
export const referenceSynthesis: SkillHandler = async (input, _ctx) => ({
  ok: true,
  data: { stub: true, skill: 'reference_synthesis', input },
});
