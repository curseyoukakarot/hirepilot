import express from 'express';
import { sendToSlack, getMessages, extractSessionId, storeTeamReply } from './slackService';

const router = express.Router();

// Send user message to Slack and store
router.post('/sendToSlack', async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, message, sessionId } = req.body || {};
    if (!sessionId || !message) {
      res.status(400).json({ error: 'Missing sessionId or message' });
      return;
    }
    await sendToSlack(name || 'Anonymous', email || '', message, sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get all messages for session (for polling)
router.get('/getMessages', async (req: express.Request, res: express.Response) => {
  try {
    const { sessionId } = req.query || {};
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }
    const messages = await getMessages(sessionId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Slack events webhook for team responses
router.post('/slack/events', async (req: express.Request, res: express.Response) => {
  const payload = req.body as any;
  if (payload?.type === 'url_verification') {
    res.json({ challenge: payload.challenge });
    return;
  }
  try {
    const event = payload?.event;
    if (event && event.type === 'message' && !event.subtype && typeof event.text === 'string') {
      const text: string = event.text;
      const sessionId = extractSessionId(text);
      if (sessionId) {
        const replyText = text.replace(/\[session:\s*[0-9a-f-]{36}\]/i, '').trim();
        await storeTeamReply(sessionId, replyText);
      }
    }
  } catch (err) {
    console.error('Slack events error:', err);
  }
  res.json({ ok: true });
});

export default router;


