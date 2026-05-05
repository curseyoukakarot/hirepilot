/**
 * Account Manager skill handlers — client communications. Most are scheduled
 * (weekly digests, renewal nudges); pipeline updates are autopilot-safe but
 * client-facing notifications get held.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';

const stub = (name: string, holdable = false): SkillHandler => async (input, ctx): Promise<SkillResult> => {
  if (!holdable) return { ok: true, data: { stub: true, skill: name, input } };
  const guard = await guardActions(ctx, {
    decisionType: 'reply_draft',
    payload: { skill: name, input },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: `${name} drafts a client-facing message — surfaced for review.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: name, input } } };
  }
  return { ok: true, data: { stub: true, skill: name, input } };
};

export const weeklyReports   = stub('weekly_reports',   true);
export const pipelineUpdater = stub('pipeline_updater', false);
export const renewalNudge    = stub('renewal_nudge',    true);
