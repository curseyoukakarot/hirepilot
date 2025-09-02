import express from 'express';
import { sendToSlack, getMessages } from './slackService';
import { WebClient } from '@slack/web-api';
import { createClient } from '@supabase/supabase-js';

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

// Slack Events webhook is handled centrally in server.ts via /api/slack-events

export default router;

// Admin diagnostics endpoint to inspect messages for a session
router.get('/admin/chat-messages/:sessionId', async (req: express.Request, res: express.Response) => {
  try {
    const token = (req.headers['x-admin-token'] as string) || '';
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { sessionId } = req.params as { sessionId: string };
    if (!sessionId) {
      res.status(400).json({ error: 'missing sessionId' });
      return;
    }
    const messages = await getMessages(sessionId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Manual sync endpoint: scans recent Slack messages in the configured channel
// and stores any replies containing a [session: <uuid>] tag into Supabase.
router.post('/slack/sync', async (req: express.Request, res: express.Response) => {
  try {
    const adminToken = (req.headers['x-admin-token'] as string) || '';
    if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const slackToken = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_CHANNEL_ID;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if (!slackToken || !channel || !supabaseUrl || !supabaseKey) {
      res.status(400).json({ error: 'missing env' });
      return;
    }

    const slack = new WebClient(slackToken);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch recent messages (last 200)
    const hist = await slack.conversations.history({ channel, limit: 200 });
    const messages = (hist.messages || []) as Array<{ text?: string; thread_ts?: string; ts?: string; user?: string }>;

    let inserted = 0;
    for (const m of messages) {
      const text = String(m.text || '');
      const match = text.match(/\[session:\s*([0-9a-f-]{36})\]/i);
      if (!match) continue;
      const sessionId = match[1];
      const cleaned = text.replace(/\[session:\s*[0-9a-f-]{36}\]/i, '').trim();
      if (!cleaned) continue;
      // Check if we already have a similar message to avoid duplicates (best-effort)
      const { data: existing } = await supabase
        .from('live_chat_messages')
        .select('id')
        .eq('session_id', sessionId)
        .eq('sender', 'team')
        .eq('text', cleaned)
        .limit(1);
      if (existing && existing.length) continue;
      const { error } = await supabase.from('live_chat_messages').insert({
        session_id: sessionId,
        sender: 'team',
        text: cleaned
      });
      if (!error) inserted++;
    }

    res.json({ ok: true, inserted });
  } catch (err) {
    console.error('slack/sync error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});


