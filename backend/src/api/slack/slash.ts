import { Request, Response } from 'express';
import axios from 'axios';
import { postToSlack } from '../../lib/slackPoster';
import { supabase } from '../../lib/supabase';

// Slack sends x-www-form-urlencoded body for slash commands
export default async function slackSlash(req: Request, res: Response) {
  const { user_id, text, channel_id } = req.body as any;
  // Immediate ack to Slack (must complete < 3s)
  res.json({ text: 'REX is thinking…' });

  try {
    // Map Slack user_id -> Supabase user_id
    const { data: acct } = await supabase
      .from('slack_accounts')
      .select('user_id')
      .eq('slack_user_id', user_id)
      .maybeSingle();

    const supabaseUserId = acct?.user_id || null;

    // Call the existing rexChat endpoint so we benefit from MCP tool handling
    const backendBase = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;

    const { data: chatResp } = await axios.post(`${backendBase}/api/rex/chat`, {
      userId: supabaseUserId,
      messages: [ { role: 'user', content: text || '' } ]
    });

    const replyText = chatResp.reply?.content?.trim() || '(no reply)';
    await postToSlack(user_id, replyText, channel_id);
  } catch (err: any) {
    console.error('slash error', err);
    try {
      await postToSlack(user_id, 'Sorry, something went wrong 🤖', channel_id);
    } catch {}
  }
} 