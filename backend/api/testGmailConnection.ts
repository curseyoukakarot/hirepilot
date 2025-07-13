import { Request, Response } from 'express';
import { getGoogleAccessToken } from '../services/googleTokenHelper';
import { google } from 'googleapis';

export default async function testGmailConnection(req: Request, res: Response) {
  try {
    const userId = req.query.user_id as string;
    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    console.log('[testGmailConnection] Testing Gmail connection for user:', userId);

    // Test 1: Check if Google account exists
    const { supabaseDb } = await import('../lib/supabase');
    const { data: googleAccount, error: accountError } = await supabaseDb
      .from('google_accounts')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single();

    if (accountError || !googleAccount) {
      return res.json({
        success: false,
        error: 'Google account not connected',
        details: accountError?.message || 'No Google account found'
      });
    }

    console.log('[testGmailConnection] Google account found, expires at:', googleAccount.expires_at);

    // Test 2: Try to get access token
    let accessToken;
    try {
      accessToken = await getGoogleAccessToken(userId);
      console.log('[testGmailConnection] Access token obtained successfully');
    } catch (tokenError) {
      return res.json({
        success: false,
        error: 'Failed to get access token',
        details: tokenError instanceof Error ? tokenError.message : 'Unknown token error'
      });
    }

    // Test 3: Try to initialize Gmail API
    const oauth2client = new google.auth.OAuth2();
    oauth2client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2client });

    // Test 4: Try to get user profile (lightweight test)
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('[testGmailConnection] Gmail API test successful, email:', profile.data.emailAddress);
      
      return res.json({
        success: true,
        message: 'Gmail connection is working',
        details: {
          email: profile.data.emailAddress,
          messagesTotal: profile.data.messagesTotal,
          threadsTotal: profile.data.threadsTotal,
          tokenValid: true
        }
      });
    } catch (apiError: any) {
      console.error('[testGmailConnection] Gmail API error:', apiError);
      
      return res.json({
        success: false,
        error: 'Gmail API test failed',
        details: {
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          message: apiError.message,
          code: apiError.code
        }
      });
    }

  } catch (error: any) {
    console.error('[testGmailConnection] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Unexpected error during Gmail connection test',
      details: error.message
    });
  }
} 