import { Router } from 'express';
import { z } from 'zod';
import { openai } from '../ai/openaiClient';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { isModelAvailabilityError, pickModel } from '../lib/modelFallback';

const router = Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const REALTIME_MODEL = process.env.INTERVIEW_REALTIME_MODEL || 'gpt-4o-realtime-preview';
const REALTIME_VOICE = process.env.INTERVIEW_REALTIME_VOICE || 'alloy';
const REALTIME_INSTRUCTIONS =
  process.env.INTERVIEW_REALTIME_INSTRUCTIONS ||
  [
    'You are REX, an interview coach for job seekers.',
    'Ask one interview question at a time.',
    'After each user answer, provide concise coaching and ask one follow-up.',
    'Keep responses clear, professional, and encouraging.',
  ].join(' ');
const COACH_MODEL = process.env.INTERVIEW_COACH_MODEL || 'gpt-5.2';
const COACH_MODEL_FALLBACKS = ['gpt-5.2', 'gpt-5', 'gpt-4o', 'gpt-4o-mini'];
const REALTIME_MODEL_FALLBACKS = ['gpt-5.2-realtime-preview', 'gpt-4o-realtime-preview'];
const SESSION_IDEMPOTENCY_TTL_MS = 2 * 60 * 1000;

const sessionCreateSchema = z.object({
  role_title: z.string().min(1),
  company: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  mode: z.enum(['supportive', 'strict']).default('supportive'),
  prep_pack_id: z.string().uuid().nullable().optional(),
  rex_context_instructions: z.string().max(4000).nullable().optional(),
});
const sessionUpdateSchema = z
  .object({
    role_title: z.string().min(1).max(160).optional(),
  })
  .refine((value) => typeof value.role_title === 'string', { message: 'No updatable fields provided' });

const turnUpsertSchema = z.object({
  turn_index: z.number().int().min(1),
  speaker: z.enum(['rex', 'user']),
  question_text: z.string().nullable().optional(),
  answer_text: z.string().nullable().optional(),
  coaching: z.record(z.any()).nullable().optional(),
});

const coachRequestSchema = z.object({
  role_title: z.string().default('Interview Candidate'),
  company: z.string().default('Target Company'),
  level: z.string().default('mid'),
  mode: z.enum(['supportive', 'strict']).default('supportive'),
  question: z.string().min(1),
  answer: z.string().min(1),
});

const coachResponseSchema = z.object({
  strength: z.object({
    title: z.string(),
    detail: z.string(),
  }),
  opportunity: z.object({
    title: z.string(),
    detail: z.string(),
  }),
  improved_version: z.object({
    answer: z.string(),
    bullets: z.array(z.string()).min(2).max(4),
  }),
  tags: z.array(z.string()).min(3).max(5),
  score: z.object({
    clarity: z.number().int().min(1).max(5),
    structure: z.number().int().min(1).max(5),
    specificity: z.number().int().min(1).max(5),
    relevance: z.number().int().min(1).max(5),
    confidence: z.number().int().min(1).max(5),
  }),
  evidence_quotes: z.array(z.string()).min(1).max(3),
});

function buildCoachPrompt(input: z.infer<typeof coachRequestSchema>) {
  return `You are generating structured interview coaching for a UI. Return VALID JSON ONLY that matches the schema below. No markdown. No extra keys.

Context:
Role: ${input.role_title}
Company: ${input.company}
Level: ${input.level}
Mode: ${input.mode}
Question: ${input.question}
Answer: ${input.answer}

Return JSON exactly:

{
  "strength": { "title": "...", "detail": "..." },
  "opportunity": { "title": "...", "detail": "..." },
  "improved_version": {
    "answer": "...",
    "bullets": ["...", "..."]
  },
  "tags": ["..."],
  "score": {
    "clarity": 1-5,
    "structure": 1-5,
    "specificity": 1-5,
    "relevance": 1-5,
    "confidence": 1-5
  },
  "evidence_quotes": ["..."]
}

Rules:
- strength.detail and opportunity.detail must be 1-2 sentences each.
- improved_version.answer must be a STAR rewrite (4-8 sentences) with specific outcomes/metrics placeholders if missing.
- bullets: 2-4 bullets with concrete upgrades (metrics, ownership, tradeoffs, impact).
- tags: 3-5 concise tags (e.g., "Stakeholder management", "Prioritization", "Metrics").
- evidence_quotes: 1-3 short direct quotes from the answer that justify your scoring (or best-effort if answer is vague).
- Use integers 1-5 for scores.
- If the answer is very short or unclear, score low and explain in opportunity.
Return JSON only.`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shouldDebugLog(req: any) {
  return req?.query?.debug === '1' || process.env.INTERVIEW_DEBUG === 'true';
}

function debugLog(req: any, message: string, extra: Record<string, unknown> = {}) {
  if (!shouldDebugLog(req)) return;
  console.info(`[interview.debug] ${message}`, extra);
}

function structuredLog(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      ...payload,
    })
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function isAdminRole(role: string) {
  const normalized = String(role || '').toLowerCase();
  return normalized.includes('admin');
}

async function getOwnedSession(userId: string, sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from('interview_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function modalSummaryFromPrep(prepPack: any) {
  const outOf10 = Number(prepPack?.overall_score?.out_of_10 || 0);
  const topStrength = String(prepPack?.strengths?.[0]?.title || '').trim() || 'Clear communication';
  const focusArea = String(prepPack?.focus_areas?.[0]?.title || '').trim() || 'Add specificity and metrics';
  return {
    scoreOutOf10: Number.isFinite(outOf10) ? Number(outOf10.toFixed(1)) : 0,
    topStrength,
    focusArea,
  };
}

function computePrepPack(turns: any[]) {
  const userTurns = turns.filter((turn) => turn.speaker === 'user');
  const coachPayloads = userTurns
    .map((turn) => turn.coaching)
    .filter((coaching) => coaching && typeof coaching === 'object');
  const scoreKeys = ['clarity', 'structure', 'specificity', 'relevance', 'confidence'] as const;
  const perDimensionScores = scoreKeys.reduce(
    (acc, key) => {
      const values = coachPayloads
        .map((payload) => Number(payload?.score?.[key]))
        .filter((value) => Number.isFinite(value))
        .map((value) => clamp(value, 1, 5));
      const dimensionAvg = avg(values);
      acc[key] = Number((dimensionAvg == null ? 1 : clamp(dimensionAvg, 1, 5)).toFixed(2));
      return acc;
    },
    {} as Record<(typeof scoreKeys)[number], number>
  );
  const totalAvg5 = Number(
    (
      scoreKeys.reduce((sum, key) => sum + perDimensionScores[key], 0) /
      scoreKeys.length
    ).toFixed(4)
  );
  const overall10 = Number(clamp(((totalAvg5 - 1) / 4) * 10, 0, 10).toFixed(1));

  const strengthMap = new Map<string, number>();
  const focusMap = new Map<string, number>();
  coachPayloads.forEach((payload) => {
    const strengthTitle = String(payload?.strength?.title || '').trim();
    if (strengthTitle) strengthMap.set(strengthTitle, (strengthMap.get(strengthTitle) || 0) + 1);
    const opportunityTitle = String(payload?.opportunity?.title || '').trim();
    if (opportunityTitle) focusMap.set(opportunityTitle, (focusMap.get(opportunityTitle) || 0) + 1);
    const tags = Array.isArray(payload?.tags) ? payload.tags : [];
    tags.forEach((tag: string) => {
      const normalized = String(tag || '').trim();
      if (!normalized) return;
      strengthMap.set(normalized, (strengthMap.get(normalized) || 0) + 0.5);
      focusMap.set(normalized, (focusMap.get(normalized) || 0) + 0.5);
    });
  });
  const strengths = [...strengthMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => ({ title: label }));
  const focusAreas = [...focusMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => ({ title: label }));

  const rankedAnswers = userTurns
    .map((turn) => {
      const score = turn?.coaching?.score || {};
      const sum = scoreKeys.reduce((s, key) => s + Number(score[key] || 0), 0);
      return {
        answer: turn.answer_text || '',
        improved: turn?.coaching?.improved_version?.answer || '',
        score_sum: sum,
        evidence_quotes: Array.isArray(turn?.coaching?.evidence_quotes)
          ? turn.coaching.evidence_quotes.slice(0, 2)
          : [],
      };
    })
    .filter((row) => row.answer)
    .sort((a, b) => b.score_sum - a.score_sum)
    .slice(0, 3);

  const practicePlan = [
    { day: 1, task: 'Rewrite one weak answer using STAR with quantified impact.' },
    { day: 2, task: 'Practice concise opening hooks for top 3 interview questions.' },
    { day: 3, task: 'Record and review one behavioral answer focused on ownership.' },
    { day: 4, task: 'Add one tradeoff decision example with clear outcome metrics.' },
    { day: 5, task: 'Simulate strict-mode follow-up questions and tighten responses.' },
    { day: 6, task: 'Refine confidence and clarity in delivery with timed responses.' },
    { day: 7, task: 'Run full mock session and compare scores vs previous run.' },
  ];

  const evidenceQuotes = coachPayloads
    .flatMap((payload) => (Array.isArray(payload?.evidence_quotes) ? payload.evidence_quotes : []))
    .map((quote) => String(quote || '').trim())
    .filter(Boolean)
    .slice(0, 2);
  const evidenceFailures = coachPayloads.filter(
    (payload) => !Array.isArray(payload?.evidence_quotes) || payload.evidence_quotes.length === 0
  ).length;

  return {
    overall_score: {
      out_of_10: overall10,
      dimensions: perDimensionScores,
      total_avg_5: Number(totalAvg5.toFixed(2)),
      evidence_quotes: evidenceQuotes,
    },
    strengths,
    focus_areas: focusAreas,
    best_answers: rankedAnswers,
    practice_plan: practicePlan,
    modalSummary: {
      scoreOutOf10: overall10,
      topStrength: strengths[0]?.title || 'Clear communication',
      focusArea: focusAreas[0]?.title || 'Add specificity and metrics',
    },
    evidence_extract_status: {
      count: evidenceQuotes.length,
      failures: evidenceFailures,
    },
  };
}

router.post('/token', requireAuthUnified as any, async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const requestedSessionId = String(req.query.session_id || '').trim();
    let additionalContext = '';
    let sessionRoleTitle = '';
    let sessionCompany = '';
    if (requestedSessionId && isUuid(requestedSessionId)) {
      const userId = String((req as any)?.user?.id || '');
      if (userId) {
        const ownedSession = await getOwnedSession(userId, requestedSessionId);
        additionalContext = String(ownedSession?.metadata?.rex_context_instructions || '').trim();
        sessionRoleTitle = String(ownedSession?.role_title || '').trim();
        sessionCompany = String(ownedSession?.company || '').trim();
      }
    }
    const sessionContextPrefix = sessionRoleTitle
      ? `Interview target role: ${sessionRoleTitle}${sessionCompany ? ` at ${sessionCompany}` : ''}.`
      : '';
    const effectiveInstructions = [
      REALTIME_INSTRUCTIONS,
      sessionContextPrefix,
      additionalContext ? `Additional interview context from the user: ${additionalContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const modelCandidates = pickModel(REALTIME_MODEL, REALTIME_MODEL_FALLBACKS);
    let response: any = null;
    let payload: any = null;
    let selectedModel: string | null = null;
    for (const model of modelCandidates) {
      response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          voice: REALTIME_VOICE,
          instructions: effectiveInstructions,
          modalities: ['audio', 'text'],
          input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
          turn_detection: { type: 'server_vad' },
        }),
      });
      payload = await response.json().catch(() => ({} as any));
      if (response.ok) {
        selectedModel = model;
        if (model !== REALTIME_MODEL) {
          structuredLog('interview_model_fallback', {
            primary_model: REALTIME_MODEL,
            fallback_model: model,
            reason: 'model_unavailable',
            session_id: requestedSessionId || null,
            user_id: String((req as any)?.user?.id || ''),
          });
        }
        break;
      }
      if (!isModelAvailabilityError(payload, response.status)) {
        return res.status(response.status).json({
          error: 'Failed to create realtime session',
          detail: payload?.error?.message || 'Unknown realtime token error',
        });
      }
    }
    if (!response?.ok || !selectedModel) {
      return res.status(502).json({
        error: 'Failed to create realtime session',
        detail: 'No supported realtime model available',
      });
    }
    debugLog(req, 'realtime model selected', { model: selectedModel });

    const token = payload?.client_secret?.value;
    const expiresAt =
      payload?.client_secret?.expires_at != null
        ? new Date(Number(payload.client_secret.expires_at) * 1000).toISOString()
        : null;
    if (!token) {
      return res.status(500).json({ error: 'Realtime token missing from provider response' });
    }

    return res.json({
      token,
      expires_at: expiresAt,
      model: payload?.model || selectedModel,
      voice: payload?.voice || REALTIME_VOICE,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to create interview token', detail: e?.message });
  }
});

router.post('/sessions', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = sessionCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid session payload', detail: parsed.error.flatten() });
    }
    const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
    if (idempotencyKey) {
      const cutoff = new Date(Date.now() - SESSION_IDEMPOTENCY_TTL_MS).toISOString();
      const { data: existing } = await supabaseAdmin
        .from('interview_helper_idempotency')
        .select('session_id, created_at')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.session_id) {
        return res.json({ sessionId: existing.session_id, reused: true });
      }
    }

    let prepPackId: string | null = parsed.data.prep_pack_id || null;
    if (prepPackId) {
      const { data: prepPack } = await supabaseAdmin
        .from('interview_prep_packs')
        .select('id, session_id')
        .eq('id', prepPackId)
        .single();
      const sourceSessionId = String((prepPack as any)?.session_id || '');
      const { data: sourceSession } = sourceSessionId
        ? await supabaseAdmin.from('interview_sessions').select('user_id').eq('id', sourceSessionId).maybeSingle()
        : { data: null as any };
      const ownerId = String((sourceSession as any)?.user_id || '');
      if (!prepPack || !sourceSession || ownerId !== userId) {
        prepPackId = null;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .insert({
        user_id: userId,
        role_title: parsed.data.role_title,
        company: parsed.data.company || null,
        level: parsed.data.level || null,
        mode: parsed.data.mode,
        status: 'in_progress',
        prep_pack_id: prepPackId,
        metadata: parsed.data.rex_context_instructions
          ? { rex_context_instructions: parsed.data.rex_context_instructions }
          : {},
      })
      .select('id')
      .single();
    if (error || !data?.id) {
      return res.status(500).json({ error: 'Failed to create session', detail: error?.message });
    }
    if (idempotencyKey) {
      await supabaseAdmin.from('interview_helper_idempotency').upsert(
        {
          user_id: userId,
          idempotency_key: idempotencyKey,
          session_id: data.id,
        },
        { onConflict: 'user_id,idempotency_key' }
      );
    }
    structuredLog('interview_session_created', { session_id: data.id, user_id: userId });
    return res.json({ sessionId: data.id });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to create session', detail: e?.message });
  }
});

router.get('/sessions', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to list sessions', detail: error.message });
    const sessionIds = (data || []).map((session) => session.id);
    let scoresBySession: Record<string, number> = {};
    if (sessionIds.length) {
      const { data: packs } = await supabaseAdmin
        .from('interview_prep_packs')
        .select('session_id, overall_score')
        .in('session_id', sessionIds);
      scoresBySession = (packs || []).reduce((acc: Record<string, number>, row: any) => {
        const outOf10 = Number(row?.overall_score?.out_of_10);
        if (Number.isFinite(outOf10)) acc[String(row.session_id)] = outOf10;
        return acc;
      }, {});
    }
    return res.json({
      sessions: (data || []).map((session) => ({
        ...session,
        score_out_of_10: scoresBySession[session.id] ?? null,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to list sessions', detail: e?.message });
  }
});

router.get('/sessions/:id', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    const sessionId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isUuid(sessionId)) {
      structuredLog('session_load_failed', { session_id: sessionId, reason: 'invalid_uuid' });
      return res.status(400).json({ error: 'Invalid session id' });
    }
    const session = await getOwnedSession(userId, sessionId);
    if (!session) {
      structuredLog('session_load_failed', { session_id: sessionId, reason: 'not_found_or_forbidden' });
      return res.status(404).json({ error: 'Session not found' });
    }
    const { data: turns, error: turnsError } = await supabaseAdmin
      .from('interview_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (turnsError) {
      return res.status(500).json({ error: 'Failed to load turns', detail: turnsError.message });
    }
    return res.json({ session, turns: turns || [] });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to load session', detail: e?.message });
  }
});

router.patch('/sessions/:id', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    const sessionId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isUuid(sessionId)) return res.status(400).json({ error: 'Invalid session id' });
    const session = await getOwnedSession(userId, sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const parsed = sessionUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid session payload', detail: parsed.error.flatten() });
    }
    const nextRoleTitle = String(parsed.data.role_title || '').trim();
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .update({ role_title: nextRoleTitle })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: 'Failed to update session', detail: error.message });
    return res.json({ session: data });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to update session', detail: e?.message });
  }
});

router.delete('/sessions/:id', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    const sessionId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isUuid(sessionId)) return res.status(400).json({ error: 'Invalid session id' });
    const session = await getOwnedSession(userId, sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { error } = await supabaseAdmin
      .from('interview_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: 'Failed to delete session', detail: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to delete session', detail: e?.message });
  }
});

router.post('/sessions/:id/turns', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    const sessionId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isUuid(sessionId)) return res.status(400).json({ error: 'Invalid session id' });
    const session = await getOwnedSession(userId, sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const parsed = turnUpsertSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid turn payload', detail: parsed.error.flatten() });
    }
    const payload = parsed.data;
    const { data, error } = await supabaseAdmin
      .from('interview_turns')
      .upsert(
        {
          session_id: sessionId,
          turn_index: payload.turn_index,
          speaker: payload.speaker,
          question_text: payload.question_text || null,
          answer_text: payload.answer_text || null,
          coaching: payload.coaching || null,
        },
        { onConflict: 'session_id,turn_index,speaker' }
      )
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: 'Failed to persist turn', detail: error.message });
    return res.json({ turn: data });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to persist turn', detail: e?.message });
  }
});

router.post('/sessions/:id/finalize', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    const role = String((req as any)?.user?.role || '');
    const sessionId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isUuid(sessionId)) return res.status(400).json({ error: 'Invalid session id' });
    const session = await getOwnedSession(userId, sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const overwriteRequested = req.query.allow_overwrite === '1' || req.body?.allow_overwrite === true;
    const allowOverwrite = overwriteRequested && isAdminRole(role);
    if (overwriteRequested && !allowOverwrite) {
      structuredLog('scoring_write_attempt', {
        session_id: sessionId,
        prior_score_state: session.status === 'completed' ? 'finalized' : 'none',
        new_score_state: 'recompute_rejected_non_admin',
        allowed: false,
      });
      return res.status(403).json({ error: 'Only admin users can overwrite finalized scores' });
    }

    const { data: existingPrep } = await supabaseAdmin
      .from('interview_prep_packs')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (existingPrep && !allowOverwrite) {
      structuredLog('scoring_write_attempt', {
        session_id: sessionId,
        prior_score_state: 'finalized',
        new_score_state: 'recompute_blocked',
        allowed: false,
      });
      return res.json({
        prepPackId: existingPrep.id,
        modalSummary: modalSummaryFromPrep(existingPrep),
      });
    }

    const { data: turns, error: turnsError } = await supabaseAdmin
      .from('interview_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: true });
    if (turnsError) return res.status(500).json({ error: 'Failed to load turns', detail: turnsError.message });
    const pack = computePrepPack(turns || []);
    structuredLog('evidence_extract_status', {
      session_id: sessionId,
      count: pack.evidence_extract_status.count,
      failures: pack.evidence_extract_status.failures,
    });
    let prepPack: { id: string } | null = null;
    let prepError: any = null;
    if (existingPrep && allowOverwrite) {
      await supabaseAdmin.from('interview_prep_packs').delete().eq('id', existingPrep.id);
      const recreateResult = await supabaseAdmin
        .from('interview_prep_packs')
        .insert({
          id: existingPrep.id,
          session_id: sessionId,
          overall_score: pack.overall_score,
          strengths: pack.strengths,
          focus_areas: pack.focus_areas,
          best_answers: pack.best_answers,
          practice_plan: pack.practice_plan,
        })
        .select('id')
        .single();
      prepPack = recreateResult.data;
      prepError = recreateResult.error;
    } else {
      const insertResult = await supabaseAdmin
        .from('interview_prep_packs')
        .insert({
          session_id: sessionId,
          overall_score: pack.overall_score,
          strengths: pack.strengths,
          focus_areas: pack.focus_areas,
          best_answers: pack.best_answers,
          practice_plan: pack.practice_plan,
        })
        .select('id')
        .single();
      prepPack = insertResult.data;
      prepError = insertResult.error;
    }
    if (prepError || !prepPack?.id) {
      return res.status(500).json({ error: 'Failed to persist prep pack', detail: prepError?.message });
    }
    structuredLog('scoring_write_attempt', {
      session_id: sessionId,
      prior_score_state: existingPrep ? 'finalized' : 'none',
      new_score_state: 'finalized',
      allowed: true,
    });
    if (session.status !== 'completed') {
      const { error: updateError } = await supabaseAdmin
        .from('interview_sessions')
        .update({ status: 'completed', ended_at: new Date().toISOString(), prep_pack_id: prepPack.id })
        .eq('id', sessionId)
        .eq('user_id', userId);
      if (updateError) {
        return res.status(500).json({ error: 'Failed to finalize session', detail: updateError.message });
      }
    }
    return res.json({
      prepPackId: prepPack.id,
      modalSummary: pack.modalSummary,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Finalize failed', detail: e?.message });
  }
});

router.get('/prep/:id', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    const prepPackId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isUuid(prepPackId)) return res.status(400).json({ error: 'Invalid prep pack id' });
    const { data, error } = await supabaseAdmin
      .from('interview_prep_packs')
      .select('*, interview_sessions(*)')
      .eq('id', prepPackId)
      .single();
    if (error || !data) {
      return res.status(404).json({ error: 'Prep pack not found' });
    }
    const session = (data as any).interview_sessions;
    if (!session || String(session.user_id) !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({
      prepPack: data,
      session,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to load prep pack', detail: e?.message });
  }
});

router.post('/:sessionId/coach', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const sessionId = String(req.params.sessionId || '');
    if (!isUuid(sessionId)) return res.status(400).json({ error: 'Invalid session id' });
    const session = await getOwnedSession(userId, sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }
    const parsed = coachRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid coaching payload', detail: parsed.error.flatten() });
    }

    const prompt = buildCoachPrompt(parsed.data);
    const coachModelCandidates = pickModel(COACH_MODEL, COACH_MODEL_FALLBACKS);
    let completion: any = null;
    let selectedCoachModel = '';
    for (const candidate of coachModelCandidates) {
      try {
        completion = await openai.chat.completions.create({
          model: candidate,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Return only valid JSON. No markdown or prose. No keys outside the required schema.',
            },
            { role: 'user', content: prompt },
          ],
        });
        selectedCoachModel = candidate;
        if (candidate !== COACH_MODEL) {
          structuredLog('interview_model_fallback', {
            primary_model: COACH_MODEL,
            fallback_model: candidate,
            reason: 'model_unavailable',
            session_id: sessionId,
            user_id: userId,
          });
        }
        break;
      } catch (modelErr: any) {
        if (!isModelAvailabilityError(modelErr)) throw modelErr;
      }
    }
    if (!completion || !selectedCoachModel) {
      return res.status(502).json({ error: 'No supported coaching model available' });
    }
    debugLog(req, 'coach model selected', { model: selectedCoachModel });

    let content = completion.choices?.[0]?.message?.content || '{}';
    let raw: any = null;
    try {
      raw = JSON.parse(content);
    } catch {
      const retry = await openai.chat.completions.create({
        model: selectedCoachModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Your last output was invalid. Return only strict JSON matching requested schema.',
          },
          { role: 'user', content: prompt },
        ],
      });
      content = retry.choices?.[0]?.message?.content || '{}';
      raw = JSON.parse(content);
    }

    const normalized = coachResponseSchema.safeParse(raw);
    if (!normalized.success) {
      return res.status(502).json({
        error: 'Invalid coach JSON from model',
        detail: normalized.error.flatten(),
      });
    }

    return res.json({
      session_id: req.params.sessionId,
      coaching: normalized.data,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Coach generation failed', detail: e?.message });
  }
});

export default router;
