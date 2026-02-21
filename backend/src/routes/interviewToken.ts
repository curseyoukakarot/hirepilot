import { Router } from 'express';

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

export default router;
