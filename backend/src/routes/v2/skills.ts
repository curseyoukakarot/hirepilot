/**
 * v2 — /api/v2/skills
 * Read-only catalog of available Skills. Workspace members can browse.
 *
 * GET /api/v2/skills                        list all (optional ?role=sourcer)
 * GET /api/v2/skills/:id                    one skill
 *
 * Installation lives on /api/v2/agents/:id/skills (see agents.ts).
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';
import activeWorkspace from '../../middleware/activeWorkspace';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const VALID_ROLES = new Set([
  'sourcer',
  'recruiter',
  'coordinator',
  'researcher',
  'business_dev',
  'closer',
  'account_manager',
  'reference_checker'
]);

router.get('/', async (req: Request, res: Response) => {
  try {
    const role = String(req.query.role || '').trim();
    let query = supabase
      .from('skills_catalog')
      .select('id, name, description, category, integration_id, agent_role, default_installed, icon, schedule_capable')
      .order('agent_role', { ascending: true })
      .order('name', { ascending: true });

    if (role) {
      if (!VALID_ROLES.has(role)) {
        return res.status(400).json({ error: 'invalid_role' });
      }
      query = query.eq('agent_role', role);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ skills: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'list_skills_failed' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('skills_catalog')
      .select('id, name, description, category, integration_id, agent_role, default_installed, icon, schedule_capable')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'skill_not_found' });
    return res.json({ skill: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'get_skill_failed' });
  }
});

export default router;
