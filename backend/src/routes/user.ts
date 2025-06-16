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
    const userId = (req as any).auth?.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get user settings first
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

    // Return both OAuth status and API key
    res.json({
      apollo_connected: !!integration,
      apollo_api_key: settings?.apollo_api_key || null
    });
  } catch (err) {
    logger.error('Error in /api/user/settings:', err);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

// POST /api/user/settings
router.post('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.user?.id;
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