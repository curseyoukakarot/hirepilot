import { Router } from 'express';
import { z } from 'zod';
import { openai } from '../ai/openaiClient';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabaseAdmin } from '../lib/supabaseAdmin';

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
const COACH_MODEL = process.env.INTERVIEW_COACH_MODEL || 'gpt-4o-mini';

const sessionCreateSchema = z.object({
  role_title: z.string().min(1),
  company: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  mode: z.enum(['supportive', 'strict']).default('supportive'),
});

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

function computePrepPack(turns: any[]) {
  const userTurns = turns.filter((turn) => turn.speaker === 'user');
  const coachPayloads = userTurns
    .map((turn) => turn.coaching)
    .filter((coaching) => coaching && typeof coaching === 'object');
  const scoreKeys = ['clarity', 'structure', 'specificity', 'relevance', 'confidence'] as const;
  const scoreTotals: Record<(typeof scoreKeys)[number], number> = {
    clarity: 0,
    structure: 0,
    specificity: 0,
    relevance: 0,
    confidence: 0,
  };
  let scoredCount = 0;
  coachPayloads.forEach((payload) => {
    if (!payload?.score) return;
    scoredCount += 1;
    scoreKeys.forEach((key) => {
      scoreTotals[key] += Number(payload.score?.[key] || 0);
    });
  });
  const averagedScore = scoreKeys.reduce(
    (acc, key) => {
      acc[key] = scoredCount ? Number((scoreTotals[key] / scoredCount).toFixed(2)) : 0;
      return acc;
    },
    {} as Record<(typeof scoreKeys)[number], number>
  );
  const overall5 = scoreKeys.reduce((sum, key) => sum + averagedScore[key], 0) / scoreKeys.length || 0;
  const overall10 = Number((overall5 * 2).toFixed(1));

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

  return {
    overall_score: {
      out_of_10: overall10,
      dimensions: averagedScore,
    },
    strengths,
    focus_areas: focusAreas,
    best_answers: rankedAnswers,
    practice_plan: practicePlan,
    modalSummary: {
      scoreOutOf10: overall10,
      topStrength: strengths[0]?.title || 'Structured thinking',
      focusArea: focusAreas[0]?.title || 'Answer specificity',
    },
  };
}

router.post('/token', requireAuthUnified as any, async (_req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
        instructions: REALTIME_INSTRUCTIONS,
        modalities: ['audio', 'text'],
        input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
        turn_detection: { type: 'server_vad' },
      }),
    });

    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to create realtime session',
        detail: payload?.error?.message || 'Unknown realtime token error',
      });
    }
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
      model: payload?.model || REALTIME_MODEL,
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
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .insert({
        user_id: userId,
        role_title: parsed.data.role_title,
        company: parsed.data.company || null,
        level: parsed.data.level || null,
        mode: parsed.data.mode,
        status: 'in_progress',
      })
      .select('id')
      .single();
    if (error || !data?.id) {
      return res.status(500).json({ error: 'Failed to create session', detail: error?.message });
    }
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
    return res.json({ sessions: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to list sessions', detail: e?.message });
  }
});

router.get('/sessions/:id', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    const sessionId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const session = await getOwnedSession(userId, sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
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

router.post('/sessions/:id/turns', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = String((req as any)?.user?.id || '');
    const sessionId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
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
    const sessionId = String(req.params.id || '');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const session = await getOwnedSession(userId, sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { data: turns, error: turnsError } = await supabaseAdmin
      .from('interview_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: true });
    if (turnsError) return res.status(500).json({ error: 'Failed to load turns', detail: turnsError.message });
    const pack = computePrepPack(turns || []);
    const { data: prepPack, error: prepError } = await supabaseAdmin
      .from('interview_prep_packs')
      .upsert(
        {
          session_id: sessionId,
          overall_score: pack.overall_score,
          strengths: pack.strengths,
          focus_areas: pack.focus_areas,
          best_answers: pack.best_answers,
          practice_plan: pack.practice_plan,
        },
        { onConflict: 'session_id' }
      )
      .select('id')
      .single();
    if (prepError || !prepPack?.id) {
      return res.status(500).json({ error: 'Failed to persist prep pack', detail: prepError?.message });
    }
    const { error: updateError } = await supabaseAdmin
      .from('interview_sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);
    if (updateError) {
      return res.status(500).json({ error: 'Failed to finalize session', detail: updateError.message });
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
    const completion = await openai.chat.completions.create({
      model: COACH_MODEL,
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

    let content = completion.choices?.[0]?.message?.content || '{}';
    let raw: any = null;
    try {
      raw = JSON.parse(content);
    } catch {
      const retry = await openai.chat.completions.create({
        model: COACH_MODEL,
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
