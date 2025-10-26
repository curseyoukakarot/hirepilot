import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import sg from '@sendgrid/mail';
import { rexSlackSetupEmail } from '../../emails/rexSlackSetupEmail';
import axios from 'axios';

export default async function slackToggle(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { userId, enabled } = req.body as { userId?: string; enabled?: boolean };
  if (!userId || enabled === undefined) return res.status(400).json({ error: 'Missing params' });

  const { error } = await supabase
    .from('users')
    .update({ rex_slack_enabled: enabled })
    .eq('id', userId);
  if (error) return res.status(500).json({ error: error.message });
  // Send onboarding instructions only on first enable
  if (enabled) {
    try {
      const { data: u } = await supabase.from('users').select('first_name, email, rex_slack_onboarded').eq('id', userId).maybeSingle();
      if (u && !u.rex_slack_onboarded) {
        // Email
        const email = u.email as string | undefined;
        if (email && process.env.SENDGRID_API_KEY) {
          try {
            sg.setApiKey(process.env.SENDGRID_API_KEY);
            const html = rexSlackSetupEmail(u.first_name || 'there', {
              commands: `${process.env.BACKEND_URL}/api/slack/commands`,
              interactivity: `${process.env.BACKEND_URL}/api/slack/interactivity`,
              events: `${process.env.BACKEND_URL}/api/slack/events`
            });
            await sg.send({ to: email, from: process.env.SENDGRID_FROM || 'support@thehirepilot.com', subject: 'Enable REX in your Slack workspace', html });
          } catch {}
        }
        // Slack DM via response_url fallback not available here; try posting to user's saved channel if any
        try {
          const { data: s } = await supabase.from('slack_accounts').select('access_token, channel_name').eq('user_id', userId).maybeSingle();
          if (s?.access_token && s?.channel_name) {
            await axios.post('https://slack.com/api/chat.postMessage', {
              channel: s.channel_name,
              text: 'REX Slack setup: Open https://api.slack.com/apps → create app → add /rex, Interactivity, Events. Check your email for full instructions.'
            }, { headers: { Authorization: `Bearer ${s.access_token}` } });
          }
        } catch {}
        // Mark onboarded so we only send once
        await supabase.from('users').update({ rex_slack_onboarded: true }).eq('id', userId);
      }
    } catch {}
  }
  return res.json({ success: true, enabled });
} 