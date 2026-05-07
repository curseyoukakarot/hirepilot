/**
 * Reference Checker skill handlers — outreach to references and synthesis
 * of feedback. Outreach gets held by guardrails (sensitive); synthesis is
 * read-only.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';
import { llmText, llmJSON } from '../llm';

/**
 * Reference Outreach — drafts a formal "candidate listed you as a reference"
 * email. ALWAYS held: tone matters and these can break trust if misfired.
 *
 * Input: { reference: { name, email?, relationship }, candidate: { first_name, last_name }, role: string }
 */
export const referenceOutreach: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { reference, candidate, role } = input || {};
  if (!reference?.name || !candidate?.first_name) {
    return { ok: false, error: 'reference_and_candidate_required' };
  }

  let draft = '';
  try {
    draft = await llmText({
      system: `You draft a formal reference request email. 4-6 sentences. Polite, specific, ends with a clear ask + an estimated time commitment (10-15 min). Never imply the candidate is already chosen — references are part of the diligence, not a formality.`,
      user: `Reference: ${reference.name} (${reference.relationship || 'former colleague'})\nCandidate: ${candidate.first_name} ${candidate.last_name || ''}\nRole being considered: ${role || 'a senior position'}\nDraft the body — no subject line, no signature.`,
      max_tokens: 260,
      temperature: 0.5,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions({ ...ctx, trustLevel: 'manual' }, {
    decisionType: 'reply_draft',
    payload: { skill: 'reference_outreach', reference, candidate, role, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Reference request drafted for ${reference.name} — held for review.`,
  });
  return { ok: true, held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: 'reference_outreach', reference, candidate, role, draft } } };
};

/**
 * Back-channel — drafts an informal "do you know X?" inquiry to a mutual
 * connection. ALWAYS held; off-record nature requires extra care.
 *
 * Input: { contact: { name, relationship }, candidate: { first_name, last_name, company }, why_asking: string }
 */
export const backChannel: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { contact, candidate, why_asking } = input || {};
  if (!contact?.name || !candidate?.first_name) {
    return { ok: false, error: 'contact_and_candidate_required' };
  }

  let draft = '';
  try {
    draft = await llmText({
      system: `You draft an informal back-channel inquiry to a mutual connection. 3-4 sentences. Conversational tone, acknowledges the off-record nature ("just between us"), specific about what you want to learn. Never pressure — the contact must feel free to decline.`,
      user: `Contact: ${contact.name} (${contact.relationship || 'mutual connection'})\nCandidate to learn about: ${candidate.first_name} ${candidate.last_name || ''}${candidate.company ? ' (' + candidate.company + ')' : ''}\nWhy asking: ${why_asking || 'considering for a senior role'}\nDraft the message body.`,
      max_tokens: 220,
      temperature: 0.6,
    });
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions({ ...ctx, trustLevel: 'manual' }, {
    decisionType: 'reply_draft',
    payload: { skill: 'back_channel', contact, candidate, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate },
    reason: `Back-channel inquiry drafted to ${contact.name} — held for review.`,
  });
  return { ok: true, held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: 'back_channel', contact, candidate, draft } } };
};

/**
 * Reference Synthesis — summarizes raw reference responses into a 5-line
 * brief (Strengths / Concerns / Verification needed / Recommendation).
 * Read-only and autopilot-safe.
 *
 * Input: { responses: Array<{ from, content }>, candidate: { first_name, last_name }, role: string }
 */
export const referenceSynthesis: SkillHandler = async (input, _ctx): Promise<SkillResult> => {
  const { responses = [], candidate, role } = input || {};
  if (!responses.length) return { ok: false, error: 'responses_required' };

  try {
    const data = await llmJSON({
      system: `You synthesize raw reference responses into a hiring-manager brief. Output JSON: strengths (array, max 4 short bullets), concerns (array, max 3), verification_needed (array, max 3), confidential_off_record (array, max 2 — anything specifically marked off-record), recommendation (one of "advance", "advance_with_caveats", "decline", "needs_more_data"), confidence (0-1), bottom_line (1 sentence). Quote exact phrases when they're punchy. Flag generic responses ("good guy") in concerns.`,
      user: `Candidate: ${candidate?.first_name || ''} ${candidate?.last_name || ''}\nRole: ${role || 'senior position'}\n\nResponses:\n${responses.map((r: any, i: number) => `--- ${i + 1}. From ${r.from || 'reference'} ---\n${r.content || ''}`).join('\n\n')}`,
      max_tokens: 700,
    });
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'reference_synthesis_failed' };
  }
};
