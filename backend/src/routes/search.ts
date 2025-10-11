import express, { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = express.Router();

const candidateFiltersSchema = z.object({
  q: z.string().optional(),
  skills: z.array(z.string()).optional(),
  tech: z.array(z.string()).optional(),
  titles: z.array(z.string()).optional(),
  companies: z.array(z.string()).optional(),
  fundingStage: z.array(z.string()).optional(),
  revenueMin: z.number().optional(),
  revenueMax: z.number().optional(),
  location: z.string().optional(),
  limit: z.number().min(1).max(200).optional(),
  offset: z.number().min(0).optional(),
});

const leadFiltersSchema = z.object({
  q: z.string().optional(),
  sources: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  limit: z.number().min(1).max(200).optional(),
  offset: z.number().min(0).optional(),
});

// POST /api/search/candidates
router.post('/candidates', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const parse = candidateFiltersSchema.safeParse(req.body || {});
    if (!parse.success) { res.status(400).json({ error: 'invalid_filters', details: parse.error.flatten() }); return; }
    const f = parse.data;

    // Team/role visibility (mirror leads/candidates list behavior)
    const { data: userData } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .maybeSingle();
    const isAdmin = ['admin','team_admin','super_admin'].includes((userData as any)?.role);

    // Resolve visible user_id set
    let visibleUserIds: string[] = [userId];
    if ((userData as any)?.team_id) {
      if (isAdmin) {
        const { data: teamUsers } = await supabase
          .from('users')
          .select('id')
          .eq('team_id', (userData as any).team_id);
        visibleUserIds = [userId, ...((teamUsers || []).map((u: any) => u.id))];
      } else {
        // include team shared via candidates.shared=true
        const { data: teamUsers } = await supabase
          .from('users')
          .select('id')
          .eq('team_id', (userData as any).team_id);
        visibleUserIds = [userId, ...((teamUsers || []).map((u: any) => u.id))];
      }
    }

    // Collect candidate ids matching filters from auxiliary tables (skills/tech/experience)
    let candidateIdSet: Set<string> | null = null;

    // q → FTS via materialized view when available
    if (f.q && f.q.trim()) {
      const { data: ftsRows, error: ftsErr } = await supabase
        .from('candidate_search_mv')
        .select('candidate_id')
        .textSearch('document', f.q.trim(), { type: 'plain', config: 'simple' });
      if (!ftsErr && Array.isArray(ftsRows)) {
        candidateIdSet = new Set((ftsRows || []).map((r: any) => r.candidate_id));
      }
    }

    // skills filter
    if (Array.isArray(f.skills) && f.skills.length) {
      const { data } = await supabase
        .from('candidate_skill')
        .select('candidate_id')
        .in('skill', f.skills);
      const ids = new Set((data || []).map((r: any) => r.candidate_id));
      candidateIdSet = candidateIdSet ? new Set([...candidateIdSet].filter(id => ids.has(id))) : ids;
    }

    // tech filter
    if (Array.isArray(f.tech) && f.tech.length) {
      const { data } = await supabase
        .from('candidate_tech_stack')
        .select('candidate_id')
        .in('tech', f.tech);
      const ids = new Set((data || []).map((r: any) => r.candidate_id));
      candidateIdSet = candidateIdSet ? new Set([...candidateIdSet].filter(id => ids.has(id))) : ids;
    }

    // titles filter
    if (Array.isArray(f.titles) && f.titles.length) {
      const { data } = await supabase
        .from('candidate_experience')
        .select('candidate_id')
        .in('title', f.titles);
      const ids = new Set((data || []).map((r: any) => r.candidate_id));
      candidateIdSet = candidateIdSet ? new Set([...candidateIdSet].filter(id => ids.has(id))) : ids;
    }

    // companies filter
    if (Array.isArray(f.companies) && f.companies.length) {
      const { data } = await supabase
        .from('candidate_experience')
        .select('candidate_id')
        .in('company', f.companies);
      const ids = new Set((data || []).map((r: any) => r.candidate_id));
      candidateIdSet = candidateIdSet ? new Set([...candidateIdSet].filter(id => ids.has(id))) : ids;
    }

    // Base query
    const limit = Math.max(1, Math.min(200, Number(f.limit ?? 25)));
    const offset = Math.max(0, Number(f.offset ?? 0));
    let query = supabase
      .from('candidates')
      .select('id, first_name, last_name, email, title, linkedin_url, created_at')
      .in('user_id', Array.from(new Set(visibleUserIds)));

    // If non-admin with team, only include shared=true for others; owner always included
    if (!isAdmin && (userData as any)?.team_id) {
      // emulate OR: (user_id=me) OR (user_id in team AND shared=true)
      query = supabase
        .from('candidates')
        .select('id, first_name, last_name, email, title, linkedin_url, created_at')
        .or(`user_id.eq.${userId},and(user_id.in.(${visibleUserIds.join(',')}),shared.eq.true)`);
    }

    if (candidateIdSet) {
      const ids = Array.from(candidateIdSet);
      if (ids.length === 0) {
        res.json({ rows: [], count: 0 });
        return;
      }
      query = query.in('id', ids);
    } else if (f.q && f.q.trim()) {
      // fallback simple ilike search if FTS MV is empty/unavailable
      const term = `%${f.q.trim()}%`;
      query = query.or([
        `first_name.ilike.${term}`,
        `last_name.ilike.${term}`,
        `email.ilike.${term}`,
        `title.ilike.${term}`,
      ].join(','));
    }

    const { count } = await query.returns<any>().select('*', { count: 'exact', head: true });
    const { data: rows, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) { res.status(500).json({ error: error.message }); return; }

    logger.info({ route: '/api/search/candidates', orgId: (userData as any)?.team_id || null, action: 'search', ok: true, count: count || 0 });
    res.json({ rows: rows || [], count: count || 0 });
  } catch (e: any) {
    logger.error({ route: '/api/search/candidates', action: 'error', ok: false, error: e?.message });
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// POST /api/search/leads
router.post('/leads', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const parse = leadFiltersSchema.safeParse(req.body || {});
    if (!parse.success) { res.status(400).json({ error: 'invalid_filters', details: parse.error.flatten() }); return; }
    const f = parse.data;

    const { data: userData } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .maybeSingle();
    const isAdmin = ['admin','team_admin','super_admin'].includes((userData as any)?.role);

    const limit = Math.max(1, Math.min(200, Number(f.limit ?? 25)));
    const offset = Math.max(0, Number(f.offset ?? 0));

    let base = supabase.from('leads').select('id, first_name, last_name, email, title, company, linkedin_url, created_at');

    if (isAdmin && (userData as any)?.team_id) {
      base = base.or(`user_id.eq.${userId},and(team_id.eq.${(userData as any).team_id})`);
    } else if ((userData as any)?.team_id) {
      base = base.or(`user_id.eq.${userId},and(team_id.eq.${(userData as any).team_id},shared.eq.true)`);
    } else {
      base = base.eq('user_id', userId);
    }

    if (f.q && f.q.trim()) {
      const term = `%${f.q.trim()}%`;
      base = base.or([
        `first_name.ilike.${term}`,
        `last_name.ilike.${term}`,
        `email.ilike.${term}`,
        `title.ilike.${term}`,
        `company.ilike.${term}`,
        `company_name.ilike.${term}`
      ].join(','));
    }
    if (Array.isArray(f.sources) && f.sources.length) {
      base = base.in('source', f.sources);
    }
    if (Array.isArray(f.tags) && f.tags.length) {
      // tags stored as array/json? try contains
      base = base.contains('tags', f.tags);
    }
    if (f.title && f.title.trim()) {
      base = base.ilike('title', `%${f.title.trim()}%`);
    }
    if (f.company && f.company.trim()) {
      // handle both company and company_name
      const comp = `%${f.company.trim()}%`;
      base = base.or(`company.ilike.${comp},company_name.ilike.${comp}`);
    }

    const { count } = await base.returns<any>().select('*', { count: 'exact', head: true });
    const { data: rows, error } = await base.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) { res.status(500).json({ error: error.message }); return; }

    logger.info({ route: '/api/search/leads', orgId: (userData as any)?.team_id || null, action: 'search', ok: true, count: count || 0 });
    res.json({ rows: rows || [], count: count || 0 });
  } catch (e: any) {
    logger.error({ route: '/api/search/leads', action: 'error', ok: false, error: e?.message });
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

export default router;


