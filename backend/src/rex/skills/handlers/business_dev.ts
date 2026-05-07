/**
 * Business Dev skill handlers — finds new clients hiring + cold outreach to
 * TA leaders. Cold outreach gets held by guardrails; hiring-signal monitoring
 * is read-only.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';
import { llmText } from '../llm';

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

/**
 * Cold Outreach (BD) — drafts a personalized cold email to a TA leader or
 * founder. ALWAYS held under suggest, autopilot only with a high score —
 * BD relationships are too costly to misfire.
 *
 * Input: { prospect: { first_name, last_name, title, company }, signal?, customNote?, score? }
 */
export const coldOutreachBd: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { prospect, signal, customNote, score } = input || {};
  if (!prospect || (!prospect.first_name && !prospect.email)) {
    return { ok: false, error: 'prospect_required' };
  }

  let draft = '';
  try {
    draft = await llmText({
      system: `You are a recruiting agency BD outreach writer. Draft a 3-4 sentence cold email opening with a specific signal (funding, exec hire, "we're hiring" post). Friendly but direct. End with one soft question. Never use the words "synergy" or "leverage". No subject line, no signature.`,
      user: `Prospect: ${prospect.first_name || ''} ${prospect.last_name || ''} (${prospect.title || ''} at ${prospect.company || ''})\n${signal ? 'Signal to mention: ' + signal + '\n' : ''}${customNote ? 'Sender note: ' + customNote + '\n' : ''}Draft the cold opener.`,
      max_tokens: 240,
      temperature: 0.7,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions(ctx, {
    decisionType: 'reply_draft',
    score,
    payload: { skill: 'cold_outreach_bd', prospect, signal, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, prospect },
    reason: `BD cold outreach drafted for ${prospect.first_name || prospect.company}.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: 'cold_outreach_bd', prospect, signal, draft } } };
  }
  return { ok: true, data: { approved: true, prospect, draft } };
};

/**
 * Hiring Signal Watch — surfaces companies actively hiring in your client's
 * segments. LLM prior-knowledge for now; future: cross-reference SourceJobs/
 * Indeed scrape + recent funding announcements.
 *
 * Input: { segments: string[], titles?: string[], geos?: string[] }
 */
export const hiringSignalWatch: SkillHandler = async (input, _ctx): Promise<SkillResult> => {
  const { segments = [], titles = [], geos = [] } = input || {};
  if (!segments.length) return { ok: false, error: 'segments_required' };
  try {
    const { llmJSON } = await import('../llm');
    const data = await llmJSON({
      system: `You surface companies that are likely hiring right now in given segments. Output JSON: prospects (array of {company, why_hiring, signal_strength (0-1), suggested_contact_role}), bottom_line (string). Conservative — mark inferred items.`,
      user: `Segments: ${segments.join(', ')}\nTitles wanted: ${titles.join(', ') || '(any)'}\nGeos: ${geos.join(', ') || '(any)'}`,
      max_tokens: 700,
    });
    return { ok: true, data: { ...data, source: 'llm_prior_knowledge', _disclaimer: 'Verify each company is currently hiring before reaching out.' } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'hiring_signal_watch_failed' };
  }
};

export const jobBoardScrape    = stub('job_board_scrape',    'custom');
