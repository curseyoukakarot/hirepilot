/**
 * Business Dev skill handlers — finds new clients hiring + cold outreach to
 * TA leaders. Cold outreach gets held by guardrails; hiring-signal monitoring
 * is read-only.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';

const stub = (name: string, decisionType: 'reply_draft' | 'custom' = 'custom'): SkillHandler =>
  async (input, ctx): Promise<SkillResult> => {
    if (decisionType === 'custom') {
      return { ok: true, data: { stub: true, skill: name, input } };
    }
    const guard = await guardActions(ctx, {
      decisionType,
      score: input?.score,
      payload: { skill: name, input },
      context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
      reason: `${name} not yet wired — surfaced for human review.`,
    });
    if (guard.decision === 'hold') {
      return { ok: true, held: { decisionType, reason: guard.reason, payload: { skill: name, input } } };
    }
    return { ok: true, data: { stub: true, skill: name, input } };
  };

export const hiringSignalWatch = stub('hiring_signal_watch', 'custom');
export const coldOutreachBd    = stub('cold_outreach_bd',    'reply_draft');
export const jobBoardScrape    = stub('job_board_scrape',    'custom');
