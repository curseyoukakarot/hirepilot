import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { getOutlookAccessToken } from '../services/outlookTokenHelper';

export default async function debugOutlook(req: Request, res: Response) {
  const { user_id } = req.query;
  
  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' });
    return;
  }

  try {
    // 1. Check if user has Outlook tokens stored
    const { data: outlookTokens, error: tokensError } = await supabaseDb
      .from('outlook_tokens')
      .select('*')
      .eq('user_id', user_id);

    // 2. Test token retrieval
    let tokenTestResult = null;
    try {
      const accessToken = await getOutlookAccessToken(user_id as string);
      tokenTestResult = {
        success: true,
        token_length: accessToken?.length || 0,
        token_preview: accessToken ? `${accessToken.substring(0, 20)}...` : 'null'
      };
    } catch (tokenError) {
      tokenTestResult = {
        success: false,
        error: tokenError.message
      };
    }

    // 3. Check integration status
    const { data: integration, error: integrationError } = await supabaseDb
      .from('integrations')
      .select('*')
      .eq('user_id', user_id)
      .eq('provider', 'outlook');

    res.json({
      debug: {
        user_id,
        timestamp: new Date().toISOString()
      },
      outlook_tokens: {
        count: outlookTokens?.length || 0,
        data: outlookTokens?.map(token => ({
          access_token_length: token.access_token?.length || 0,
          access_token_preview: token.access_token ? `${token.access_token.substring(0, 20)}...` : 'null',
          refresh_token_length: token.refresh_token?.length || 0,
          expires_at: token.expires_at,
          created_at: token.created_at,
          updated_at: token.updated_at
        })) || [],
        error: tokensError?.message
      },
      token_test: tokenTestResult,
      integration: {
        data: integration || [],
        error: integrationError?.message
      }
    });

  } catch (error: any) {
    console.error('[debugOutlook] Error:', error);
    res.status(500).json({ error: error.message || 'Debug failed' });
  }
} 