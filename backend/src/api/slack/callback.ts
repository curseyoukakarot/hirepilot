import { Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../../lib/supabase';

export default async function slackCallback(req: Request, res: Response) {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state) return res.status(400).send('Missing params');

  try {
    const redirect = `${process.env.BACKEND_PUBLIC_URL}/api/slack/callback`;
    const resp = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        code: code as string,
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        redirect_uri: redirect,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (!resp.data.ok) {
      console.error('Slack OAuth error', resp.data);
      return res.status(400).send('Slack auth failed');
    }

    const { access_token, team, authed_user } = resp.data;
    const supabase_user_id = state as string;
    const slack_user_id = authed_user?.id as string | undefined;

    // Upsert/extend existing record keyed by Supabase user id and add slack_user_id column
    await supabase.from('slack_accounts').upsert({
      user_id: supabase_user_id,
      slack_user_id,
      access_token,
      team_name: team?.name ?? null,
    }, { onConflict: 'user_id' });

    await supabase
      .from('users')
      .update({ rex_slack_enabled: true })
      .eq('id', supabase_user_id);

    return res.send(`<script>window.close();</script>Connected to Slack, you can close this window.`);
  } catch (err) {
    console.error('Slack callback error', err);
    return res.status(500).send('Internal error');
  }
} 