import { Router } from 'express';
import { z } from 'zod';
import { openai } from '../ai/openaiClient';

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

router.post('/token', async (_req, res) => {
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

router.post('/:sessionId/coach', async (req, res) => {
  try {
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
