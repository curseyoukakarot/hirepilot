import { Router, Response } from 'express';
import { requireAuth } from '../../../middleware/authMiddleware';
import { ApiRequest } from '../../../types/api';
import { encryptCookie, hashCookie, estimateCookieExpiration } from '../../utils/encryption';
import { supabase } from '../../lib/supabase';

const router = Router();

interface StoreLinkedInCookieRequest {
  liAt: string;
  userAgent?: string;
}

interface StoreLinkedInCookieResponse {
  success: boolean;
  message: string;
  connected: boolean;
}

/**
 * Store LinkedIn authentication cookie for Sales Navigator scraping
 * POST /api/cookies/linkedin
 */
router.post('/', requireAuth, async (req: ApiRequest, res: Response<StoreLinkedInCookieResponse>) => {
  try {
    const { liAt, userAgent } = req.body as StoreLinkedInCookieRequest;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required',
        connected: false
      });
    }

    if (!liAt || typeof liAt !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'LinkedIn li_at cookie is required',
        connected: false
      });
    }

    // Validate cookie format (basic check)
    if (!liAt.startsWith('AQE') || liAt.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Invalid LinkedIn cookie format. Please ensure you copied the complete li_at value.',
        connected: false
      });
    }

    console.log(`[LinkedInCookie] Storing cookie for user ${userId}`);

    // Encrypt the cookie
    const encryptedCookie = encryptCookie(liAt);
    const cookieHash = hashCookie(liAt);
    const expiresAt = estimateCookieExpiration();
    const currentTime = new Date().toISOString();

    // Check if user already has a stored cookie
    const { data: existingCookie } = await supabase
      .from('linkedin_cookies')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingCookie) {
      // Update existing cookie
      const { error: updateError } = await supabase
        .from('linkedin_cookies')
        .update({
          encrypted_cookie: encryptedCookie,
          cookie_hash: cookieHash,
          user_agent: userAgent || null,
          expires_at: expiresAt.toISOString(),
          valid: true,
          updated_at: currentTime
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[LinkedInCookie] Error updating cookie:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to update LinkedIn connection',
          connected: false
        });
      }

      console.log(`[LinkedInCookie] Updated cookie for user ${userId}`);
    } else {
      // Insert new cookie
      const { error: insertError } = await supabase
        .from('linkedin_cookies')
        .insert({
          user_id: userId,
          encrypted_cookie: encryptedCookie,
          cookie_hash: cookieHash,
          user_agent: userAgent || null,
          expires_at: expiresAt.toISOString(),
          valid: true,
          created_at: currentTime,
          updated_at: currentTime
        });

      if (insertError) {
        console.error('[LinkedInCookie] Error inserting cookie:', insertError);
        return res.status(500).json({
          success: false,
          message: 'Failed to store LinkedIn connection',
          connected: false
        });
      }

      console.log(`[LinkedInCookie] Stored new cookie for user ${userId}`);
    }

    // Update user's linkedin_connected status
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        linkedin_connected: true,
        linkedin_connected_at: currentTime
      })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('[LinkedInCookie] Error updating user status:', userUpdateError);
      // Don't fail the request for this, just log it
    }

    return res.status(200).json({
      success: true,
      message: 'LinkedIn connection established successfully. You can now use Sales Navigator scraping.',
      connected: true
    });

  } catch (error: any) {
    console.error('[LinkedInCookie] Error storing cookie:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while storing LinkedIn connection',
      connected: false
    });
  }
});

/**
 * Check LinkedIn connection status
 * GET /api/cookies/linkedin/status
 */
router.get('/status', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required',
        connected: false
      });
    }

    // Check if user has a valid cookie
    const { data: cookie } = await supabase
      .from('linkedin_cookies')
      .select('valid, expires_at, created_at, last_used_at')
      .eq('user_id', userId)
      .eq('valid', true)
      .single();

    const connected = !!cookie;
    const expiresAt = cookie?.expires_at ? new Date(cookie.expires_at) : null;
    const isExpired = expiresAt ? expiresAt < new Date() : false;

    return res.status(200).json({
      success: true,
      connected: connected && !isExpired,
      expiresAt: expiresAt?.toISOString(),
      lastUsed: cookie?.last_used_at,
      message: connected 
        ? (isExpired ? 'LinkedIn connection expired' : 'LinkedIn connection active')
        : 'No LinkedIn connection found'
    });

  } catch (error: any) {
    console.error('[LinkedInCookie] Error checking status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking LinkedIn connection status',
      connected: false
    });
  }
});

/**
 * Disconnect LinkedIn (invalidate cookie)
 * DELETE /api/cookies/linkedin
 */
router.delete('/', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Mark cookie as invalid
    const { error: cookieError } = await supabase
      .from('linkedin_cookies')
      .update({ valid: false })
      .eq('user_id', userId);

    // Update user status
    const { error: userError } = await supabase
      .from('users')
      .update({ 
        linkedin_connected: false,
        linkedin_connected_at: null 
      })
      .eq('id', userId);

    if (cookieError) {
      console.error('[LinkedInCookie] Error disconnecting:', cookieError);
    }

    if (userError) {
      console.error('[LinkedInCookie] Error updating user status:', userError);
    }

    console.log(`[LinkedInCookie] Disconnected LinkedIn for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'LinkedIn connection removed successfully',
      connected: false
    });

  } catch (error: any) {
    console.error('[LinkedInCookie] Error disconnecting:', error);
    return res.status(500).json({
      success: false,
      message: 'Error removing LinkedIn connection'
    });
  }
});

export default router; 