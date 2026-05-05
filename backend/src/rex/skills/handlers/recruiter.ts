/**
 * Recruiter skill handlers.
 *
 * Recruiter Skills DO send messages and submittals, so guardrails matter
 * here more than for Sourcer. Reply Handler especially: comp answers,
 * negotiation back-and-forth, and anything off-script gets held.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';

const stub = (name: string, decisionType: 'reply_draft' | 'submittal_send' | 'pipeline_move' | 'custom' = 'custom'): SkillHandler =>
  async (input, ctx): Promise<SkillResult> => {
    const guard = await guardActions(ctx, {
      decisionType,
      score: input?.score,
      spendCents: input?.spendCents,
      payload: { skill: name, input },
      context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, lead: input?.lead },
      reason: `${name} not yet wired — surfaced for human review.`,
    });
    if (guard.decision === 'hold') {
      return { ok: true, held: { decisionType, reason: guard.reason, payload: { skill: name, input } } };
    }
    return { ok: true, data: { stub: true, skill: name, input } };
  };

const SENSITIVE_PATTERNS = [
  /\b(comp|salary|equity|signing|relocation|bonus|offer)\b/i,
  /\$\d/,
  /\b(decline|reject|pass|withdraw)\b/i,
];

/**
 * Reply Handler — drafts a response to an incoming reply, ALWAYS held when
 * the original message contains sensitive topics (comp, decline, etc.) even
 * under autopilot. Otherwise routes through normal guardrails.
 *
 * Input: { lead: { id, first_name, last_name, ... }, original_text, draft_text, score? }
 */
export const replyHandler: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { lead, original_text = '', draft_text = '', score } = input || {};
  const sensitive = SENSITIVE_PATTERNS.some((rx) => rx.test(original_text));

  // Force-hold sensitive replies regardless of trust level.
  if (sensitive) {
    const proposed = {
      decisionType: 'reply_draft' as const,
      score,
      payload: { skill: 'reply_handler', lead, original_text, draft_text, sensitive_topic: true },
      context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, lead },
      reason: 'Original message references comp / negotiation / decline — held for human review.',
    };
    const guard = await guardActions(
      { ...ctx, trustLevel: 'manual' }, // force-manual for sensitive topics
      proposed,
    );
    return {
      ok: true,
      held: { decisionType: 'reply_draft', reason: guard.reason, payload: proposed.payload },
    };
  }

  // Otherwise apply normal trust-ladder guardrails.
  const guard = await guardActions(ctx, {
    decisionType: 'reply_draft',
    score,
    payload: { skill: 'reply_handler', lead, original_text, draft_text },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, lead },
    reason: `Reply draft ready (score ${score ?? 'n/a'}).`,
  });

  if (guard.decision === 'hold') {
    return {
      ok: true,
      held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: 'reply_handler', lead, original_text, draft_text } },
    };
  }
  // Real send is handled by REX legacy send_email tool — this handler returns
  // the approved draft for the caller to actually send.
  return { ok: true, data: { approved: true, lead, draft_text } };
};

/**
 * Pipeline Manager — moves a candidate to a new stage.
 * Autopilot-safe for "advancing" moves above the score threshold; "negative"
 * moves (rejection, dropped) always hold for review.
 *
 * Input: { candidate_id, target_stage_id, kind?: 'advance' | 'reject' | 'drop', score? }
 */
export const pipelineManager: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate_id, target_stage_id, kind = 'advance', score } = input || {};
  if (!candidate_id || !target_stage_id) {
    return { ok: false, error: 'candidate_id_and_target_stage_required' };
  }

  // Force-hold negative moves regardless of trust level.
  const isNegative = kind === 'reject' || kind === 'drop';
  const guardCtx = isNegative ? { ...ctx, trustLevel: 'manual' as const } : ctx;

  const guard = await guardActions(guardCtx, {
    decisionType: 'pipeline_move',
    score,
    payload: { skill: 'pipeline_manager', candidate_id, target_stage_id, kind },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate_id },
    reason: isNegative
      ? `Negative pipeline move (${kind}) — held for human review.`
      : `Move candidate to stage ${target_stage_id}.`,
  });

  if (guard.decision === 'hold') {
    return {
      ok: true,
      held: { decisionType: 'pipeline_move', reason: guard.reason, payload: { skill: 'pipeline_manager', candidate_id, target_stage_id, kind } },
    };
  }

  try {
    // moveCandidate takes { userId, candidateId, newStage } where newStage
    // is a stage title (text). Pipeline_manager input is named target_stage_id
    // for clarity but accepts either an id-resolved title or the title itself.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { moveCandidate } = require('../../../../tools/rexToolFunctions');
    const result = await moveCandidate({
      userId: ctx.userId,
      candidateId: candidate_id,
      newStage: target_stage_id,
    });
    return { ok: true, data: result };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'pipeline_manager_failed' };
  }
};

/**
 * Outreach Writer — generates a personalized first-touch outreach.
 * Always held for review unless trust=autopilot AND score is high.
 *
 * Input: { lead: {first_name, last_name, title, company, ...}, jobTitle?, customNote? }
 */
export const outreachWriter: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { lead, jobTitle, customNote, score } = input || {};
  if (!lead || (!lead.first_name && !lead.email)) {
    return { ok: false, error: 'lead_required' };
  }

  // Draft the message via OpenAI (using the same OPENAI_API_KEY the rest of REX uses)
  let draft = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const openaiMod = require('openai');
    const OpenAI = openaiMod.default || openaiMod.OpenAI || openaiMod;
    const openai = new (OpenAI as any)({ apiKey: process.env.OPENAI_API_KEY });
    const sys = `You are a recruiter drafting first-touch outreach. 2–4 short sentences. Conversational, specific, and ends with a single soft ask. Never use the word "synergy" or "leverage" or "ecosystem".`;
    const user = `Lead: ${lead.first_name || ''} ${lead.last_name || ''} (${lead.title || ''} at ${lead.company || ''})\nJob: ${jobTitle || 'an opportunity'}\n${customNote ? 'Recruiter note: ' + customNote + '\n' : ''}Draft the outreach. Just the message body — no subject line, no signature.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      max_tokens: 220,
      temperature: 0.7,
    });
    draft = completion.choices?.[0]?.message?.content?.trim() || '';
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  const guard = await guardActions(ctx, {
    decisionType: 'reply_draft',
    score,
    payload: { skill: 'outreach_writer', lead, jobTitle, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, lead },
    reason: `Outreach drafted for ${lead.first_name || lead.email}.`,
  });

  if (guard.decision === 'hold') {
    return {
      ok: true,
      held: { decisionType: 'reply_draft', reason: guard.reason, payload: { skill: 'outreach_writer', lead, jobTitle, draft } },
    };
  }
  // The actual send is handled by REX's existing send_email tool — this
  // handler just returns the approved draft so the caller can dispatch it.
  return { ok: true, data: { approved: true, lead, draft } };
};

/**
 * Submittal Drafter — generates a candidate writeup for a hiring manager.
 * ALWAYS held (hard-hold via decisionType='submittal_send' equivalent under
 * recruiter — but we use 'submittal_send' explicitly so the UI tags it right).
 *
 * Input: { candidate: {...}, job: {title, description?}, highlights?: string[] }
 */
export const submittalDrafter: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { candidate, job, highlights } = input || {};
  if (!candidate || !job) return { ok: false, error: 'candidate_and_job_required' };

  let draft = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const openaiMod = require('openai');
    const OpenAI = openaiMod.default || openaiMod.OpenAI || openaiMod;
    const openai = new (OpenAI as any)({ apiKey: process.env.OPENAI_API_KEY });
    const sys = `You are a recruiter writing a submittal — the email a hiring manager actually wants to read. Structure: 1 sentence on who they are, 3 bullets of strongest evidence, 1 sentence on what to do next. Never claim "perfect fit" or "exactly what you need". Be honest about gaps.`;
    const user = `Candidate: ${candidate.first_name || ''} ${candidate.last_name || ''} (${candidate.title || ''} at ${candidate.company || ''})\nJob: ${job.title}\n${highlights?.length ? 'Recruiter highlights:\n- ' + highlights.join('\n- ') + '\n' : ''}${job.description ? 'Job description (excerpt): ' + String(job.description).slice(0, 600) + '\n' : ''}Draft the submittal email body.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      max_tokens: 380,
      temperature: 0.5,
    });
    draft = completion.choices?.[0]?.message?.content?.trim() || '';
  } catch (e: any) {
    return { ok: false, error: `openai_draft_failed: ${e?.message || e}` };
  }

  // Submittals are commercial — always hold for review.
  const guard = await guardActions({ ...ctx, trustLevel: 'manual' }, {
    decisionType: 'submittal_send',
    payload: { skill: 'submittal_drafter', candidate, job, draft },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, candidate, job },
    reason: 'Submittal drafted — held for review (submittals are always reviewed before sending).',
  });
  return {
    ok: true,
    held: { decisionType: 'submittal_send', reason: guard.reason, payload: { skill: 'submittal_drafter', candidate, job, draft } },
  };
};
