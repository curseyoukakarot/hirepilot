/**
 * v2 — /api/v2/specialist-suggestions
 *
 * Captures user-submitted specialist suggestions from the HireCatalog
 * "Suggest a specialist" modal. Insert-only for normal users; super-
 * admins read + triage the list from a future admin panel.
 *
 * POST /api/v2/specialist-suggestions  { suggestion: string, context?: object }
 *   → { id }
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';

const router = express.Router();
router.use(requireAuth as any);

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    const suggestion = String((req.body as any)?.suggestion || '').trim();
    if (!suggestion) return res.status(400).json({ error: 'suggestion_required' });
    if (suggestion.length < 4) return res.status(400).json({ error: 'suggestion_too_short' });
    if (suggestion.length > 4000) return res.status(400).json({ error: 'suggestion_too_long' });

    const context = (req.body as any)?.context;
    const workspaceId = (req as any)?.workspace_id || (req as any)?.user?.workspace_id || null;

    const { data, error } = await supabase
      .from('specialist_suggestions')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        suggestion,
        context: context && typeof context === 'object' ? context : {},
        status: 'new',
      })
      .select('id')
      .maybeSingle();

    if (error) {
      // Fail-soft when the migration hasn't been applied yet.
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('schema cache') || (msg.includes('does not exist') && msg.includes('specialist'))) {
        console.warn('[specialist-suggestions] table missing — apply migration 20260508000000');
        return res.status(503).json({
          error: 'apply_migration',
          migration: '20260508000000_v2_specialist_suggestions.sql',
        });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.json({ id: (data as any)?.id || null });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'create_failed' });
  }
});

export default router;
