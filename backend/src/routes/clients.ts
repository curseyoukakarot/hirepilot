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
      .select('id,name,domain,industry,revenue,location,owner_id,created_at,stage,notes');

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
    const fields = ['name','domain','industry','revenue','location','owner_id','stage','notes'];
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

    // Derive company info from enrichment if available
    const enrich: any = (lead as any).enrichment_data || {};
    const apolloOrg = enrich?.apollo?.organization || {};
    const domainFromEnrich = apolloOrg.website_url || apolloOrg.domain || null;
    const industryFromEnrich = apolloOrg.industry || null;
    const locationFromEnrich = apolloOrg.location || (enrich?.apollo?.location?.city ? `${enrich.apollo.location.city}${enrich.apollo.location.state ? ', ' + enrich.apollo.location.state : ''}` : null);
    const revenueFromEnrichRaw = apolloOrg.estimated_annual_revenue || apolloOrg.revenue || null;
    const revenueFromEnrich = revenueFromEnrichRaw ? parseRevenueToNumber(revenueFromEnrichRaw) : null;

    // Create client from lead + enrichment
    const insertClient = {
      name: lead.company || apolloOrg.name || 'Untitled Company',
      domain: domainFromEnrich || null,
      industry: industryFromEnrich || null,
      revenue: revenueFromEnrich,
      location: locationFromEnrich || (lead as any).location || null,
      owner_id: userId,
      created_at: new Date().toISOString()
    } as any;
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
// Helper: normalize revenue strings (e.g. "300K", "22.7M", "$1,200,000") → number
function parseRevenueToNumber(value: any): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const str = String(value).trim().toUpperCase();
  const multiplier = str.endsWith('B') ? 1_000_000_000 : str.endsWith('M') ? 1_000_000 : str.endsWith('K') ? 1_000 : 1;
  const cleaned = str.replace(/[^0-9.]/g, '');
  const num = Number(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * multiplier);
}

// POST /api/clients/:id/sync-enrichment
router.post('/:id/sync-enrichment', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewClients(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const overrideExisting = Boolean(req.body?.override);
    const hintName: string | undefined = req.body?.name;
    const hintDomain: string | undefined = req.body?.domain;
    const specificLeadId: string | undefined = req.body?.lead_id;

    // Fetch client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (clientErr) { res.status(500).json({ error: clientErr.message }); return; }
    if (!client) { res.status(404).json({ error: 'client_not_found' }); return; }

    // If a specific lead is requested, try that first
    let chosen: any = null;
    if (specificLeadId) {
      const { data: leadById } = await supabase
        .from('leads')
        .select('id, company, enrichment_data, owner_id, updated_at')
        .eq('id', specificLeadId)
        .maybeSingle();
      if (leadById?.enrichment_data?.apollo?.organization) {
        chosen = leadById;
      }
    }

    // Find a matching enriched lead for this client (owner/team scoped)
    if (!chosen) {
      // Search across recent leads. We do not rely on owner scoping since leads may not have owner_id
      let query = supabase
        .from('leads')
        .select('id, company, enrichment_data, updated_at')
        .order('updated_at', { ascending: false })
        .limit(500);

      const { data: leads, error: leadsErr } = await query;
      if (leadsErr) { res.status(500).json({ error: leadsErr.message }); return; }

      const clientName = (hintName || (client as any).name || '').toLowerCase();
      const clientDomain = (hintDomain || (client as any).domain || '').toLowerCase();

      const normalizeDomain = (d: string) => d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

      for (const l of (leads || [])) {
        const enrich = (l as any).enrichment_data || {};
        const org = enrich?.apollo?.organization || {};
        const name = String(org.name || l.company || '').toLowerCase();
        const website = String(org.website_url || org.domain || '').toLowerCase();
        const websiteNorm = website ? normalizeDomain(website) : '';
        const matchByDomain = clientDomain && websiteNorm && normalizeDomain(clientDomain) === websiteNorm;
        const matchByName = clientName && name.includes(clientName);
        const hasUseful = org && (org.website_url || org.domain || org.industry || org.estimated_annual_revenue || org.revenue);
        if ((matchByDomain || matchByName) && hasUseful) { chosen = l; break; }
      }
    }
    if (!chosen) { res.status(404).json({ error: 'no_enriched_lead_found' }); return; }

    const org = chosen.enrichment_data?.apollo?.organization || {};
    const locationFromEnrich = org.location || chosen.enrichment_data?.apollo?.location || null;
    const revenueParsed = parseRevenueToNumber(org.estimated_annual_revenue || org.revenue);

    const update: any = {};
    if (overrideExisting || !client.domain) update.domain = org.website_url || org.domain || client.domain || null;
    if (overrideExisting || !client.industry) update.industry = org.industry || client.industry || null;
    if (overrideExisting || !client.location) {
      if (typeof locationFromEnrich === 'string') update.location = locationFromEnrich;
    }
    if (overrideExisting || !client.revenue) update.revenue = revenueParsed ?? client.revenue ?? null;

    if (Object.keys(update).length === 0) { res.json({ updated: false, client }); return; }

    const { data: updated, error: upErr } = await supabase
      .from('clients')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (upErr) { res.status(500).json({ error: upErr.message }); return; }
    res.json({ updated: true, client: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});


