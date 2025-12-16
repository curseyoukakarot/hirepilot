import express, { Request, Response } from 'express';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';

const router = express.Router();

function normalizeRolePlan(v: any) {
  return String(v || '').toLowerCase().replace(/\s|-/g, '_');
}

async function resolveEliteFlag(userId: string, req: Request): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('users')
      .select('role, plan')
      .eq('id', userId)
      .maybeSingle();
    const role = normalizeRolePlan((data as any)?.role || (req as any)?.user?.role);
    const plan = normalizeRolePlan((data as any)?.plan || (req as any)?.user?.plan);
    if (['super_admin', 'admin', 'team_admin', 'team_admins'].includes(role)) return true;
    return role === 'job_seeker_elite' || plan === 'job_seeker_elite';
  } catch {
    const role = normalizeRolePlan((req as any)?.user?.role);
    const plan = normalizeRolePlan((req as any)?.user?.plan);
    if (['super_admin', 'admin', 'team_admin', 'team_admins'].includes(role)) return true;
    return role === 'job_seeker_elite' || plan === 'job_seeker_elite';
  }
}

// GET /api/landing-themes
router.get('/', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const [themesRes, settingsRes, elite] = await Promise.all([
      supabase
        .from('landing_themes')
        .select('id,name,slug,tags,preview_image_url,theme_config,theme_html,created_at,updated_at')
        .order('name', { ascending: true }),
      supabase
        .from('user_landing_settings')
        .select('selected_theme_id')
        .eq('user_id', userId)
        .maybeSingle(),
      resolveEliteFlag(userId, req),
    ]);

    if (themesRes.error) return res.status(500).json({ error: themesRes.error.message || 'list_failed' });
    if (settingsRes.error) return res.status(500).json({ error: settingsRes.error.message || 'settings_failed' });

    const selectedThemeId = (settingsRes.data as any)?.selected_theme_id || null;
    res.json({ themes: themesRes.data || [], selectedThemeId, isElite: elite });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'list_failed' });
  }
});

// POST /api/landing-themes/select { themeId }
router.post('/select', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const themeId = String((req.body as any)?.themeId || '').trim();
    if (!themeId) return res.status(400).json({ error: 'themeId required' });

    const isElite = await resolveEliteFlag(userId, req);
    if (!isElite) {
      return res.status(403).json({ error: 'ELITE_REQUIRED', code: 'ELITE_REQUIRED' });
    }

    const { data: theme, error: themeErr } = await supabase
      .from('landing_themes')
      .select('id')
      .eq('id', themeId)
      .maybeSingle();
    if (themeErr) return res.status(500).json({ error: themeErr.message || 'theme_lookup_failed' });
    if (!theme) return res.status(404).json({ error: 'theme_not_found' });

    const { error } = await supabase
      .from('user_landing_settings')
      .upsert({ user_id: userId, selected_theme_id: themeId } as any, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ error: error.message || 'select_failed' });

    res.json({ ok: true, selectedThemeId: themeId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'select_failed' });
  }
});

export default router;

