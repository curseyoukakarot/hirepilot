/**
 * Closer skill handlers — drafts offers, negotiation talking points,
 * counter-offer responses. ALL closer actions are hard-held (always require
 * human approval) because they are commercial and irreversible.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';
import { llmText, llmJSON } from '../llm';

/**
 * Offer Drafter — drafts an offer letter body with current comp ranges.
 * ALWAYS held (offer_send is a hard-hold decision type).
 *
 * Input: { candidate: { first_name, last_name }, role, company, comp: { base_low, base_high, equity, signing? }, start_date?, custom_terms? }
 */
export const offerDrafter: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate, role, company, comp, start_date, custom_terms } = input || {};
  if (!candidate?.first_name || !role || !comp) {
    return { ok: false, error: 'candidate_role_and_comp_required' };
  }

  let draft = '';
  try {
    draft = await llmText({
      system: `You draft an offer letter body for a recruiter to send. Format: 2-line congratulatory opener, structured comp section (base + equity + signing if any), 1-line start date + next steps, signoff. Specific numbers — no ranges. Professional, warm but not effusive.`,
      user: `Candidate: ${candidate.first_name} ${candidate.last_name || ''}\nRole: ${role}${company ? ' at ' + company : ''}\nComp: base $${comp.base_low}–${comp.base_high}, equity ${comp.equity || '0'}, signing $${comp.signing || 0}\n${start_date ? 'Start: ' + start_date + '\n' : ''}${custom_terms ? 'Custom terms: ' + custom_terms + '\n' : ''}Use the midpoint of the base range. Draft the letter body.`,
      max_tokens: 460,
      temperature: 0.4,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions({ ...ctx, trustLevel: 'manual' }, {
    decisionType: 'offer_send',
    payload: { skill: 'offer_drafter', candidate, role, company, comp, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Offer drafted for ${candidate.first_name} — review every word before sending.`,
  });
  return { ok: true, held: { decisionType: 'offer_send', reason: guard.reason, payload: { skill: 'offer_drafter', candidate, role, company, comp, draft } } };
};

/**
 * Negotiation Coach — produces structured talking points for a recruiter
 * about to negotiate. Read-only (no draft to send), but still routed
 * through hard-hold so the recruiter sees it on the Decisions page.
 *
 * Input: { candidate: { first_name }, ask: { what_they_want, why }, current_offer, recruiter_range: { floor, ceiling } }
 */
export const negotiationCoach: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate, ask, current_offer, recruiter_range } = input || {};
  if (!candidate?.first_name || !ask) {
    return { ok: false, error: 'candidate_and_ask_required' };
  }

  let data: any;
  try {
    data = await llmJSON({
      system: `You produce structured negotiation talking points for a recruiter. Output JSON: stretch_offer (specific numbers + why it works), safe_offer (specific numbers + why it works), hold_lines (array of 3 short scripts the recruiter can use), red_flags (array of things that would mean walk away), recommended (one of "stretch", "safe", "hold"), confidence (0-1).`,
      user: `Candidate: ${candidate.first_name}\nWhat they want: ${ask.what_they_want}${ask.why ? ' (because ' + ask.why + ')' : ''}\nCurrent offer: ${JSON.stringify(current_offer || {})}\nRecruiter's range: floor ${recruiter_range?.floor || '?'}, ceiling ${recruiter_range?.ceiling || '?'}`,
      max_tokens: 700,
    });
  } catch (e: any) {
    return { ok: false, error: e?.message || 'negotiation_coach_failed' };
  }

  const guard = await guardActions({ ...ctx, trustLevel: 'manual' }, {
    decisionType: 'offer_send',
    payload: { skill: 'negotiation_coach', candidate, ask, talking_points: data },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Negotiation talking points ready for ${candidate.first_name} — review before the call.`,
  });
  return { ok: true, held: { decisionType: 'offer_send', reason: guard.reason, payload: { skill: 'negotiation_coach', candidate, ask, talking_points: data } } };
};

/**
 * Counter-offer Handler — drafts a response when a candidate counters.
 * Two options always: stretch + safe with the math on each. ALWAYS held.
 *
 * Input: { candidate: { first_name }, counter: { ask, message? }, current_offer, recruiter_range: { floor, ceiling } }
 */
export const counterHandler: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate, counter, current_offer, recruiter_range } = input || {};
  if (!candidate?.first_name || !counter) {
    return { ok: false, error: 'candidate_and_counter_required' };
  }

  let data: any;
  try {
    data = await llmJSON({
      system: `You draft counter-offer responses. Output JSON: stretch_response (string — message body to send, with stretch numbers), safe_response (string — message body with safe numbers), math (object: stretch_delta_base, safe_delta_base, total_cost_difference), recommendation ("stretch" | "safe" | "hold"), recommendation_reason (string).`,
      user: `Candidate: ${candidate.first_name}\nCounter ask: ${counter.ask}\n${counter.message ? 'Their words: "' + counter.message + '"\n' : ''}Current offer: ${JSON.stringify(current_offer || {})}\nRecruiter range: floor ${recruiter_range?.floor || '?'}, ceiling ${recruiter_range?.ceiling || '?'}`,
      max_tokens: 800,
    });
  } catch (e: any) {
    return { ok: false, error: e?.message || 'counter_handler_failed' };
  }

  const guard = await guardActions({ ...ctx, trustLevel: 'manual' }, {
    decisionType: 'offer_send',
    payload: { skill: 'counter_handler', candidate, counter, options: data },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Counter-offer responses drafted for ${candidate.first_name} (recommended: ${data.recommendation || 'review'}).`,
  });
  return { ok: true, held: { decisionType: 'offer_send', reason: guard.reason, payload: { skill: 'counter_handler', candidate, counter, options: data } } };
};
