import express, { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuthUnified as requireAuth } from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = express.Router();
// Router-level CORS guard to guarantee headers on all responses for this endpoint
router.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Cache-Control, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  next();
});

const createActivitySchema = z.object({
  links: z.array(z.object({
    entityType: z.enum(['client','decision_maker','opportunity']),
    entityId: z.string().uuid()
  })).min(1),
  type: z.enum(['call','email','meeting','note','task','update']),
  title: z.string().optional(),
  body: z.string().optional(),
  occurredAt: z.string().datetime().optional()
});

// POST /api/deals/activity
router.post('/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const parse = createActivitySchema.safeParse(req.body || {});
    if (!parse.success) { res.status(400).json({ error: 'invalid_payload', details: parse.error.flatten() }); return; }
    const payload = parse.data;

    // Determine org/team id for activity (optional)
    const { data: me } = await supabase.from('users').select('team_id').eq('id', userId).maybeSingle();
    const orgId = (me as any)?.team_id || null;

    // Insert activity
    const { data: act, error: aerr } = await supabase
      .from('activities')
      .insert({
        org_id: orgId,
        actor_user_id: userId,
        type: payload.type,
        title: payload.title || null,
        body: payload.body || null,
        occurred_at: payload.occurredAt ? new Date(payload.occurredAt).toISOString() : new Date().toISOString()
      })
      .select('*')
      .single();
    if (aerr || !act) { res.status(500).json({ error: aerr?.message || 'Failed to create activity' }); return; }

    // Insert links
    const linkRows = payload.links.map(l => ({ activity_id: act.id, entity_type: l.entityType, entity_id: l.entityId }));
    const { error: lerr } = await supabase.from('activity_link').insert(linkRows);
    if (lerr) { res.status(500).json({ error: lerr.message || 'Failed to link activity' }); return; }

    logger.info({ route: '/api/deals/activity', orgId, action: 'create', ok: true, id: act.id });
    res.json({ ok: true, activity: act });
  } catch (e: any) {
    logger.error({ route: '/api/deals/activity', action: 'error', ok: false, error: e?.message });
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// GET /api/deals/activity?entityType=opportunity&entityId=...
router.get('/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const entityType = String(req.query.entityType || '');
    const entityId = String(req.query.entityId || '');
    if (!['client','decision_maker','opportunity'].includes(entityType) || !entityId) {
      res.status(400).json({ error: 'invalid_query' }); return;
    }

    // Visibility: same as deals routes (team-level visibility). For now, allow if user is in same team as owner.
    const { data: me } = await supabase.from('users').select('team_id, role').eq('id', userId).maybeSingle();
    const myTeamId = (me as any)?.team_id || null;

    // Basic fetch: all activities linked to entity
    const { data: links, error: linkErr } = await supabase
      .from('activity_link')
      .select('activity_id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    if (linkErr) { res.status(500).json({ error: linkErr.message }); return; }
    const ids = (links || []).map((r: any) => r.activity_id);
    if (!ids.length) { res.json({ rows: [], count: 0 }); return; }

    let q = supabase
      .from('activities')
      .select('id, actor_user_id, type, title, body, occurred_at, created_at, org_id')
      .in('id', ids)
      .order('occurred_at', { ascending: false });

    // Optional org filter: if org_id present on activities, require matching team
    if (myTeamId) {
      q = q.or(`org_id.is.null,org_id.eq.${myTeamId}`);
    }

    const { data: activities, error } = await q;
    if (error) { res.status(500).json({ error: error.message }); return; }

    logger.info({ route: '/api/deals/activity', orgId: myTeamId || null, action: 'list', ok: true, count: (activities || []).length });
    res.json({ rows: activities || [], count: (activities || []).length });
  } catch (e: any) {
    logger.error({ route: '/api/deals/activity', action: 'error', ok: false, error: e?.message });
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

export default router;


