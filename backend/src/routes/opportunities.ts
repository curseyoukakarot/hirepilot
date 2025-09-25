import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = express.Router();

async function getRoleTeam(userId: string): Promise<{ role: string; team_id: string | null }> {
  const { data } = await supabase.from('users').select('role, team_id').eq('id', userId).maybeSingle();
  return { role: String((data as any)?.role || ''), team_id: (data as any)?.team_id || null };
}

async function canViewOpportunities(userId: string): Promise<boolean> {
  const { role, team_id } = await getRoleTeam(userId);
  const lc = String(role || '').toLowerCase();
  if (['super_admin','superadmin'].includes(lc)) return true;
  // Block Free plan explicitly (do not gate on missing/unknown)
  try {
    const { data: sub } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier = String((sub as any)?.plan_tier || '').toLowerCase();
    if (tier === 'free') return false;
    if (!tier) {
      const { data: usr } = await supabase.from('users').select('plan').eq('id', userId).maybeSingle();
      const plan = String((usr as any)?.plan || '').toLowerCase();
      if (plan === 'free') return false;
    }
  } catch {}
  // Team members (non-admin) use explicit permissions only for Team plan
  try {
    const { data: sub2 } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier2 = String((sub2 as any)?.plan_tier || '').toLowerCase();
    if (tier2 === 'team' && team_id && lc !== 'team_admin') {
    const { data } = await supabase.from('deal_permissions').select('can_view_opportunities').eq('user_id', userId).maybeSingle();
    return Boolean((data as any)?.can_view_opportunities);
    }
  } catch {}
  // Everyone else (paid roles, including team_admin, recruitpro, member, admin)
  return true;
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

    type ClientLite = { id: string; name?: string | null; domain?: string | null };
    const clientMap: Map<string, ClientLite> = new Map<string, ClientLite>(
      ((clients || []) as any[]).map((c: any) => [String(c.id), { id: String(c.id), name: c.name ?? null, domain: c.domain ?? null }])
    );
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
      const clientRow = clientMap.get(String(o.client_id)) as ClientLite | undefined;
      const company = (clientRow?.name || clientRow?.domain || '') as string;
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

// GET /api/opportunities/:id (detail)
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const { data: opp, error } = await supabase.from('opportunities').select('*').eq('id', id).maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!opp) { res.status(404).json({ error: 'not_found' }); return; }

    // fetch req links
    const { data: links } = await supabase.from('opportunity_job_reqs').select('req_id').eq('opportunity_id', id);
    // fetch client and owner
    const [{ data: clientRow }, { data: ownerRow }] = await Promise.all([
      opp.client_id ? supabase.from('clients').select('id,name,domain').eq('id', opp.client_id).maybeSingle() : Promise.resolve({ data: null }),
      opp.owner_id ? supabase.from('users').select('id,first_name,last_name,email').eq('id', opp.owner_id).maybeSingle() : Promise.resolve({ data: null })
    ] as any);
    const owner_name = ownerRow ? [ownerRow.first_name, ownerRow.last_name].filter(Boolean).join(' ') || ownerRow.email : null;
    res.json({ ...opp, req_ids: (links||[]).map((l:any)=>l.req_id), client: clientRow, owner: { id: ownerRow?.id, name: owner_name, email: ownerRow?.email } });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// PATCH /api/opportunities/:id/notes
router.patch('/:id/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const { notes } = req.body || {};
    const { data, error } = await supabase.from('opportunities').update({ notes: notes ?? null }).eq('id', id).select('id,notes').maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// Activity log (simple)
router.get('/:id/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('opportunity_activity').select('*').eq('opportunity_id', id).order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

router.post('/:id/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const { message } = req.body || {};
    const { data, error } = await supabase.from('opportunity_activity').insert({ opportunity_id: id, user_id: userId, message, created_at: new Date().toISOString() }).select('*').single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// Collaborators (basic by email)
router.get('/:id/collaborators', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('opportunity_collaborators').select('*').eq('opportunity_id', id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

router.post('/:id/collaborators', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body || {};
    const { data, error } = await supabase.from('opportunity_collaborators').insert({ opportunity_id: id, email, role: role || 'collaborator', created_at: new Date().toISOString() }).select('*').single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// Invite guest collaborator for a Job REQ (email)
  router.post('/:id/guest-invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const inviterId = (req as any).user?.id as string | undefined;
    if (!inviterId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params; // job req id
      const { email, role } = req.body || {};
    if (!email) return res.status(400).json({ error: 'missing_email' });

      const normalizedEmail = String(email).toLowerCase();
      const allowedRoles = new Set(['View Only','Commenter','View + Comment']);
      const roleToUse = allowedRoles.has(String(role)) ? String(role) : 'View Only';

      // Ensure single row by (job_id, email) without requiring a DB unique constraint
      const { data: existing } = await supabase
        .from('job_guest_collaborators')
        .select('id')
        .eq('job_id', id)
        .eq('email', normalizedEmail)
        .maybeSingle();
      let row: any = null;
      if (existing?.id) {
        const { data: upd, error: upErr } = await supabase
          .from('job_guest_collaborators')
          .update({ invited_by: inviterId, role: roleToUse })
          .eq('id', existing.id)
          .select('*')
          .maybeSingle();
        if (upErr) return res.status(500).json({ error: upErr.message });
        row = upd;
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('job_guest_collaborators')
          .insert({ job_id: id, email: normalizedEmail, role: roleToUse, invited_by: inviterId, created_at: new Date().toISOString() })
          .select('*')
          .maybeSingle();
        if (insErr) return res.status(500).json({ error: insErr.message });
        row = ins;
      }
    // server-side log (not subject to client RLS)
    try {
        await supabase.from('job_activity_log').insert({ job_id: id, actor_id: inviterId, type: 'guest_invited', metadata: { email: normalizedEmail, role: roleToUse }, created_at: new Date().toISOString() });
    } catch {}
      res.json(row || {});
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// List selectable job reqs for the user's scope (name sorted)
router.get('/:id/available-reqs', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';
    let base = supabase.from('job_requisitions').select('id,title,user_id');
    if (!isSuper) {
      if (isTeamAdmin && team_id) {
        const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
        const ids = (teamUsers || []).map((u: any) => u.id);
        base = base.in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else {
        base = base.eq('user_id', userId);
      }
    }
    const { data, error } = await base.order('title', { ascending: true });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// List users visible to Team Admin for assigning
router.get('/:id/available-users', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    if (role.toLowerCase() !== 'team_admin' || !team_id) { res.json([]); return; }
    const { data, error } = await supabase.from('users').select('id,first_name,last_name,email').eq('team_id', team_id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const rows = (data||[]).map((u:any)=>({ id: u.id, name: [u.first_name,u.last_name].filter(Boolean).join(' ') || u.email, email: u.email }));
    res.json(rows);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
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


