import { Request, Response } from 'express';
import axios from 'axios';
import { postToSlack } from '../../lib/slackPoster';
import { supabase } from '../../lib/supabase';
import { resolveREXContext } from '../../lib/rexContext';
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function lookupEmailFromSlack(id: string): Promise<string | null> {
  try {
    const user = await slack.users.info({ user: id });
    // @ts-ignore slack types
    return user.user?.profile?.email || null;
  } catch {
    return null;
  }
}

// Slack sends x-www-form-urlencoded body for slash commands
export default async function slackSlash(req: Request, res: Response) {
  const { user_id: slack_user_id, text, channel_id } = req.body as any;
  // Immediate ack to Slack (must complete < 3s)
  res.json({ text: 'REX is thinking…' });

  try {
    const slack_user_email = await lookupEmailFromSlack(slack_user_id);

    // ---------------------------------------------
    // Handle linking command: /rex link me  or  /rex link email@domain
    // ---------------------------------------------
    if (/^link\b/i.test(text || '')) {
      const parts = text.trim().split(/\s+/);
      const explicitEmail = parts[1] && parts[1].toLowerCase() !== 'me' ? parts[1] : null;
      const candidateEmail = explicitEmail || slack_user_email;

      if (!candidateEmail) {
        await postToSlack(slack_user_id, '⚠️ Could not determine your email, please specify one like `/rex link you@company.com`', channel_id);
        return;
      }

      // Find supabase user by email
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .ilike('email', candidateEmail)
        .maybeSingle();

      if (!userRow?.id) {
        await postToSlack(slack_user_id, `❌ No HirePilot account found for ${candidateEmail}`, channel_id);
        return;
      }

      // Save mapping
      const { updateREXContext } = await import('../hooks/updateUserContext');
      await updateREXContext({
        supabase_user_id: userRow.id,
        slack_user_id,
        slack_user_email: candidateEmail
      });

      await postToSlack(slack_user_id, '✅ Slack account linked to your HirePilot profile!', channel_id);
      return;
    }

    const { user_id: supabaseUserId, campaign_id } = await resolveREXContext({
      slack_user_id,
      slack_user_email
    });

    // Call the existing rexChat endpoint so we benefit from MCP tool handling
    const backendBase = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;

    const { data: chatResp } = await axios.post(`${backendBase}/api/rex/chat`, {
      userId: supabaseUserId,
      campaignId: campaign_id,
      messages: [ { role: 'user', content: text || '' } ]
    });

    const replyText = chatResp.reply?.content?.trim() || '(no reply)';
    await postToSlack(slack_user_id, replyText, channel_id);
  } catch (err: any) {
    console.error('slash error', err);
    try {
      await postToSlack(slack_user_id, 'Sorry, something went wrong 🤖', channel_id);
    } catch {}
  }
} 