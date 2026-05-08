/**
 * v2 — /api/v2/ui-preference
 * Per-user UI shell preference + v2 banner dismissal state.
 *
 * GET   /api/v2/ui-preference                      → current state
 * PATCH /api/v2/ui-preference  { ui_version, dismiss_banner? }
 *
 * Resilient when migration 20260507000003_v2_ui_preference.sql hasn't been
 * applied yet:
 *   - GET returns sensible defaults (legacy, not dismissed) instead of 500.
 *   - PATCH returns a 503 with `error: 'apply_migration'` + a clear
 *     fallback_url so the frontend can show the user a useful message
 *     and still let them navigate to v2 manually.
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';

const router = express.Router();
router.use(requireAuth as any);

const VALID_VERSIONS = new Set(['legacy', 'v2']);

/** True when Supabase complains it can't find the column in the schema cache. */
function isSchemaCacheError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('schema cache')) return true;
  if (msg.includes('column') && msg.includes('does not exist')) return true;
  return false;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });
    const { data, error } = await supabase
      .from('users')
      .select('ui_version, v2_banner_dismissed_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      if (isSchemaCacheError(error)) {
        // Migration hasn't run yet — return defaults so the UI keeps working.
        console.warn('[ui-preference] columns missing — apply migration 20260507000003_v2_ui_preference.sql');
        return res.json({
          ui_version: 'legacy',
          v2_banner_dismissed_at: null,
          _migration_pending: true,
        });
      }
      return res.status(500).json({ error: error.message });
    }
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
    if (error) {
      if (isSchemaCacheError(error)) {
        return res.status(503).json({
          error: 'apply_migration',
          migration: '20260507000003_v2_ui_preference.sql',
          message: "The v2 UI preference column hasn't been added to Supabase yet. Apply migration 20260507000003 (or have an admin do it). In the meantime you can navigate to /v2/today directly — your data is already there.",
          fallback_url: '/v2/today',
        });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.json({
      ui_version: (data as any)?.ui_version || 'legacy',
      v2_banner_dismissed_at: (data as any)?.v2_banner_dismissed_at || null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'update_failed' });
  }
});

export default router;
