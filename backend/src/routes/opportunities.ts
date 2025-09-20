import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = express.Router();

async function getRoleTeam(userId: string): Promise<{ role: string; team_id: string | null }> {
  const { data } = await supabase.from('users').select('role, team_id').eq('id', userId).maybeSingle();
  return { role: String((data as any)?.role || ''), team_id: (data as any)?.team_id || null };
}

async function canViewOpportunities(userId: string): Promise<boolean> {
  const { role } = await getRoleTeam(userId);
  const lc = role.toLowerCase();
  if (['super_admin','superadmin'].includes(lc)) return true;
  const { data } = await supabase.from('deal_permissions').select('can_view_opportunities').eq('user_id', userId).maybeSingle();
  return Boolean((data as any)?.can_view_opportunities);
}

// GET /api/opportunities
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { role, team_id } = await getRoleTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    let base = supabase
      .from('opportunities')
      .select('id,title,value,billing_type,stage,status,owner_id,client_id,created_at');

    if (isSuper) {
      // no filter
    } else if (isTeamAdmin && team_id) {
      const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
      const ids = (teamUsers || []).map((u: any) => u.id);
      base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else {
      base = base.eq('owner_id', userId);
    }

    // Basic filters: status, client, search
    const status = String(req.query.status || '').trim();
    const client = String(req.query.client || '').trim();
    const search = String(req.query.search || '').trim();
    if (status) base = base.eq('stage', status);
    if (client) base = base.eq('client_id', client);

    const { data: opps, error } = await base.order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }

    const clientIds = Array.from(new Set((opps || []).map((o: any) => o.client_id).filter(Boolean)));
    const ownerIds = Array.from(new Set((opps || []).map((o: any) => o.owner_id).filter(Boolean)));
    const oppIds = Array.from(new Set((opps || []).map((o: any) => o.id)));

    const [{ data: clients }, { data: owners }, { data: links }] = await Promise.all([
      clientIds.length ? supabase.from('clients').select('id,name,domain').in('id', clientIds) : Promise.resolve({ data: [] as any }),
      ownerIds.length ? supabase.from('users').select('id,first_name,last_name,avatar_url').in('id', ownerIds) : Promise.resolve({ data: [] as any }),
      oppIds.length ? supabase.from('opportunity_job_reqs').select('opportunity_id,req_id').in('opportunity_id', oppIds) : Promise.resolve({ data: [] as any })
    ] as any);

    const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));
    const ownerMap = new Map((owners || []).map((u: any) => [u.id, u]));
    const reqMap = new Map<string, string[]>();
    for (const l of (links || [])) {
      const arr = reqMap.get(l.opportunity_id) || [];
      arr.push(l.req_id);
      reqMap.set(l.opportunity_id, arr);
    }

    // Optional search over title/company domain
    const filtered = (opps || []).filter((o: any) => {
      if (!search) return true;
      const company = clientMap.get(o.client_id)?.name || clientMap.get(o.client_id)?.domain || '';
      const tags = (reqMap.get(o.id) || []).join(' ');
      const s = search.toLowerCase();
      return String(o.title || '').toLowerCase().includes(s) || String(company).toLowerCase().includes(s) || tags.toLowerCase().includes(s);
    });

    const result = filtered.map((o: any) => ({
      ...o,
      client: clientMap.get(o.client_id) || null,
      owner: ownerMap.get(o.owner_id) || null,
      reqs: reqMap.get(o.id) || []
    }));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// POST /api/opportunities
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { title, client_id, stage, value, billing_type } = req.body || {};
    const insert = { title, client_id, stage, value, billing_type, status: 'open', owner_id: userId, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('opportunities').insert(insert).select('*').single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// PATCH /api/opportunities/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const up: any = {};
    const fields = ['title','client_id','stage','value','billing_type','status','owner_id'];
    for (const f of fields) if (req.body?.[f] !== undefined) up[f] = req.body[f];
    const { data, error } = await supabase.from('opportunities').update(up).eq('id', id).select('*').maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }

    // Update REQ links if provided
    if (Array.isArray(req.body?.req_ids)) {
      // delete existing and re-insert
      await supabase.from('opportunity_job_reqs').delete().eq('opportunity_id', id);
      const rows = (req.body.req_ids as string[]).map((reqId) => ({ opportunity_id: id, req_id: reqId }));
      if (rows.length) await supabase.from('opportunity_job_reqs').insert(rows);
    }

    res.json(data || {});
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/opportunities/stages
router.get('/stages', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { team_id } = await getRoleTeam(userId);
    const { data, error } = await supabase
      .from('opportunity_stages')
      .select('id,name,order_index,team_id')
      .eq('team_id', team_id)
      .order('order_index', { ascending: true });
    if (error) { res.status(500).json({ error: error.message }); return; }

    // Fallback defaults if none defined
    const defaults = ["Pipeline","Best Case","Commit","Close Won","Closed Lost"].map((name, i) => ({ id: `default_${i}`, name, order_index: i }));
    res.json((data && data.length) ? data : defaults);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;


