import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import { ApiRequest } from '../../types/api';
import { getDealsSharingContext } from '../lib/teamDealsScope';
import { getUserTeamContext } from '../../api/team/teamContext';
import { isDealsEntitled } from '../lib/dealsEntitlement';

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
  return await isDealsEntitled(userId);
}

// GET /api/clients - list allowed clients with contact counts
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const allowed = await canViewClients(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    let base = supabase.from('clients')
      .select('id,name,domain,industry,revenue,location,owner_id,created_at,stage,notes,org_meta');

    // Scope by team deals pooling settings (default ON for teams)
    const ctx = await getDealsSharingContext(userId);
    const visible = ctx.visibleOwnerIds || [userId];
    base = base.in('owner_id', visible.length ? visible : [userId]);

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

    // Compute Monthly Revenue per client
    // Priority: paid recurring invoices (MRR) -> closed won opportunities -> projected (all except Closed Lost)
    const withCounts = (clients || []).map((c: any) => ({ ...c, contact_count: counts[c.id] || 0 }));
    if (!ids.length) { res.json(withCounts); return; }

    // Fetch related invoices and opportunities scoped to these clients
    const [invoicesResp, oppsResp] = await Promise.all([
      supabase
        .from('invoices')
        .select('client_id, amount, status, billing_type, paid_at, sent_at')
        .in('client_id', ids),
      supabase
        .from('opportunities')
        .select('client_id, value, stage, billing_type')
        .in('client_id', ids),
    ]);
    const invoices = invoicesResp.data || [];
    const opps = oppsResp.data || [];

    const recurringTypes = new Set(['retainer','rpo','subscription','recurring']);
    const isClosedWon = (s: any) => ['close won','closed won','won'].includes(String(s||'').toLowerCase());
    const isClosedLost = (s: any) => ['closed lost','close lost','lost'].includes(String(s||'').toLowerCase());
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
    const recentWindowStart = daysAgo(45);

    // Build maps for fast lookup
    const invByClient = new Map<string, any[]>();
    for (const r of invoices) {
      const k = String((r as any).client_id || '');
      if (!k) continue;
      if (!invByClient.has(k)) invByClient.set(k, []);
      invByClient.get(k)!.push(r);
    }
    const oppByClient = new Map<string, any[]>();
    for (const o of opps) {
      const k = String((o as any).client_id || '');
      if (!k) continue;
      if (!oppByClient.has(k)) oppByClient.set(k, []);
      oppByClient.get(k)!.push(o);
    }

    const computeMonthlyFromInvoices = (clientId: string): number => {
      const rows = invByClient.get(clientId) || [];
      // Use paid invoices of recurring types within a recent window to approximate active MRR
      return rows.reduce((sum, r: any) => {
        const type = String(r.billing_type || '').toLowerCase();
        const paid = String(r.status || '').toLowerCase() === 'paid';
        const ts = r.paid_at || r.sent_at;
        const dt = ts ? new Date(ts) : null;
        const recent = dt ? dt >= recentWindowStart : false;
        if (paid && recurringTypes.has(type) && recent) {
          return sum + (Number(r.amount) || 0);
        }
        return sum;
      }, 0);
    };

    const monthlyizeOpportunity = (o: any): number => {
      const type = String(o.billing_type || '').toLowerCase();
      const val = Number(o.value) || 0;
      // Treat retainers/RPO as monthly; otherwise convert annual-ish values to monthly
      return recurringTypes.has(type) ? val : (val / 12);
    };

    const computeMonthlyFromCloseWon = (clientId: string): number => {
      const rows = (oppByClient.get(clientId) || []).filter((o: any) => isClosedWon(o.stage));
      return rows.reduce((s, o) => s + monthlyizeOpportunity(o), 0);
    };

    const computeMonthlyProjected = (clientId: string): number => {
      // Include everything except Closed Lost
      const rows = (oppByClient.get(clientId) || []).filter((o: any) => !isClosedLost(o.stage));
      return rows.reduce((s, o) => s + monthlyizeOpportunity(o), 0);
    };

    const enriched = withCounts.map((c: any) => {
      const id = String(c.id);
      let monthly = 0;
      let status = 'projected';

      const fromInvoices = computeMonthlyFromInvoices(id);
      if (fromInvoices > 0) {
        monthly = fromInvoices;
        status = 'active';
      } else {
        const fromWon = computeMonthlyFromCloseWon(id);
        if (fromWon > 0) {
          monthly = fromWon;
          status = 'active';
        } else {
          monthly = computeMonthlyProjected(id);
          status = monthly > 0 ? 'projected' : 'projected';
        }
      }
      return { ...c, monthly_revenue: Math.round(monthly), monthly_revenue_status: status };
    });

    res.json(enriched);
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

    const { name, domain, industry, revenue, location } = req.body || {};
    const insert = {
      name: name || null,
      domain: domain || null,
      industry: industry || null,
      revenue: revenue ?? null,
      location: location || null,
      // SECURITY: Never allow creating clients for another user.
      owner_id: userId,
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
    // SECURITY: Never allow transferring ownership via API.
    const fields = ['name','domain','industry','revenue','location','stage','notes'];
    for (const f of fields) if (req.body?.[f] !== undefined) update[f] = req.body[f];
    const { data, error } = await supabase
      .from('clients')
      .update(update)
      .eq('id', id)
      .eq('owner_id', userId)
      .select('*')
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!data) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// DELETE /api/clients/:id - delete client (contacts cascade via FK)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewClients(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
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

    let base = supabase.from('contacts').select('*');
    const ctx = await getDealsSharingContext(userId);
    const visible = ctx.visibleOwnerIds || [userId];
    base = base.in('owner_id', visible.length ? visible : [userId]);
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

    const { client_id, name, title, email, phone } = req.body || {};
    if (!client_id) { res.status(400).json({ error: 'client_id required' }); return; }

    // SECURITY: Ensure the client belongs to this user before attaching contacts.
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('owner_id', userId)
      .maybeSingle();
    if (!clientRow) { res.status(404).json({ error: 'client_not_found' }); return; }

    const insert = {
      client_id,
      name: name || null,
      title: title || null,
      email: email || null,
      phone: phone || null,
      owner_id: userId,
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
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .maybeSingle();
    if (!lead) { res.status(404).json({ error: 'lead_not_found' }); return; }

    // Access: owner OR team_admin/admin in same team as lead owner.
    const leadOwnerId = String((lead as any).user_id || '');
    if (leadOwnerId && leadOwnerId !== userId) {
      const [meCtx, ownerCtx] = await Promise.all([
        getUserTeamContext(userId),
        getUserTeamContext(leadOwnerId)
      ]);
      const myTeam = meCtx.teamId || null;
      const ownerTeam = ownerCtx.teamId || null;
      const role = String(meCtx.role || '').toLowerCase();
      const privileged = ['team_admin', 'team_admins', 'admin', 'super_admin', 'superadmin'].includes(role);
      const sameTeam = Boolean(myTeam && ownerTeam && String(myTeam) === String(ownerTeam));
      if (!(privileged && sameTeam)) {
        // Don't leak existence
        res.status(404).json({ error: 'lead_not_found' });
        return;
      }
    }

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
      .eq('owner_id', userId)
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
    const revenueParsed = parseRevenueToNumber(
      org.organization_revenue_printed ||
      org.organization_revenue ||
      org.estimated_annual_revenue ||
      org.annual_revenue_printed ||
      org.annual_revenue ||
      chosen.enrichment_data?.apollo?.total_revenue || null
    );

    const update: any = {};
    if (overrideExisting || !client.domain) update.domain = org.website_url || org.domain || client.domain || null;
    if (overrideExisting || !client.industry) update.industry = org.industry || client.industry || null;
    if (overrideExisting || !client.location) {
      if (typeof locationFromEnrich === 'string') update.location = locationFromEnrich;
    }
    if (overrideExisting || !client.revenue) update.revenue = revenueParsed ?? client.revenue ?? null;
    // Save raw org meta for UI richness
    update.org_meta = { apollo: { organization: org, latest_funding_stage: chosen.enrichment_data?.apollo?.latest_funding_stage || null, total_funding_printed: chosen.enrichment_data?.apollo?.total_funding_printed || null } };

    if (Object.keys(update).length === 0) { res.json({ updated: false, client }); return; }

    const { data: updated, error: upErr } = await supabase
      .from('clients')
      .update(update)
      .eq('id', id)
      .eq('owner_id', userId)
      .select('*')
      .maybeSingle();
    if (upErr) { res.status(500).json({ error: upErr.message }); return; }
    res.json({ updated: true, client: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});


