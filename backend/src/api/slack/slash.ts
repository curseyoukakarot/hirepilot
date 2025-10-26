import { Request, Response } from 'express';
import axios from 'axios';
import { postToSlack } from '../../lib/slackPoster';
import { supabase } from '../../lib/supabase';
import { resolveREXContext } from '../../lib/rexContext';
import { WebClient } from '@slack/web-api';

async function lookupEmailFromSlack(id: string): Promise<string | null> {
  try {
    // Prefer workspace-specific bot token tied to this Slack user
    let token: string | undefined = undefined;
    try {
      const { data } = await supabase
        .from('slack_accounts')
        .select('access_token')
        .eq('slack_user_id', id)
        .maybeSingle();
      token = (data as any)?.access_token;
    } catch {}
    const client = new WebClient(token || process.env.SLACK_BOT_TOKEN);
    const user = await client.users.info({ user: id });
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
  try {
    res.json({ text: 'REX is thinking…' });
  } catch {}

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
      // Persist mapping in slack_accounts, so posting can resolve by slack_user_id
      try {
        await supabase
          .from('slack_accounts')
          .update({ slack_user_id, slack_user_email: candidateEmail })
          .eq('user_id', userRow.id);
      } catch {}

      await postToSlack(slack_user_id, '✅ Slack account linked to your HirePilot profile!', channel_id);
      return;
    }

    let supabaseUserId: string | null = null;
    let campaign_id: string | null = null;
    try {
      const ctx = await resolveREXContext({ slack_user_id, slack_user_email });
      supabaseUserId = ctx.user_id;
      campaign_id = ctx.campaign_id;
    } catch (e) {
      // Fallback: map by email directly from users if available
      if (slack_user_email) {
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .ilike('email', slack_user_email)
          .maybeSingle();
        supabaseUserId = userRow?.id || null;
      }
    }
    if (!supabaseUserId) {
      await postToSlack(slack_user_id, 'I could not link your Slack to a HirePilot account. Try `/rex link you@company.com`.', channel_id);
      return;
    }
    // Ensure backend flag is enabled so REX responds for Slack users
    try {
      await supabase
        .from('users')
        .update({ rex_slack_enabled: true })
        .eq('id', supabaseUserId);
      await supabase
        .from('integrations')
        .upsert({ user_id: supabaseUserId, provider: 'rex', status: 'enabled', connected_at: new Date().toISOString() }, { onConflict: 'user_id,provider' });
    } catch {}

    // Call the existing rexChat endpoint so we benefit from MCP tool handling
    const backendBase = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;

    const { data: chatResp } = await axios.post(`${backendBase}/api/rex/chat`, {
      userId: supabaseUserId,
      campaignId: campaign_id,
      messages: [ { role: 'user', content: text || '' } ]
    });

    const replyText = (chatResp?.reply?.content || chatResp?.message || 'Understood.').toString().trim();
    await postToSlack(slack_user_id, replyText, channel_id);
  } catch (err: any) {
    console.error('slash error', err);
    try {
      await postToSlack(slack_user_id, 'Sorry, something went wrong 🤖', channel_id);
    } catch {}
  }
} 