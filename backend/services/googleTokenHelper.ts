import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function getGoogleAccessToken(userId: string) {
  const { data: row, error } = await supabase
    .from('google_accounts')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !row) throw new Error('Google not connected');

  // Expired or <60 s to expiry?
  if (Date.parse(row.expires_at) - Date.now() < 60_000) {
    const oauth2 = new google.auth.OAuth2({
      clientId:  process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    });
    oauth2.setCredentials({ refresh_token: row.refresh_token });

    const { credentials } = await oauth2.refreshAccessToken();   // force refresh
    const newExpires = new Date(credentials.expiry_date!);

    // Persist new tokens
    const updateData: any = {
      access_token: credentials.access_token,
      expires_at:   newExpires.toISOString(),
    };
    if (credentials.refresh_token) {
      updateData.refresh_token = credentials.refresh_token;
    }
    await supabase.from('google_accounts')
      .update(updateData)
      .eq('user_id', userId);

    console.log('[GoogleTokenHelper] Refreshed token and updated DB:', {
      userId,
      ...updateData
    });

    return credentials.access_token!;
  }

  return row.access_token;
} 

export async function forceRefreshGoogleAccessToken(userId: string) {
  const { data: row, error } = await supabase
    .from('google_accounts')
    .select('refresh_token')
    .eq('user_id', userId)
    .single();

  if (error || !row?.refresh_token) throw new Error('No refresh token available');

  const oauth2 = new google.auth.OAuth2({
    clientId:  process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  oauth2.setCredentials({ refresh_token: row.refresh_token });

  const { credentials } = await oauth2.refreshAccessToken();
  const newExpires = new Date(credentials.expiry_date!);

  const updateData: any = {
    access_token: credentials.access_token,
    expires_at:   newExpires.toISOString(),
  };
  if (credentials.refresh_token) {
    updateData.refresh_token = credentials.refresh_token;
  }
  await supabase.from('google_accounts')
    .update(updateData)
    .eq('user_id', userId);

  console.log('[GoogleTokenHelper] Force-refreshed token and updated DB:', {
    userId,
    ...updateData
  });

  return credentials.access_token!;
}