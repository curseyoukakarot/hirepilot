/**
 * Coordinator skill handlers — calendar + scheduling.
 * Most are autopilot-safe: they read calendars, propose times, and send
 * invites that already follow the candidate's chosen slot.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';

const stub = (name: string): SkillHandler => async (input, ctx): Promise<SkillResult> => {
  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: { skill: name, input },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: `${name} not yet wired — surfaced for human review.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: name, input } } };
  }
  return { ok: true, data: { stub: true, skill: name, input } };
};

export const calendarSyncGoogle  = stub('calendar_sync_google');
export const calendarSyncOutlook = stub('calendar_sync_outlook');
export const interviewBooker     = stub('interview_booker');
export const reminderBot         = stub('reminder_bot');
export const rescheduleMgr       = stub('reschedule_mgr');
