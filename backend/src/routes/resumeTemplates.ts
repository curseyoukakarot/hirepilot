import express, { Request, Response } from 'express';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';

const router = express.Router();

function normalizeRolePlan(v: any) {
  return String(v || '').toLowerCase().replace(/\s|-/g, '_');
}

async function resolveEliteFlag(userId: string, req: Request): Promise<boolean> {
  // Prefer authoritative DB role/plan if present (service role client bypasses RLS)
  try {
    const { data } = await supabase
      .from('users')
      .select('role, plan')
      .eq('id', userId)
      .maybeSingle();
    const role = normalizeRolePlan((data as any)?.role || (req as any)?.user?.role);
    const plan = normalizeRolePlan((data as any)?.plan || (req as any)?.user?.plan);
    // Treat admins as elite for operational access (useful for debugging)
    if (['super_admin', 'admin', 'team_admin', 'team_admins'].includes(role)) return true;
    return role === 'job_seeker_elite' || plan === 'job_seeker_elite';
  } catch {
    const role = normalizeRolePlan((req as any)?.user?.role);
    const plan = normalizeRolePlan((req as any)?.user?.plan);
    if (['super_admin', 'admin', 'team_admin', 'team_admins'].includes(role)) return true;
    return role === 'job_seeker_elite' || plan === 'job_seeker_elite';
  }
}

// GET /api/resume-templates
router.get('/', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const [tplRes, settingsRes, elite] = await Promise.all([
      supabase
        .from('resume_templates')
        .select('id,name,slug,is_ats_safe,is_one_page,tags,preview_image_url,template_config,created_at,updated_at')
        .order('name', { ascending: true }),
      supabase
        .from('user_resume_settings')
        .select('selected_template_id')
        .eq('user_id', userId)
        .maybeSingle(),
      resolveEliteFlag(userId, req),
    ]);

    if (tplRes.error) return res.status(500).json({ error: tplRes.error.message || 'list_failed' });
    if (settingsRes.error) return res.status(500).json({ error: settingsRes.error.message || 'settings_failed' });

    const selectedTemplateId = (settingsRes.data as any)?.selected_template_id || null;
    res.json({ templates: tplRes.data || [], selectedTemplateId, isElite: elite });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'list_failed' });
  }
});

// POST /api/resume-templates/select { templateId }
router.post('/select', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const templateId = String((req.body as any)?.templateId || '').trim();
    if (!templateId) return res.status(400).json({ error: 'templateId required' });

    const isElite = await resolveEliteFlag(userId, req);
    if (!isElite) {
      return res.status(403).json({ error: 'ELITE_REQUIRED', code: 'ELITE_REQUIRED' });
    }

    // Validate template exists
    const { data: tpl, error: tplErr } = await supabase
      .from('resume_templates')
      .select('id')
      .eq('id', templateId)
      .maybeSingle();
    if (tplErr) return res.status(500).json({ error: tplErr.message || 'template_lookup_failed' });
    if (!tpl) return res.status(404).json({ error: 'template_not_found' });

    const { error } = await supabase
      .from('user_resume_settings')
      .upsert({ user_id: userId, selected_template_id: templateId } as any, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ error: error.message || 'select_failed' });

    res.json({ ok: true, selectedTemplateId: templateId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'select_failed' });
  }
});

export default router;

