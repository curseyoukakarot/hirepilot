import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { getUserIntegrations, saveUserIntegrations, UserIntegrations } from '../utils/userIntegrationsHelper';
import { supabaseDb } from '../lib/supabase';

const router = Router();

/**
 * GET /api/user-integrations
 * Fetch current user's enrichment API keys (admin users only)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check if user has admin-level access
    const { data: userData, error: userError } = await supabaseDb
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user role:', userError);
      res.status(500).json({ error: 'Failed to verify user permissions' });
      return;
    }

    const role = userData?.role;
    // Role-based access control for Hunter/Skrapp enrichment features
    // Only allow: Super Admin, Pro, Team Admin, RecruitPro, Admin
    const allowedRoles = ['super_admin', 'Pro', 'team_admin', 'RecruitPro', 'admin'];
    
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Premium access required for enrichment API keys. Contact support to upgrade your plan.' });
      return;
    }

    // Fetch user's integrations
    const integrations = await getUserIntegrations(userId);
    
    res.status(200).json(integrations);
  } catch (error) {
    console.error('Error in GET /api/user-integrations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user integrations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/user-integrations
 * Save/update current user's enrichment API keys (admin users only)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check if user has admin-level access
    const { data: userData, error: userError } = await supabaseDb
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user role:', userError);
      res.status(500).json({ error: 'Failed to verify user permissions' });
      return;
    }

    const role = userData?.role;
    // Role-based access control for Hunter/Skrapp enrichment features
    // Only allow: Super Admin, Pro, Team Admin, RecruitPro, Admin
    const allowedRoles = ['super_admin', 'Pro', 'team_admin', 'RecruitPro', 'admin'];
    
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Premium access required for enrichment API keys. Contact support to upgrade your plan.' });
      return;
    }

    // Validate request body
    const { hunter_api_key, skrapp_api_key, enrichment_source } = req.body as {
      hunter_api_key?: string;
      skrapp_api_key?: string;
      enrichment_source?: 'skrapp' | 'apollo';
    };

    // Validate API keys format (basic validation)
    if (hunter_api_key && typeof hunter_api_key !== 'string') {
      res.status(400).json({ error: 'Invalid Hunter.io API key format' });
      return;
    }

    if (skrapp_api_key && typeof skrapp_api_key !== 'string') {
      res.status(400).json({ error: 'Invalid Skrapp.io API key format' });
      return;
    }
    if (enrichment_source && !['skrapp','apollo'].includes(enrichment_source)) {
      res.status(400).json({ error: 'Invalid enrichment_source. Must be "skrapp" or "apollo"' });
      return;
    }

    // Prepare integrations object
    const integrations: UserIntegrations = {};
    if (hunter_api_key) {
      integrations.hunter_api_key = hunter_api_key.trim();
    }
    if (skrapp_api_key) {
      integrations.skrapp_api_key = skrapp_api_key.trim();
    }
    if (enrichment_source) {
      integrations.enrichment_source = enrichment_source;
    }

    // Save integrations
    const success = await saveUserIntegrations(userId, integrations);
    
    if (!success) {
      res.status(500).json({ error: 'Failed to save integrations' });
      return;
    }

    res.status(200).json({ 
      message: 'Integrations saved successfully',
      integrations 
    });
  } catch (error) {
    console.error('Error in POST /api/user-integrations:', error);
    res.status(500).json({ 
      error: 'Failed to save user integrations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 