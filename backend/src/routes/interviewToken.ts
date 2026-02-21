import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

const tokenSecret =
  process.env.INTERVIEW_PROVIDER_SECRET ||
  process.env.AGENT_MCP_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

router.post('/token', async (_req, res) => {
  try {
    if (!tokenSecret) {
      return res.status(500).json({ error: 'Missing server token secret' });
    }

    const expiresInSeconds = 60 * 5;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const token = jwt.sign(
      {
        iss: 'hirepilot-interview',
        aud: 'interview-realtime',
        scope: 'interview:session',
      },
      tokenSecret,
      { expiresIn: expiresInSeconds }
    );

    return res.json({ token, expires_at: expiresAt });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to create interview token', detail: e?.message });
  }
});

export default router;
