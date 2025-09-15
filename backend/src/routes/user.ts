import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
// import { logger } from '../lib/logger';
const logger = console;
import { requireAuth } from '../../middleware/authMiddleware';
import { ApiRequest } from '../../types/api';

const router = express.Router();
// GET /api/user/plan
router.get('/plan', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    let { data, error } = await supabase
      .from('users')
      .select('plan, remaining_credits, monthly_credits, plan_updated_at')
      .eq('id', userId)
      .maybeSingle();

    // If no public.users row exists, create a default FREE row and seed credits (idempotent)
    if (!data) {
      try {
        const email = (req as any).user?.email || null;
        // Insert minimal columns to avoid schema mismatches across environments
        await supabase
          .from('users')
          .upsert({ id: userId, email } as any, { onConflict: 'id' });
        // Seed credits row (idempotent)
        try {
          await supabase
            .from('user_credits')
            .upsert({
              user_id: userId,
              total_credits: 50,
              used_credits: 0,
              remaining_credits: 50,
              last_updated: new Date().toISOString()
            }, { onConflict: 'user_id' });
        } catch {}

        const reread = await supabase
          .from('users')
          .select('plan, remaining_credits, monthly_credits, plan_updated_at')
          .eq('id', userId)
          .maybeSingle();
        data = reread.data || { plan: 'free', remaining_credits: 50, monthly_credits: 50, plan_updated_at: new Date().toISOString() } as any;
      } catch (ensureErr) {
        // If ensure fails, still respond with a sane default so the UI can proceed
        data = { plan: 'free', remaining_credits: 50, monthly_credits: 50, plan_updated_at: new Date().toISOString() } as any;
      }
    }

    if (error && data) error = null; // ignore not-found after ensure
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to get plan' });
  }
});

// PATCH /api/user/credits  { delta: number }
router.patch('/credits', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { delta = 0 } = (req.body || {});
    const { data: current, error: readErr } = await supabase
      .from('users')
      .select('remaining_credits')
      .eq('id', userId)
      .single();
    if (readErr) return res.status(500).json({ error: readErr.message });
    const next = Math.max(0, (current?.remaining_credits || 0) + Number(delta));
    const { data, error } = await supabase
      .from('users')
      .update({ remaining_credits: next })
      .eq('id', userId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update credits' });
  }
});

// POST /api/user/onboarding-complete
router.post('/onboarding-complete', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    // Get user email to check for pending team invites
    const userEmail = req.user?.email;
    
    // Try update; if no row exists, upsert minimal row
    let { data, error } = await supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', userId)
      .select('id, onboarding_complete')
      .maybeSingle();

    if (!data) {
      await supabase
        .from('users')
        .upsert({ id: userId, email: userEmail, onboarding_complete: true } as any, { onConflict: 'id' });
      const reread = await supabase
        .from('users')
        .select('id, onboarding_complete')
        .eq('id', userId)
        .maybeSingle();
      data = reread.data as any;
    }

    if (error && data) error = null;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Update any pending team invites for this user to 'accepted' status
    if (userEmail) {
      try {
        await supabase
          .from('team_invites')
          .update({ 
            status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('email', userEmail)
          .eq('status', 'pending');
        
        console.log(`[ONBOARDING] Updated team invite status to 'accepted' for user: ${userEmail}`);
      } catch (inviteError) {
        console.warn('[ONBOARDING] Failed to update team invite status:', inviteError);
        // Don't fail the onboarding completion if invite update fails
      }
    }

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to set onboarding complete' });
  }
});


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

    // Determine Apollo API key and connection status with universal fallback
    const personalKey = settings?.apollo_api_key || null;
    const superAdminKey = process.env.SUPER_ADMIN_APOLLO_API_KEY || null;
    const platformKey = process.env.HIREPILOT_APOLLO_API_KEY || null;

    // Prefer user's own key; otherwise fall back to super admin; then platform
    let apolloApiKey = personalKey || superAdminKey || platformKey || null;
    // Connected if we have any key available or an OAuth integration
    let apolloConnected = !!apolloApiKey || !!integration;

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

// POST /api/user/upgrade  { plan: 'starter' | 'pro' | ... , baseCredits: number }
router.post('/upgrade', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { plan, baseCredits = 0 } = req.body || {};
    if (!plan) return res.status(400).json({ error: 'Missing plan' });

    const { data: current, error: readErr } = await supabase
      .from('users')
      .select('remaining_credits')
      .eq('id', userId)
      .single();
    if (readErr) return res.status(500).json({ error: readErr.message });

    const currentRemaining = Number(current?.remaining_credits || 0);
    const newBalance = currentRemaining + Number(baseCredits || 0);

    const { data, error } = await supabase
      .from('users')
      .update({ plan, plan_updated_at: new Date().toISOString(), remaining_credits: newBalance })
      .eq('id', userId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
});

export default router; 