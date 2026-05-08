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
 * Interview Booker — when Google Calendar is connected:
 *   - Pulls freebusy for the next 5 business days
 *   - Asks OpenAI to propose 3 candidate-friendly slots that don't conflict
 *   - When `confirm_slot_iso` is passed, creates the actual calendar event
 *     with attendees + Google Meet link, then returns the event details.
 *   - Otherwise returns the proposed slots as a held decision.
 *
 * Input: {
 *   candidate: { first_name, last_name?, email?, timezone? },
 *   interviewers: Array<{ name, email?, timezone? }>,
 *   duration_min?: number,
 *   confirm_slot_iso?: string,    // ISO datetime — when set, books the event
 *   topic?: string,
 * }
 */
export const interviewBooker: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate, interviewers = [], duration_min = 30, confirm_slot_iso, topic } = input || {};
  if (!candidate?.first_name) return { ok: false, error: 'candidate_required' };

  // Try the live path: Google Calendar connected → freebusy + propose / book.
  let calClient: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getCalendarClient } = require('../../../routes/v2/calendar');
    calClient = await getCalendarClient(ctx.userId);
  } catch (e: any) {
    console.warn('[interview_booker] cal client failed:', e?.message);
  }

  // === BOOKING PATH ===
  if (confirm_slot_iso && calClient) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { google } = require('googleapis');
      const cal = google.calendar({ version: 'v3', auth: calClient });
      const start = new Date(confirm_slot_iso);
      if (isNaN(start.getTime())) return { ok: false, error: 'invalid_confirm_slot_iso' };
      const end = new Date(start.getTime() + duration_min * 60 * 1000);
      const attendees = [
        candidate.email ? { email: candidate.email, displayName: `${candidate.first_name} ${candidate.last_name || ''}`.trim() } : null,
        ...interviewers.filter((i: any) => i?.email).map((i: any) => ({ email: i.email, displayName: i.name })),
      ].filter(Boolean) as any[];

      const summary = topic || `Interview: ${candidate.first_name} ${candidate.last_name || ''}`.trim();
      const event = await cal.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: {
          summary,
          description: `Interview booked via HirePilot REX.\n\nCandidate: ${candidate.first_name} ${candidate.last_name || ''}\nInterviewers: ${interviewers.map((i: any) => i.name).join(', ') || '(TBD)'}`,
          start: { dateTime: start.toISOString() },
          end:   { dateTime: end.toISOString() },
          attendees,
          conferenceData: { createRequest: { requestId: `hp-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        },
      });
      return {
        ok: true,
        data: {
          booked: true,
          event_id: event.data?.id,
          html_link: event.data?.htmlLink,
          hangout_link: event.data?.hangoutLink || event.data?.conferenceData?.entryPoints?.[0]?.uri,
          start: event.data?.start?.dateTime,
          end: event.data?.end?.dateTime,
          attendees: (event.data?.attendees || []).map((a: any) => a.email),
        },
      };
    } catch (e: any) {
      return { ok: false, error: `book_failed: ${e?.message || e}` };
    }
  }

  // === PROPOSAL PATH ===
  let busyWindows: Array<{ start: string; end: string }> = [];
  if (calClient) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { google } = require('googleapis');
      const cal = google.calendar({ version: 'v3', auth: calClient });
      const now = new Date();
      const fiveBd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      const fb = await cal.freebusy.query({
        requestBody: { timeMin: now.toISOString(), timeMax: fiveBd.toISOString(), items: [{ id: 'primary' }] },
      });
      busyWindows = (fb.data?.calendars?.primary?.busy || []).map((b: any) => ({ start: b.start, end: b.end }));
    } catch (e: any) {
      console.warn('[interview_booker] freebusy failed:', e?.message);
    }
  }

  let proposal: any;
  try {
    proposal = await llmJSON({
      system: `You propose 3 candidate-friendly interview slots that DO NOT conflict with the recruiter's busy windows. Output JSON: slots (array of {iso_datetime, candidate_local_time, interviewer_local_times: object}), buffer_minutes_before (default 15), buffer_minutes_after (default 15), recommended_slot_index (0-2), risk_notes (array). Use the next 5 business days. Honor candidate working hours (~9am-5pm in their timezone).`,
      user: `Candidate: ${candidate.first_name} (tz: ${candidate.timezone || 'America/Los_Angeles'})\nInterviewers: ${JSON.stringify(interviewers)}\nDuration: ${duration_min}min\nRecruiter busy windows (UTC):\n${busyWindows.map((b) => `- ${b.start} → ${b.end}`).join('\n') || '(none retrieved)'}`,
      max_tokens: 700,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_failed: ${e?.message || e}` };
  }

  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: {
      skill: 'interview_booker',
      candidate,
      interviewers,
      proposal,
      busy_windows: busyWindows,
      next_step: calClient
        ? 'Pick a slot and call this skill again with confirm_slot_iso to actually book.'
        : 'Connect Google Calendar under Settings → Integrations to enable live booking.',
    },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Proposed ${proposal?.slots?.length || 3} interview slots for ${candidate.first_name} — review and pick one to book.`,
  });
  return {
    ok: true,
    held: {
      decisionType: 'custom',
      reason: guard.reason,
      payload: { skill: 'interview_booker', candidate, interviewers, proposal, busy_windows: busyWindows },
    },
  };
};

/**
 * Reminder Bot — drafts a pre-interview reminder + optionally sends via
 * SendGrid when `email` is provided AND guardrails approve (autopilot).
 * Under suggest/manual, returns the draft as a held action so the
 * recruiter reviews + sends manually.
 *
 * Input: {
 *   recipient: 'candidate' | 'interviewer',
 *   name: string,
 *   email?: string,                 // when set + autopilot, dispatches the reminder
 *   interview: { when, who, where, role, html_link? },
 *   when_to_send: '24h' | '2h' | 'morning_of',
 * }
 */
export const reminderBot: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { recipient, name, email, interview, when_to_send = '24h' } = input || {};
  if (!recipient || !name || !interview) {
    return { ok: false, error: 'recipient_name_and_interview_required' };
  }

  let draft = '';
  try {
    draft = await llmText({
      system: `You draft a pre-interview reminder email body. 3-4 sentences. Confirms time, attendees, and where (call link / room). Closes with "reply if anything changes". No subject line, no signature, no fluff.`,
      user: `Recipient role: ${recipient}\nName: ${name}\nInterview: ${interview.when || ''} with ${interview.who || ''} for ${interview.role || ''}\nWhere: ${interview.html_link || interview.where || 'video call'}\nSending: ${when_to_send}`,
      max_tokens: 200,
      temperature: 0.4,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: { skill: 'reminder_bot', recipient, name, email, interview, when_to_send, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: `Reminder drafted for ${name} (${recipient}, ${when_to_send}).`,
  });

  // Held under manual / suggest — recruiter sends it themselves.
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: 'reminder_bot', recipient, name, email, interview, when_to_send, draft } } };
  }

  // Autopilot path: dispatch when we have an email address.
  if (!email) {
    return { ok: true, data: { recipient, name, interview, draft, sent: false, note: 'No email provided; reminder draft returned only.' } };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sg = (await import('@sendgrid/mail')).default;
    sg.setApiKey(process.env.SENDGRID_API_KEY!);
    const subject = recipient === 'candidate'
      ? `Reminder — your interview ${interview.when ? 'on ' + interview.when : 'is coming up'}`
      : `Reminder — interview with ${name} ${interview.when ? 'on ' + interview.when : ''}`;
    await sg.send({
      to: email,
      from: process.env.SENDGRID_FROM || 'noreply@hirepilot.ai',
      subject,
      text: draft,
      html: draft.replace(/\n/g, '<br/>'),
    });
    return { ok: true, data: { recipient, name, email, interview, draft, sent: true, when_to_send } };
  } catch (e: any) {
    return { ok: false, error: `send_failed: ${e?.message || e}` };
  }
};

/**
 * Reschedule Manager — drafts a reschedule message + proposes new slots.
 *
 * Optional live actions when calendar is connected:
 *   - When `original_event_id` is provided AND `new_slot_iso` is provided,
 *     patches the existing event to the new time (preserves attendees +
 *     conferencing). When `notify_attendees` is true, Google sends update
 *     emails to everyone.
 *
 * Input: {
 *   candidate: { first_name, timezone? },
 *   original: { when, who, original_event_id? },
 *   reason: string,
 *   new_slot_iso?: string,
 *   duration_min?: number,
 *   notify_attendees?: boolean,
 *   days_window?: number,
 * }
 */
export const rescheduleMgr: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate, original, reason, new_slot_iso, duration_min = 30, notify_attendees = true, days_window = 7 } = input || {};
  if (!candidate?.first_name || !original) {
    return { ok: false, error: 'candidate_and_original_required' };
  }

  // Try the live patch path when caller provided a target event + slot.
  let calClient: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getCalendarClient } = require('../../../routes/v2/calendar');
    calClient = await getCalendarClient(ctx.userId);
  } catch {}

  if (original.original_event_id && new_slot_iso && calClient) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { google } = require('googleapis');
      const cal = google.calendar({ version: 'v3', auth: calClient });
      const start = new Date(new_slot_iso);
      if (isNaN(start.getTime())) return { ok: false, error: 'invalid_new_slot_iso' };
      const end = new Date(start.getTime() + duration_min * 60 * 1000);

      const patched = await cal.events.patch({
        calendarId: 'primary',
        eventId: original.original_event_id,
        sendUpdates: notify_attendees ? 'all' : 'none',
        requestBody: {
          start: { dateTime: start.toISOString() },
          end:   { dateTime: end.toISOString() },
          description: `Rescheduled by HirePilot REX. Reason: ${reason || 'scheduling change'}`,
        },
      });
      return {
        ok: true,
        data: {
          rescheduled: true,
          event_id: patched.data?.id,
          html_link: patched.data?.htmlLink,
          start: patched.data?.start?.dateTime,
          end: patched.data?.end?.dateTime,
        },
      };
    } catch (e: any) {
      return { ok: false, error: `reschedule_failed: ${e?.message || e}` };
    }
  }

  // Otherwise fall through to the message-draft flow.
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
    payload: {
      skill: 'reschedule_mgr',
      candidate,
      original,
      reason,
      draft,
      next_step: calClient
        ? 'Pick a new slot and call again with new_slot_iso + original_event_id to patch the calendar event.'
        : 'Connect Google Calendar to live-reschedule.',
    },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Reschedule message drafted for ${candidate.first_name}.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: 'reschedule_mgr', candidate, original, reason, draft } } };
  }
  return { ok: true, data: { candidate, original, draft } };
};
