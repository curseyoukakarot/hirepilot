/**
 * Coordinator skill handlers — calendar + scheduling.
 *
 * Real Google/Outlook calendar API isn't wired into the v2 layer yet, so
 * each handler produces a STRUCTURED PROPOSAL (suggested slots, reminder
 * text, reschedule message) and routes it through guardrails as a held
 * decision. When the calendar OAuth integration lands, these handlers swap
 * their innards to actually book / send / reschedule — call sites stay
 * unchanged.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';
import { llmJSON, llmText } from '../llm';

/**
 * Calendar Sync (Google) — when the user has connected Google Calendar,
 * pulls live freebusy / upcoming events. When not connected, holds the
 * action with a "connect under Settings → Integrations" next-step.
 *
 * Input: { intent: 'check_availability' | 'list_upcoming', window?: { from, to }, candidate_email? }
 */
export const calendarSyncGoogle: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { intent = 'list_upcoming', window, candidate_email } = input || {};

  // Try the live path first (calendar OAuth is connected with the right scope).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getCalendarClient } = require('../../../routes/v2/calendar');
    const client = await getCalendarClient(ctx.userId);
    if (client) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { google } = require('googleapis');
      const cal = google.calendar({ version: 'v3', auth: client });
      const start = window?.from || new Date().toISOString();
      const end = window?.to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      if (intent === 'check_availability') {
        const fb = await cal.freebusy.query({
          requestBody: { timeMin: start, timeMax: end, items: [{ id: 'primary' }] },
        });
        return { ok: true, data: { busy: fb.data?.calendars?.primary?.busy || [], window: { start, end } } };
      }
      // list_upcoming
      const events = await cal.events.list({
        calendarId: 'primary',
        timeMin: start,
        timeMax: end,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 25,
      });
      return {
        ok: true,
        data: {
          events: (events.data?.items || []).map((e: any) => ({
            id: e.id,
            summary: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            attendees: (e.attendees || []).map((a: any) => a.email),
          })),
        },
      };
    }
  } catch (e: any) {
    console.warn('[calendar_sync_google] live read failed:', e?.message || e);
  }

  // Fallback: not connected → hold with the connect prompt.
  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: {
      skill: 'calendar_sync_google',
      intent,
      window,
      candidate_email,
      next_step: 'Connect Google Calendar under Settings → Integrations to enable live sync.',
    },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: 'Calendar sync requires Google OAuth — proposed action held until you connect.',
  });
  return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: 'calendar_sync_google', intent, window, candidate_email } } };
};

/**
 * Calendar Sync (Outlook) — same pattern as Google.
 */
export const calendarSyncOutlook: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { intent = 'list_upcoming', window, candidate_email } = input || {};
  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: {
      skill: 'calendar_sync_outlook',
      intent,
      window,
      candidate_email,
      next_step: 'Connect Outlook Calendar under Settings → Integrations to enable live sync.',
    },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: 'Calendar sync requires Outlook OAuth — proposed action held until you connect.',
  });
  return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: 'calendar_sync_outlook', intent, window, candidate_email } } };
};

/**
 * Interview Booker — proposes 3 candidate-friendly interview slots based
 * on the recruiter's working hours + the candidate's timezone. Held until
 * calendar API lands and slots can be confirmed live.
 *
 * Input: { candidate: { first_name, timezone? }, interviewers: Array<{ name, timezone }>, duration_min?: number, urgency?: 'standard' | 'urgent' }
 */
export const interviewBooker: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate, interviewers = [], duration_min = 30, urgency = 'standard' } = input || {};
  if (!candidate?.first_name) return { ok: false, error: 'candidate_required' };

  let proposal: any;
  try {
    proposal = await llmJSON({
      system: `You propose 3 candidate-friendly interview slots. Output JSON: slots (array of {iso_datetime, candidate_local_time, interviewer_local_times: object}), buffer_minutes_before, buffer_minutes_after, recommended_slot_index (0-2), risk_notes (array). Default buffer 15min.`,
      user: `Candidate: ${candidate.first_name} (tz: ${candidate.timezone || 'PT'})\nInterviewers: ${JSON.stringify(interviewers)}\nDuration: ${duration_min}min\nUrgency: ${urgency}\nPropose times within the next 5 business days, candidate's working hours.`,
      max_tokens: 700,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_failed: ${e?.message || e}` };
  }

  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: { skill: 'interview_booker', candidate, interviewers, proposal, next_step: 'Approve to send invite once calendar OAuth is connected.' },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Proposed ${proposal?.slots?.length || 3} interview slots for ${candidate.first_name} — review before sending.`,
  });
  return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: 'interview_booker', candidate, interviewers, proposal } } };
};

/**
 * Reminder Bot — drafts a pre-interview reminder message. Held draft.
 *
 * Input: { recipient: 'candidate' | 'interviewer', name, interview: { when, who, where, role }, when_to_send: '24h' | '2h' | 'morning_of' }
 */
export const reminderBot: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { recipient, name, interview, when_to_send = '24h' } = input || {};
  if (!recipient || !name || !interview) {
    return { ok: false, error: 'recipient_name_and_interview_required' };
  }

  let draft = '';
  try {
    draft = await llmText({
      system: `You draft a pre-interview reminder. 3-4 sentences. Confirms time, attendees, and where (call link / room). Closes with "reply if anything changes". No fluff.`,
      user: `Recipient role: ${recipient}\nName: ${name}\nInterview: ${interview.when || ''} with ${interview.who || ''} for ${interview.role || ''} (${interview.where || 'video call'})\nSending: ${when_to_send}`,
      max_tokens: 200,
      temperature: 0.4,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: { skill: 'reminder_bot', recipient, name, interview, when_to_send, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: `Reminder drafted for ${name} (${recipient}, ${when_to_send}).`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: 'reminder_bot', recipient, name, interview, when_to_send, draft } } };
  }
  return { ok: true, data: { recipient, name, interview, draft } };
};

/**
 * Reschedule Manager — drafts a reschedule message + proposes new slots.
 * Held under suggest, autopilot OK if the new slot is within 7 days
 * (validated by guardrails on score/spend, not specific to date).
 *
 * Input: { candidate: { first_name, timezone? }, original: { when, who }, reason, days_window?: number }
 */
export const rescheduleMgr: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate, original, reason, days_window = 7 } = input || {};
  if (!candidate?.first_name || !original) {
    return { ok: false, error: 'candidate_and_original_required' };
  }

  let draft = '';
  try {
    draft = await llmText({
      system: `You draft a reschedule message. 2-3 sentences. Apologetic but matter-of-fact, proposes 2-3 alternatives, ends with "let me know what works". Tone: warm professional.`,
      user: `Candidate: ${candidate.first_name}\nOriginal: ${original.when || ''} with ${original.who || ''}\nReason for reschedule: ${reason || 'scheduling conflict'}\nWindow: next ${days_window} days, candidate timezone ${candidate.timezone || 'PT'}.`,
      max_tokens: 200,
      temperature: 0.5,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: { skill: 'reschedule_mgr', candidate, original, reason, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Reschedule message drafted for ${candidate.first_name}.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: 'reschedule_mgr', candidate, original, reason, draft } } };
  }
  return { ok: true, data: { candidate, original, draft } };
};
