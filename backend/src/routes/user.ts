import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
// import { logger } from '../lib/logger';
const logger = console;
import { requireAuth } from '../../middleware/authMiddleware';
import { ApiRequest } from '../../types/api';

const router = express.Router();

// GET /api/user/settings
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get user role to check for RecruitPro privileges
    const { data: userRecord, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    // Also get auth user metadata as fallback
    let authMetadata = null;
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      authMetadata = authUser?.user?.user_metadata;
    } catch (authError) {
      console.error('Error fetching auth metadata:', authError);
    }

    // Debug logging
    console.log('[User Settings] Debug info:', {
      userId,
      userRecord,
      userErr,
      authMetadata,
      env_has_super_admin_key: !!process.env.SUPER_ADMIN_APOLLO_API_KEY
    });

    // Check if user is RecruitPro or other privileged type (includes admin for REX access)
    const privilegedTypes = ['RecruitPro', 'TeamAdmin', 'admin', 'member'];
    const userRole = userRecord?.role || authMetadata?.role || authMetadata?.account_type;
    const isRecruitPro = privilegedTypes.includes(userRole);

    console.log('[User Settings] RecruitPro check:', {
      userRole,
      isRecruitPro,
      privilegedTypes
    });

    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
    }

    // Check for active Apollo OAuth connection
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'apollo')
      .eq('status', 'connected')
      .single();

    // Determine Apollo API key and connection status
    let apolloApiKey = settings?.apollo_api_key || null;
    let apolloConnected = !!integration;

    // RecruitPro users get access to SUPER_ADMIN_APOLLO_API_KEY
    if (isRecruitPro && process.env.SUPER_ADMIN_APOLLO_API_KEY) {
      apolloApiKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
      apolloConnected = true; // Mark as connected for RecruitPro users
    }

    // Return both OAuth status and API key
    res.json({
      apollo_connected: apolloConnected,
      apollo_api_key: apolloApiKey
    });
  } catch (err) {
    logger.error('Error in /api/user/settings:', err);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

// POST /api/user/settings
router.post('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { apollo_api_key } = req.body;
    if (!apollo_api_key) {
      res.status(400).json({ error: 'Missing apollo_api_key' });
      return;
    }
    const { data, error } = await supabase
      .from('user_settings')
      .upsert([{ user_id: userId, apollo_api_key }], { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: error.message });
  }
});

export const getCurrentUser = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
};

export const updateUser = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .update(req.body)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export default router; 