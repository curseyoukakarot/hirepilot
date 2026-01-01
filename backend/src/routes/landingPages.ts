import express, { Request, Response } from 'express';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';

const router = express.Router();

function normalizeSlug(input: string) {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s;
}

// GET /api/landing-pages/me
router.get('/me', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data, error } = await supabase
      .from('landing_pages')
      .select('id,slug,html,published,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message || 'fetch_failed' });
    return res.json({ landingPage: data || null });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'fetch_failed' });
  }
});

// POST /api/landing-pages/upsert
// body: { slug, html, published? }
router.post('/upsert', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const slug = normalizeSlug((req.body as any)?.slug);
    const html = String((req.body as any)?.html || '');
    const published = Boolean((req.body as any)?.published || false);

    if (!slug) return res.status(400).json({ error: 'slug_required' });
    if (slug.length < 2 || slug.length > 80) return res.status(400).json({ error: 'slug_invalid' });
    if (!html.trim()) return res.status(400).json({ error: 'html_required' });

    // Enforce ownership: a slug can only be owned by one user.
    const { data: existing, error: existingErr } = await supabase
      .from('landing_pages')
      .select('id,user_id')
      .eq('slug', slug)
      .maybeSingle();
    if (existingErr) return res.status(500).json({ error: existingErr.message || 'lookup_failed' });
    if (existing && (existing as any).user_id !== userId) {
      return res.status(409).json({ error: 'slug_taken' });
    }

    const { data, error } = await supabase
      .from('landing_pages')
      .upsert(
        { user_id: userId, slug, html, published } as any,
        { onConflict: 'slug' }
      )
      .select('id,slug,html,published,created_at,updated_at')
      .single();
    if (error) return res.status(500).json({ error: error.message || 'save_failed' });
    return res.json({ landingPage: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'save_failed' });
  }
});

// GET /api/landing-pages/by-slug/:slug (public)
router.get('/by-slug/:slug', async (req: Request, res: Response) => {
  try {
    const slug = normalizeSlug(req.params.slug || '');
    if (!slug) return res.status(400).json({ error: 'slug_required' });

    const { data, error } = await supabase
      .from('landing_pages')
      .select('id,slug,html,published,updated_at')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message || 'fetch_failed' });
    if (!data) return res.status(404).json({ error: 'not_found' });
    if (!(data as any).published) return res.status(404).json({ error: 'not_found' }); // hide drafts

    return res.json({ landingPage: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'fetch_failed' });
  }
});

export default router;


