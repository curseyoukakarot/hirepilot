import express from 'express';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const GOOGLE_REDIRECT = process.env.GOOGLE_REDIRECT_URI!;

console.log('Debug - Google Redirect URI:', GOOGLE_REDIRECT);

const oauth2 = new google.auth.OAuth2({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: GOOGLE_REDIRECT,
});

interface GoogleToken {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  expires_in?: number;
  scope?: string;
  [key: string]: any;
}

// Step 1: Get Google Auth URL
router.get('/init', async (req, res) => {
  console.log('Debug - Environment variables:', {
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    BACKEND_URL: process.env.BACKEND_URL
  });
  
  const user_id = req.query.user_id as string;
  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' });
    return;
  }
  const url = oauth2.generateAuthUrl({
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'email',
      'profile'
    ],
    access_type: 'offline',
    prompt: 'consent',
    state: user_id,
  });
  console.log('Debug - Generated Google OAuth URL:', url);
  res.json({ url });
});

// Step 2: Callback
router.get('/callback', async (req, res) => {
  const { code, state: user_id } = req.query as { code: string; state: string };
  if (!code || !user_id) {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);
    const oauth2info = google.oauth2('v2');
    const { data } = await oauth2info.userinfo.get({ auth: oauth2 });

    // Get existing account to preserve refresh token if not present in new tokens
    const { data: existingAccount } = await supabase
      .from('google_accounts')
      .select('refresh_token')
      .eq('user_id', user_id)
      .single();

    // Calculate expires_at robustly
    let expires_at: Date;
    if (tokens.expiry_date) {
      expires_at = new Date(tokens.expiry_date);
    } else if ((tokens as GoogleToken).expires_in) {
      expires_at = new Date(Date.now() + (tokens as GoogleToken).expires_in! * 1000);
    } else {
      // Fallback to 1 hour if neither is present
      expires_at = new Date(Date.now() + 60 * 60 * 1000);
    }
    // Ensure expires_at is not in the past
    if (expires_at < new Date()) {
      expires_at = new Date(Date.now() + 60 * 60 * 1000);
    }

    // Always update all fields on upsert
    const upsertData = {
      user_id,
      email: data.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existingAccount?.refresh_token,
      expires_at: expires_at.toISOString(),
      scopes: tokens.scope?.split(' ') ?? [],
      status: 'connected',
      updated_at: new Date().toISOString(),
    };

    const { error, data: upserted } = await supabase
      .from('google_accounts')
      .upsert(upsertData, { onConflict: 'user_id', ignoreDuplicates: false });

    console.log('Google callback upsert:', {
      error,
      upserted,
      expires_at: expires_at.toISOString(),
      has_refresh_token: !!(tokens.refresh_token || existingAccount?.refresh_token),
      upsertData
    });

    res.redirect(`${process.env.APP_WEB_URL}/settings/integrations?google=success`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.APP_WEB_URL}/settings/integrations?error=google_oauth_failed`);
  }
});

// Step 3: Disconnect
router.delete('/disconnect', async (req, res) => {
  const user_id = req.body.user_id;
  const { data } = await supabase
    .from('google_accounts')
    .select('refresh_token')
    .eq('user_id', user_id)
    .single();
  if (data?.refresh_token) {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token=${data.refresh_token}`,
    });
  }
  await supabase
    .from('google_accounts')
    .delete()
    .eq('user_id', user_id);

  // Also update the integrations table to set Google as not_connected
  const { error: integrationError } = await supabase
    .from('integrations')
    .upsert({
      user_id,
      provider: 'google',
      status: 'not_connected',
      connected_at: null
    }, { onConflict: 'user_id,provider' });
  console.log('Integration disconnect upsert error:', integrationError);

  // Optionally: broadcast integration change
  // await supabase.functions.invoke('broadcastIntegrationChange', { user_id });
  res.status(204).end();
});

export default router; 