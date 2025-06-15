import { supabaseDb } from '../lib/supabase';
import axios from 'axios';

interface OutlookTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/**
 * Get Outlook access token for a user
 */
export async function getOutlookAccessToken(userId: string): Promise<string> {
  try {
    // Get stored tokens
    const { data: tokens, error } = await supabaseDb
      .from('outlook_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    if (!tokens) throw new Error('No Outlook tokens found');

    // Check if token needs refresh
    const expiresAt = new Date(tokens.expires_at);
    if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) { // Refresh if less than 5 minutes left
      const newTokens = await refreshOutlookToken(tokens.refresh_token);
      
      // Update tokens in database
      await supabaseDb
        .from('outlook_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: newTokens.expires_at,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      return newTokens.access_token;
    }

    return tokens.access_token;
  } catch (error) {
    console.error('Error getting Outlook access token:', error);
    throw error;
  }
}

/**
 * Refresh Outlook OAuth token
 */
async function refreshOutlookToken(refreshToken: string): Promise<OutlookTokens> {
  try {
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'openid profile email offline_access Mail.Send'
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    return {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
    };
  } catch (error) {
    console.error('Error refreshing Outlook token:', error);
    throw error;
  }
} 