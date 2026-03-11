import express, { Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { ApiRequest } from '../../types/api';
import { supabaseAdmin } from '../services/supabase';

const router = express.Router();

// Auth middleware (same pattern as user.ts)
const requireAuthFlag =
  String(process.env.ENABLE_SESSION_COOKIE_AUTH || 'false').toLowerCase() === 'true'
    ? (requireAuthUnified as any)
    : (requireAuth as any);

// ---------------------------------------------------------------------------
// Valid app IDs — server-side validation (mirrors frontend appRegistry.ts)
// ---------------------------------------------------------------------------
const VALID_APP_IDS = new Set([
  'tables', 'kanban', 'deals', 'tasks', 'forms', 'landing-pages',
  'agent-mode', 'messages', 'cloud-engine', 'personas', 'api-key',
]);

const DEFAULT_APPS = ['messages', 'tables', 'kanban', 'tasks', 'forms'];

// ---------------------------------------------------------------------------
// GET /api/user/sidebar-apps — fetch user's enabled sidebar apps
// ---------------------------------------------------------------------------
router.get('/sidebar-apps', requireAuthFlag, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('user_sidebar_apps')
      .select('app_id, sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('enabled_at', { ascending: true });

    if (error) {
      console.warn('[sidebar-apps] GET error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    // First-time user: seed with defaults
    if (!data || data.length === 0) {
      const rows = DEFAULT_APPS.map((appId, i) => ({
        user_id: userId,
        app_id: appId,
        sort_order: i,
      }));

      await supabaseAdmin.from('user_sidebar_apps').upsert(rows, {
        onConflict: 'user_id,app_id',
      });

      return res.json({ apps: DEFAULT_APPS });
    }

    return res.json({ apps: data.map((r: any) => r.app_id) });
  } catch (err: any) {
    console.error('[sidebar-apps] GET error:', err?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/user/sidebar-apps — save user's enabled sidebar apps
// ---------------------------------------------------------------------------
router.put('/sidebar-apps', requireAuthFlag, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { apps } = req.body;
    if (!Array.isArray(apps)) {
      return res.status(400).json({ error: 'apps must be an array of app IDs' });
    }

    // Validate all IDs
    const validApps = apps.filter((id: string) => VALID_APP_IDS.has(id));
    if (validApps.length === 0 && apps.length > 0) {
      return res.status(400).json({ error: 'No valid app IDs provided' });
    }

    // Fetch current apps for change tracking
    const { data: currentData } = await supabaseAdmin
      .from('user_sidebar_apps')
      .select('app_id')
      .eq('user_id', userId);

    const currentIds = new Set((currentData || []).map((r: any) => r.app_id));
    const newIds = new Set(validApps);

    // Delete all then insert fresh (clean replacement)
    await supabaseAdmin
      .from('user_sidebar_apps')
      .delete()
      .eq('user_id', userId);

    if (validApps.length > 0) {
      const rows = validApps.map((appId: string, i: number) => ({
        user_id: userId,
        app_id: appId,
        sort_order: i,
      }));

      const { error: insertErr } = await supabaseAdmin
        .from('user_sidebar_apps')
        .insert(rows);

      if (insertErr) {
        console.warn('[sidebar-apps] PUT insert error:', insertErr.message);
        return res.status(500).json({ error: insertErr.message });
      }
    }

    // Track enable/disable events (fire-and-forget)
    const events: any[] = [];
    for (const id of validApps) {
      if (!currentIds.has(id)) {
        events.push({ user_id: userId, app_id: id, action: 'enable' });
      }
    }
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        events.push({ user_id: userId, app_id: id, action: 'disable' });
      }
    }
    if (events.length > 0) {
      Promise.resolve(supabaseAdmin.from('app_usage_events').insert(events)).catch(() => {});
    }

    return res.json({ apps: validApps });
  } catch (err: any) {
    console.error('[sidebar-apps] PUT error:', err?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/user/sidebar-apps/track — fire-and-forget usage tracking
// ---------------------------------------------------------------------------
router.post('/sidebar-apps/track', requireAuthFlag, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { app_id, action } = req.body;
    if (!app_id || typeof app_id !== 'string') {
      return res.status(400).json({ error: 'app_id is required' });
    }

    // Fire-and-forget insert
    Promise.resolve(
      supabaseAdmin
        .from('app_usage_events')
        .insert({
          user_id: userId,
          app_id,
          action: action || 'navigate',
        })
    ).catch(() => {});

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
