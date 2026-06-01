import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

type IgniteRole = 'ignite_admin' | 'ignite_team' | 'ignite_client';

type IgniteContext = {
  userId: string;
  workspaceId: string | null;
  roles: Set<string>;
  isTeam: boolean;
  clientIds: Set<string>;
};

type ApiRequest = Request & {
  user?: { id?: string; role?: string | null };
  workspaceId?: string | null;
  igniteContext?: IgniteContext;
};

const ALLOWED_ROLES = new Set<string>(['ignite_admin', 'ignite_team', 'ignite_client']);
const VALID_KIND = new Set(['internal', 'external']);
const VALID_STATUS = new Set(['draft', 'planning', 'live', 'closed']);
const VALID_SPONSOR_KIND = new Set(['cash', 'in_kind']);
const VALID_SPONSOR_STATUS = new Set(['prospect', 'committed', 'invoiced', 'paid']);
const VALID_COST_STATUS = new Set(['budgeted', 'committed', 'invoiced', 'paid']);
const VALID_DOC_TYPE = new Set(['beo', 'invoice', 'contract', 'quote', 'misc']);

function normalizeRole(value: any): string {
  return String(value || '').toLowerCase().replace(/[\s-]/g, '_');
}

function getUserId(req: ApiRequest): string | null {
  const value = (req as any)?.user?.id || req.headers['x-user-id'];
  return value ? String(value) : null;
}

function isLocalOrigin(value: string): boolean {
  return value.includes('localhost') || value.includes('127.0.0.1');
}

function hostAllowedByHeaders(req: Request, expectedHost: string): boolean {
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  const expected = String(expectedHost || '').toLowerCase();
  if (!expected) return true;
  if (!origin && !referer) return true;
  if (isLocalOrigin(origin) || isLocalOrigin(referer)) return true;
  return origin.includes(expected) || referer.includes(expected);
}

async function buildIgniteContext(req: ApiRequest): Promise<IgniteContext | null> {
  const userId = getUserId(req);
  if (!userId) return null;
  const workspaceId = (req as any)?.workspaceId ? String((req as any).workspaceId) : null;
  const { data, error } = await supabase
    .from('ignite_client_users')
    .select('client_id,role,status')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  const memberships = (data || []) as Array<{ client_id: string | null; role: IgniteRole; status: string }>;
  const roles = new Set<string>();
  const clientIds = new Set<string>();
  for (const row of memberships) {
    const role = normalizeRole(row.role);
    if (ALLOWED_ROLES.has(role)) roles.add(role);
    if (row.client_id) clientIds.add(String(row.client_id));
  }
  return {
    userId,
    workspaceId,
    roles,
    isTeam: roles.has('ignite_admin') || roles.has('ignite_team'),
    clientIds,
  };
}

async function requireIgniteAccess(req: ApiRequest, res: Response, next: NextFunction) {
  try {
    const expectedHost = String(process.env.IGNITE_HOSTNAME || 'clients.ignitegtm.com');
    if (!hostAllowedByHeaders(req, expectedHost)) {
      return res.status(403).json({ error: 'ignite_hostname_forbidden' });
    }
    const ctx = await buildIgniteContext(req);
    if (!ctx) return res.status(401).json({ error: 'unauthorized' });
    if (!ctx.roles.size) return res.status(403).json({ error: 'ignite_access_denied' });
    req.igniteContext = ctx;
    return next();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'ignite_access_check_failed' });
  }
}

function requireIgniteTeam(req: ApiRequest, res: Response, next: NextFunction) {
  const ctx = req.igniteContext;
  if (!ctx?.isTeam) return res.status(403).json({ error: 'ignite_team_required' });
  return next();
}

async function getEventOr404(eventId: string, res: Response) {
  const { data, error } = await supabase
    .from('ignite_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  if (!data) {
    res.status(404).json({ error: 'event_not_found' });
    return null;
  }
  return data;
}

function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nullableString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function buildEventInsertPayload(body: any, ctx: IgniteContext) {
  const kindRaw = String(body?.kind || 'internal').toLowerCase();
  const kind = VALID_KIND.has(kindRaw) ? kindRaw : 'internal';
  const statusRaw = String(body?.status || 'draft').toLowerCase();
  const status = VALID_STATUS.has(statusRaw) ? statusRaw : 'draft';
  return {
    workspace_id: ctx.workspaceId,
    client_id: nullableString(body?.client_id),
    kind,
    status,
    name: String(body?.name || 'Untitled Event').trim() || 'Untitled Event',
    client_name_override: nullableString(body?.client_name_override ?? body?.client_name),
    start_date: nullableString(body?.start_date),
    end_date: nullableString(body?.end_date),
    city: nullableString(body?.city),
    venue: nullableString(body?.venue),
    headcount: Math.max(0, Math.floor(toNumber(body?.headcount, 0))),
    primary_contact: nullableString(body?.primary_contact),
    owner_name: nullableString(body?.owner_name),
    description: nullableString(body?.description),
    target_margin_pct: toNumber(body?.target_margin_pct, 20),
    metadata_json: body?.metadata_json && typeof body.metadata_json === 'object' ? body.metadata_json : {},
    created_by: ctx.userId,
    updated_by: ctx.userId,
  };
}

function buildEventUpdatePayload(body: any, ctx: IgniteContext) {
  const patch: Record<string, any> = { updated_by: ctx.userId };
  if (body?.kind !== undefined) {
    const kind = String(body.kind).toLowerCase();
    if (VALID_KIND.has(kind)) patch.kind = kind;
  }
  if (body?.status !== undefined) {
    const status = String(body.status).toLowerCase();
    if (VALID_STATUS.has(status)) patch.status = status;
  }
  if (body?.name !== undefined) patch.name = String(body.name || '').trim() || 'Untitled Event';
  if (body?.client_id !== undefined) patch.client_id = nullableString(body.client_id);
  if (body?.client_name_override !== undefined || body?.client_name !== undefined) {
    patch.client_name_override = nullableString(body?.client_name_override ?? body?.client_name);
  }
  if (body?.start_date !== undefined) patch.start_date = nullableString(body.start_date);
  if (body?.end_date !== undefined) patch.end_date = nullableString(body.end_date);
  if (body?.city !== undefined) patch.city = nullableString(body.city);
  if (body?.venue !== undefined) patch.venue = nullableString(body.venue);
  if (body?.headcount !== undefined) patch.headcount = Math.max(0, Math.floor(toNumber(body.headcount, 0)));
  if (body?.primary_contact !== undefined) patch.primary_contact = nullableString(body.primary_contact);
  if (body?.owner_name !== undefined) patch.owner_name = nullableString(body.owner_name);
  if (body?.description !== undefined) patch.description = nullableString(body.description);
  if (body?.target_margin_pct !== undefined) patch.target_margin_pct = toNumber(body.target_margin_pct, 20);
  if (body?.metadata_json !== undefined && typeof body.metadata_json === 'object') {
    patch.metadata_json = body.metadata_json;
  }
  return patch;
}

function buildSponsorRow(eventId: string, sponsor: any, sortOrder: number) {
  const kindRaw = String(sponsor?.kind || 'cash').toLowerCase();
  const kind = VALID_SPONSOR_KIND.has(kindRaw) ? kindRaw : 'cash';
  const statusRaw = String(sponsor?.status || 'prospect').toLowerCase();
  const status = VALID_SPONSOR_STATUS.has(statusRaw) ? statusRaw : 'prospect';
  return {
    event_id: eventId,
    name: String(sponsor?.name || '').trim(),
    kind,
    amount: toNumber(sponsor?.amount, 0),
    status,
    contact: nullableString(sponsor?.contact),
    notes: nullableString(sponsor?.notes),
    referral_owner: nullableString(sponsor?.referral_owner ?? sponsor?.referralOwner),
    referral_percent: nullableNumber(sponsor?.referral_percent ?? sponsor?.referralPercent),
    sort_order: sortOrder,
    metadata_json:
      sponsor?.metadata_json && typeof sponsor.metadata_json === 'object' ? sponsor.metadata_json : {},
  };
}

function buildCostRow(eventId: string, cost: any, sortOrder: number) {
  const statusRaw = String(cost?.status || 'budgeted').toLowerCase();
  const status = VALID_COST_STATUS.has(statusRaw) ? statusRaw : 'budgeted';
  return {
    event_id: eventId,
    category: String(cost?.category || 'Other').trim() || 'Other',
    description: String(cost?.description || '').trim(),
    vendor: nullableString(cost?.vendor),
    qty: toNumber(cost?.qty, 1),
    unit_cost: toNumber(cost?.unit_cost ?? cost?.unitCost, 0),
    status,
    notes: nullableString(cost?.notes),
    sort_order: sortOrder,
    metadata_json:
      cost?.metadata_json && typeof cost.metadata_json === 'object' ? cost.metadata_json : {},
  };
}

async function loadEventBundle(eventId: string) {
  const [eventRes, sponsorsRes, costsRes, docsRes] = await Promise.all([
    supabase.from('ignite_events').select('*').eq('id', eventId).maybeSingle(),
    supabase
      .from('ignite_event_sponsors')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('ignite_event_costs')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('ignite_event_documents')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
  ]);
  if (eventRes.error) throw new Error(eventRes.error.message);
  if (sponsorsRes.error) throw new Error(sponsorsRes.error.message);
  if (costsRes.error) throw new Error(costsRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);
  return {
    event: eventRes.data,
    sponsors: sponsorsRes.data || [],
    costs: costsRes.data || [],
    documents: docsRes.data || [],
  };
}

function summarizeEvent(event: any, sponsors: any[], costs: any[]) {
  const cashRevenue = sponsors
    .filter((sponsor) => String(sponsor?.kind || 'cash') === 'cash')
    .reduce((sum, sponsor) => sum + toNumber(sponsor?.amount, 0), 0);
  const inKindValue = sponsors
    .filter((sponsor) => String(sponsor?.kind || 'cash') === 'in_kind')
    .reduce((sum, sponsor) => sum + toNumber(sponsor?.amount, 0), 0);
  const totalCosts = costs.reduce(
    (sum, cost) => sum + toNumber(cost?.qty, 0) * toNumber(cost?.unit_cost, 0),
    0
  );
  const margin = cashRevenue - totalCosts;
  const marginPct = cashRevenue > 0 ? (margin / cashRevenue) * 100 : 0;
  return {
    cash_revenue: cashRevenue,
    in_kind_value: inKindValue,
    total_costs: totalCosts,
    margin,
    margin_pct: marginPct,
    sponsor_count: sponsors.length,
    cost_line_count: costs.length,
  };
}

const router = Router();

router.use(requireIgniteAccess as any);

router.get('/', async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    if (!ctx.isTeam) return res.json({ events: [] });
    let query = supabase
      .from('ignite_events')
      .select('*')
      .order('updated_at', { ascending: false });
    if (ctx.workspaceId) query = query.eq('workspace_id', ctx.workspaceId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const events = data || [];
    if (events.length === 0) return res.json({ events: [] });

    const eventIds = events.map((event: any) => event.id);
    const [sponsorRes, costRes] = await Promise.all([
      supabase.from('ignite_event_sponsors').select('event_id,kind,amount').in('event_id', eventIds),
      supabase.from('ignite_event_costs').select('event_id,qty,unit_cost').in('event_id', eventIds),
    ]);
    if (sponsorRes.error) return res.status(500).json({ error: sponsorRes.error.message });
    if (costRes.error) return res.status(500).json({ error: costRes.error.message });

    const sponsorByEvent = new Map<string, any[]>();
    for (const row of sponsorRes.data || []) {
      const list = sponsorByEvent.get(String(row.event_id)) || [];
      list.push(row);
      sponsorByEvent.set(String(row.event_id), list);
    }
    const costByEvent = new Map<string, any[]>();
    for (const row of costRes.data || []) {
      const list = costByEvent.get(String(row.event_id)) || [];
      list.push(row);
      costByEvent.set(String(row.event_id), list);
    }

    const enriched = events.map((event: any) => {
      const eSponsors = sponsorByEvent.get(String(event.id)) || [];
      const eCosts = costByEvent.get(String(event.id)) || [];
      return { ...event, totals: summarizeEvent(event, eSponsors, eCosts) };
    });
    return res.json({ events: enriched });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_events' });
  }
});

router.post('/', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const payload = buildEventInsertPayload(req.body || {}, ctx);
    if (!payload.name) return res.status(400).json({ error: 'name_required' });
    const { data, error } = await supabase
      .from('ignite_events')
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ event: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_event' });
  }
});

router.get('/:id', async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    if (!ctx.isTeam) return res.status(403).json({ error: 'ignite_team_required' });
    const eventId = String(req.params.id || '');
    const event = await getEventOr404(eventId, res);
    if (!event) return;
    const bundle = await loadEventBundle(eventId);
    const totals = summarizeEvent(bundle.event, bundle.sponsors, bundle.costs);
    return res.json({ ...bundle, totals });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_event' });
  }
});

router.patch('/:id', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const eventId = String(req.params.id || '');
    const event = await getEventOr404(eventId, res);
    if (!event) return;
    const patch = buildEventUpdatePayload(req.body || {}, ctx);
    const { data, error } = await supabase
      .from('ignite_events')
      .update(patch)
      .eq('id', eventId)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ event: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_event' });
  }
});

router.delete('/:id', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const eventId = String(req.params.id || '');
    const event = await getEventOr404(eventId, res);
    if (!event) return;
    const { error } = await supabase
      .from('ignite_events')
      .update({ status: 'closed' })
      .eq('id', eventId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_archive_event' });
  }
});

router.put('/:id/sponsors', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const eventId = String(req.params.id || '');
    const event = await getEventOr404(eventId, res);
    if (!event) return;
    const incoming = Array.isArray(req.body?.sponsors) ? req.body.sponsors : [];
    const rows = incoming
      .filter((sponsor: any) => sponsor && String(sponsor?.name || '').trim())
      .map((sponsor: any, index: number) => buildSponsorRow(eventId, sponsor, index));
    const { error: deleteError } = await supabase
      .from('ignite_event_sponsors')
      .delete()
      .eq('event_id', eventId);
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('ignite_event_sponsors').insert(rows);
      if (insertError) return res.status(500).json({ error: insertError.message });
    }
    const { data: refreshed, error: fetchError } = await supabase
      .from('ignite_event_sponsors')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });
    if (fetchError) return res.status(500).json({ error: fetchError.message });
    return res.json({ sponsors: refreshed || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_replace_sponsors' });
  }
});

router.put('/:id/costs', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const eventId = String(req.params.id || '');
    const event = await getEventOr404(eventId, res);
    if (!event) return;
    const incoming = Array.isArray(req.body?.costs) ? req.body.costs : [];
    const rows = incoming
      .filter((cost: any) => cost && String(cost?.description || '').trim())
      .map((cost: any, index: number) => buildCostRow(eventId, cost, index));
    const { error: deleteError } = await supabase
      .from('ignite_event_costs')
      .delete()
      .eq('event_id', eventId);
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('ignite_event_costs').insert(rows);
      if (insertError) return res.status(500).json({ error: insertError.message });
    }
    const { data: refreshed, error: fetchError } = await supabase
      .from('ignite_event_costs')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });
    if (fetchError) return res.status(500).json({ error: fetchError.message });
    return res.json({ costs: refreshed || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_replace_costs' });
  }
});

router.post('/:id/documents', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const eventId = String(req.params.id || '');
    const event = await getEventOr404(eventId, res);
    if (!event) return;
    const body = req.body || {};
    const docTypeRaw = String(body?.doc_type || body?.type || 'misc').toLowerCase();
    const docType = VALID_DOC_TYPE.has(docTypeRaw) ? docTypeRaw : 'misc';
    const name = String(body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name_required' });
    const { data, error } = await supabase
      .from('ignite_event_documents')
      .insert({
        event_id: eventId,
        name,
        doc_type: docType,
        file_url: nullableString(body?.file_url),
        file_path: nullableString(body?.file_path),
        uploaded_by: ctx.userId,
        uploaded_by_name: nullableString(body?.uploaded_by_name),
        metadata_json:
          body?.metadata_json && typeof body.metadata_json === 'object' ? body.metadata_json : {},
      })
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ document: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_document' });
  }
});

// POST /:id/convert-to-proposal — one-click: create a draft proposal seeded
// from this event. Auto-creates a client when the event has none.
router.post('/:id/convert-to-proposal', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const eventId = String(req.params.id || '');
    const event = await getEventOr404(eventId, res);
    if (!event) return;

    const bundle = await loadEventBundle(eventId);
    const sponsors = bundle.sponsors || [];
    const costs = bundle.costs || [];

    // 1) Resolve (or auto-create) the client this proposal belongs to.
    let clientId = event.client_id ? String(event.client_id) : '';
    let createdClient = false;
    if (!clientId) {
      const clientName =
        nullableString(event.client_name_override) ||
        `${String(event.name || 'Untitled Event')} Client`;
      const { data: newClient, error: clientError } = await supabase
        .from('ignite_clients')
        .insert({
          workspace_id: event.workspace_id ?? ctx.workspaceId,
          name: clientName,
          metadata_json: { created_from_event_id: eventId, source: 'event_conversion' },
          created_by: ctx.userId,
        })
        .select('id')
        .maybeSingle();
      if (clientError) return res.status(500).json({ error: clientError.message });
      clientId = newClient?.id ? String(newClient.id) : '';
      createdClient = true;
      if (!clientId) return res.status(500).json({ error: 'failed_to_auto_create_client' });
      // Link the event to the freshly created client for future reference.
      await supabase.from('ignite_events').update({ client_id: clientId, kind: 'external' }).eq('id', eventId);
    }

    // 2) Build the proposal assumptions/settings from the event datapoints.
    const cashSponsors = sponsors.filter((s: any) => String(s?.kind || 'cash') === 'cash');
    const primarySponsor = cashSponsors[0]?.name ? String(cashSponsors[0].name) : null;
    const coSponsors = cashSponsors
      .slice(1)
      .map((s: any) => String(s?.name || '').trim())
      .filter(Boolean);

    const assumptionsJson = {
      event: {
        location: nullableString(event.venue) || '',
        venueAddress: nullableString(event.venue) || '',
        city: nullableString(event.city) || '',
        eventDate: nullableString(event.start_date) || '',
        startTime: '',
        endTime: '',
        headcount: Math.max(0, Math.floor(toNumber(event.headcount, 0))),
        primarySponsor,
        coSponsors,
        eventObjective: nullableString(event.description),
        successCriteria: [] as string[],
        source_event_id: eventId,
      },
      agreement: {
        depositPercent: 50,
        depositDueRule: null,
        balanceDueRule: null,
        cancellationWindowDays: 30,
        confidentialityEnabled: true,
        costSplitNotes: null,
        signerName: nullableString(event.primary_contact),
        signerEmail: null,
        signerTitle: null,
        signerCompany: nullableString(event.client_name_override),
      },
      serviceChargePercent: 0,
      salesTaxPercent: 0,
      taxAppliesAfterService: true,
      modelType: 'cost-plus',
      optionsCount: 1,
      quickTemplate: null,
      venuePreset: null,
      workflow: { lastStep: 1 },
    };

    const settingsJson = {
      igniteFeeRate: 0,
      contingencyRate: 0,
      turnkeyMethod: 'margin',
      targetMarginPercent: toNumber(event.target_margin_pct, 20),
      targetPrice: 0,
      saveAsDefault: false,
    };

    // 3) Create the draft proposal.
    const { data: proposal, error: proposalError } = await supabase
      .from('ignite_proposals')
      .insert({
        workspace_id: event.workspace_id ?? ctx.workspaceId,
        client_id: clientId,
        created_by: ctx.userId,
        updated_by: ctx.userId,
        name: String(event.name || 'Untitled Event Proposal'),
        status: 'draft',
        pricing_mode: 'cost_plus',
        currency: 'USD',
        assumptions_json: assumptionsJson,
        settings_json: settingsJson,
      })
      .select('*')
      .maybeSingle();
    if (proposalError) return res.status(500).json({ error: proposalError.message });
    if (!proposal?.id) return res.status(500).json({ error: 'failed_to_create_proposal' });
    const proposalId = String(proposal.id);

    // 4) Seed a single option and map event cost lines into it so the draft
    //    opens with the event's basic parameters already in place.
    const { data: option, error: optionError } = await supabase
      .from('ignite_proposal_options')
      .insert({
        proposal_id: proposalId,
        option_key: 'option_1',
        label: 'Option 1',
        sort_order: 0,
        is_enabled: true,
        pricing_mode: 'cost_plus',
        package_price: null,
        metadata_json: {},
      })
      .select('id')
      .maybeSingle();
    if (optionError) return res.status(500).json({ error: optionError.message });
    const optionId = option?.id ? String(option.id) : null;

    if (optionId && costs.length > 0) {
      const lineRows = costs.map((cost: any, index: number) => ({
        proposal_id: proposalId,
        option_id: optionId,
        category: String(cost?.category || 'Other'),
        line_name: String(cost?.description || cost?.category || 'Line item'),
        description: nullableString(cost?.notes),
        qty: toNumber(cost?.qty, 1),
        unit_cost: toNumber(cost?.unit_cost, 0),
        apply_service: false,
        service_rate: 0,
        apply_tax: false,
        tax_rate: 0,
        tax_applies_after_service: true,
        sort_order: index,
        is_hidden_from_client: false,
        metadata_json: { vendor: nullableString(cost?.vendor), display: 'DETAIL', source_cost_id: String(cost?.id || '') },
      }));
      const { error: lineError } = await supabase.from('ignite_proposal_line_items').insert(lineRows);
      if (lineError) return res.status(500).json({ error: lineError.message });
    }

    // 5) Back-reference the proposal on the event metadata.
    const existingMeta = (event.metadata_json && typeof event.metadata_json === 'object') ? event.metadata_json : {};
    await supabase
      .from('ignite_events')
      .update({ metadata_json: { ...existingMeta, proposal_id: proposalId } })
      .eq('id', eventId);

    return res.status(201).json({
      proposal,
      proposal_id: proposalId,
      client_id: clientId,
      created_client: createdClient,
      line_items_count: costs.length,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_convert_event' });
  }
});

router.delete('/:id/documents/:docId', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const eventId = String(req.params.id || '');
    const docId = String(req.params.docId || '');
    const event = await getEventOr404(eventId, res);
    if (!event) return;
    const { error } = await supabase
      .from('ignite_event_documents')
      .delete()
      .eq('event_id', eventId)
      .eq('id', docId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_delete_document' });
  }
});

export default router;
