import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import { ApiRequest } from '../../types/api';

const router = express.Router();
// GET /api/contacts alias mapping for this router (compat)
// Not mounted here to avoid path conflict; provided in contacts router.

async function getUserRoleAndTeam(userId: string): Promise<{ role: string; team_id: string | null }> {
  const { data } = await supabase
    .from('users')
    .select('role, team_id')
    .eq('id', userId)
    .maybeSingle();
  const role = (data as any)?.role || '';
  const team_id = (data as any)?.team_id || null;
  return { role, team_id };
}

async function canViewClients(userId: string): Promise<boolean> {
  // Super admin shortcut from users.role
  const { role } = await getUserRoleAndTeam(userId);
  const roleLc = String(role || '').toLowerCase();
  if (roleLc === 'super_admin' || roleLc === 'superadmin') return true;

  // Check deal_permissions flag
  const { data } = await supabase
    .from('deal_permissions')
    .select('can_view_clients')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean((data as any)?.can_view_clients);
}

// GET /api/clients - list allowed clients with contact counts
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const allowed = await canViewClients(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { role, team_id } = await getUserRoleAndTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(String(role || '').toLowerCase());
    const isTeamAdmin = String(role || '').toLowerCase() === 'team_admin';

    let base = supabase.from('clients')
      .select('id,name,domain,industry,revenue,location,owner_id,created_at');

    if (isSuper) {
      // No filter
    } else if (isTeamAdmin && team_id) {
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', team_id);
      const ids = (teamUsers || []).map((u: any) => u.id);
      base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else {
      base = base.eq('owner_id', userId);
    }

    const { data: clients, error } = await base.order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }

    // Compute contact counts per client
    const ids = (clients || []).map((c: any) => c.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: contactRows } = await supabase
        .from('contacts')
        .select('client_id, id')
        .in('client_id', ids);
      for (const row of (contactRows || [])) {
        const key = (row as any).client_id;
        counts[key] = (counts[key] || 0) + 1;
      }
    }

    const withCounts = (clients || []).map((c: any) => ({ ...c, contact_count: counts[c.id] || 0 }));
    res.json(withCounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// POST /api/clients - create client
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewClients(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { name, domain, industry, revenue, location, owner_id } = req.body || {};
    const insert = {
      name: name || null,
      domain: domain || null,
      industry: industry || null,
      revenue: revenue ?? null,
      location: location || null,
      owner_id: owner_id || userId,
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('clients')
      .insert(insert)
      .select('*')
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// PATCH /api/clients/:id - update client
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewClients(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const update: any = {};
    const fields = ['name','domain','industry','revenue','location','owner_id'];
    for (const f of fields) if (req.body?.[f] !== undefined) update[f] = req.body[f];
    const { data, error } = await supabase
      .from('clients')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!data) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// Contacts endpoints
router.get('/contacts/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewClients(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { role, team_id } = await getUserRoleAndTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(String(role || '').toLowerCase());
    const isTeamAdmin = String(role || '').toLowerCase() === 'team_admin';

    let base = supabase.from('contacts').select('*');
    if (isSuper) {
      // no filter
    } else if (isTeamAdmin && team_id) {
      const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
      const ids = (teamUsers || []).map((u: any) => u.id);
      base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else {
      base = base.eq('owner_id', userId);
    }
    const { data, error } = await base.order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

router.post('/contacts', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewClients(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { client_id, name, title, email, phone, owner_id } = req.body || {};
    if (!client_id) { res.status(400).json({ error: 'client_id required' }); return; }
    const insert = {
      client_id,
      name: name || null,
      title: title || null,
      email: email || null,
      phone: phone || null,
      owner_id: owner_id || userId,
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('contacts')
      .insert(insert)
      .select('*')
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;

// POST /api/clients/convert-lead - Lead → Client conversion
export async function convertLeadToClient(req: ApiRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { lead_id, include_contacts, contacts } = req.body || {};
    if (!lead_id) { res.status(400).json({ error: 'lead_id required' }); return; }

    // Fetch lead
    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).maybeSingle();
    if (!lead) { res.status(404).json({ error: 'lead_not_found' }); return; }

    // Create client from lead.company if present
    const insertClient = {
      name: lead.company || 'Untitled Company',
      domain: null as string | null,
      industry: null as string | null,
      revenue: null as number | null,
      location: lead.location || null,
      owner_id: userId,
      created_at: new Date().toISOString()
    };
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .insert(insertClient)
      .select('*')
      .single();
    if (clientErr || !clientRow) { res.status(500).json({ error: 'failed_create_client' }); return; }

    // Insert decision makers if requested
    if (include_contacts && Array.isArray(contacts) && contacts.length) {
      const rows = contacts.map((c: any) => ({
        client_id: clientRow.id,
        name: c.name || null,
        title: c.title || null,
        email: c.email || null,
        phone: c.phone || null,
        owner_id: userId,
        created_at: new Date().toISOString()
      }));
      await supabase.from('contacts').insert(rows);
    }

    // Archive lead (soft delete)
    await supabase
      .from('leads')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', lead_id);

    res.json({ success: true, client: clientRow });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}


