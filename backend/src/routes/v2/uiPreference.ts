/**
 * v2 — /api/v2/ui-preference
 * Per-user UI shell preference + v2 banner dismissal state.
 *
 * GET   /api/v2/ui-preference                      → current state
 * PATCH /api/v2/ui-preference  { ui_version, dismiss_banner? }
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';

const router = express.Router();
router.use(requireAuth as any);

const VALID_VERSIONS = new Set(['legacy', 'v2']);

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });
    const { data, error } = await supabase
      .from('users')
      .select('ui_version, v2_banner_dismissed_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({
      ui_version: (data as any)?.ui_version || 'legacy',
      v2_banner_dismissed_at: (data as any)?.v2_banner_dismissed_at || null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'get_failed' });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    const { ui_version, dismiss_banner } = req.body || {};
    const updates: Record<string, any> = {};
    if (ui_version !== undefined) {
      if (!VALID_VERSIONS.has(ui_version)) return res.status(400).json({ error: 'invalid_ui_version' });
      updates.ui_version = ui_version;
    }
    if (dismiss_banner === true) {
      updates.v2_banner_dismissed_at = new Date().toISOString();
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'no_updates_provided' });

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('ui_version, v2_banner_dismissed_at')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({
      ui_version: (data as any)?.ui_version || 'legacy',
      v2_banner_dismissed_at: (data as any)?.v2_banner_dismissed_at || null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'update_failed' });
  }
});

export default router;
