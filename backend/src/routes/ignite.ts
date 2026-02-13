import * as crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import { computeProposal } from '../services/ignite/computeProposal';

type ApiRequest = Request & {
  user?: {
    id?: string;
    role?: string | null;
  };
  workspaceId?: string | null;
  igniteContext?: IgniteContext;
};

type IgniteMembershipRow = {
  client_id: string | null;
  role: 'ignite_admin' | 'ignite_team' | 'ignite_client';
  status: 'active' | 'invited' | 'disabled';
};

type IgniteContext = {
  userId: string;
  workspaceId: string | null;
  roles: Set<string>;
  isTeam: boolean;
  clientIds: Set<string>;
};

const router = Router();
const ALLOWED_IGNITE_ROLES = new Set(['ignite_admin', 'ignite_team', 'ignite_client']);

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

function sanitizeProposalForClient(payload: any) {
  const proposal = payload?.proposal || null;
  const options = Array.isArray(payload?.options) ? payload.options : [];
  const lineItems = Array.isArray(payload?.line_items) ? payload.line_items : [];
  const visibleLineItems = lineItems.filter((item) => item?.is_hidden_from_client !== true);
  return {
    proposal,
    options,
    line_items: visibleLineItems,
    computed_json: proposal?.computed_json || {}
  };
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
  const memberships = (data || []) as IgniteMembershipRow[];
  const roles = new Set<string>();
  const clientIds = new Set<string>();
  for (const row of memberships) {
    const role = normalizeRole(row.role);
    if (ALLOWED_IGNITE_ROLES.has(role)) roles.add(role);
    if (row.client_id) clientIds.add(String(row.client_id));
  }

  return {
    userId,
    workspaceId,
    roles,
    isTeam: roles.has('ignite_admin') || roles.has('ignite_team'),
    clientIds
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

async function getProposalOr404(proposalId: string, res: Response) {
  const { data, error } = await supabase
    .from('ignite_proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  if (!data) {
    res.status(404).json({ error: 'proposal_not_found' });
    return null;
  }
  return data;
}

function assertProposalScopeOr403(ctx: IgniteContext, proposal: any, res: Response): boolean {
  const clientId = String(proposal?.client_id || '');
  if (!clientId) {
    res.status(400).json({ error: 'proposal_client_missing' });
    return false;
  }
  if (ctx.isTeam) return true;
  if (!ctx.clientIds.has(clientId)) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

async function loadProposalBundle(proposalId: string) {
  const [proposalRes, optionsRes, lineItemsRes, versionsRes] = await Promise.all([
    supabase.from('ignite_proposals').select('*').eq('id', proposalId).maybeSingle(),
    supabase
      .from('ignite_proposal_options')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('ignite_proposal_line_items')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('ignite_proposal_versions')
      .select('id,proposal_id,version_number,label,created_at,created_by')
      .eq('proposal_id', proposalId)
      .order('version_number', { ascending: false })
  ]);
  if (proposalRes.error) throw new Error(proposalRes.error.message);
  if (optionsRes.error) throw new Error(optionsRes.error.message);
  if (lineItemsRes.error) throw new Error(lineItemsRes.error.message);
  if (versionsRes.error) throw new Error(versionsRes.error.message);

  return {
    proposal: proposalRes.data,
    options: optionsRes.data || [],
    line_items: lineItemsRes.data || [],
    versions: versionsRes.data || []
  };
}

function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}


// Public share-link resolver (token gated, no auth)
router.get('/share/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token_required' });

    const { data: link, error: linkError } = await supabase
      .from('ignite_share_links')
      .select('*')
      .eq('token', token)
      .is('revoked_at', null)
      .maybeSingle();
    if (linkError) return res.status(500).json({ error: linkError.message });
    if (!link) return res.status(404).json({ error: 'share_not_found' });

    const expiresAt = link.expires_at ? new Date(link.expires_at).getTime() : null;
    if (expiresAt && expiresAt < Date.now()) {
      return res.status(410).json({ error: 'share_expired' });
    }
    const maxAccessCount = toNumber(link.max_access_count, 0);
    const accessCount = toNumber(link.access_count, 0);
    if (maxAccessCount > 0 && accessCount >= maxAccessCount) {
      return res.status(410).json({ error: 'share_limit_reached' });
    }

    const bundle = await loadProposalBundle(String(link.proposal_id));
    if (!bundle?.proposal) return res.status(404).json({ error: 'proposal_not_found' });

    await supabase
      .from('ignite_share_links')
      .update({
        access_count: accessCount + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', link.id);

    return res.json({
      share: {
        id: link.id,
        token: link.token,
        expires_at: link.expires_at,
        proposal_id: link.proposal_id,
        client_id: link.client_id
      },
      ...sanitizeProposalForClient(bundle)
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_share' });
  }
});

// Public client signup (username/password) for Ignite portal
router.post('/client-signup', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const firstName = String(body.first_name || '').trim();
    const lastName = String(body.last_name || '').trim();
    const clientIdRaw = body.client_id ? String(body.client_id).trim() : '';

    if (!email) return res.status(400).json({ error: 'email_required' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'password_min_8' });
    if (!firstName || !lastName) return res.status(400).json({ error: 'name_required' });

    const canonicalRole = 'ignite_client';
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: canonicalRole,
        account_type: canonicalRole
      },
      app_metadata: {
        role: canonicalRole,
        allowed_roles: ['authenticated', canonicalRole]
      } as any
    } as any);

    if (createError) return res.status(500).json({ error: createError.message });
    const userId = created?.user?.id;
    if (!userId) return res.status(500).json({ error: 'user_creation_failed' });

    const { error: upsertUserError } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          email,
          firstName,
          lastName,
          role: canonicalRole,
          plan: canonicalRole,
          account_type: canonicalRole,
          onboardingComplete: false
        } as any,
        { onConflict: 'id' }
      );
    if (upsertUserError) return res.status(500).json({ error: upsertUserError.message });

    const membershipPayload = {
      user_id: userId,
      role: canonicalRole,
      status: 'active',
      client_id: clientIdRaw || null,
      workspace_id: null,
      created_by: userId
    };
    const { error: membershipError } = await supabase
      .from('ignite_client_users')
      .insert(membershipPayload as any);
    if (membershipError) return res.status(500).json({ error: membershipError.message });

    return res.status(201).json({ user: { id: userId, email, role: canonicalRole } });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_ignite_client' });
  }
});

router.use(requireAuth as any);
router.use(requireIgniteAccess as any);

// POST /ignite/proposals create draft
router.post('/proposals', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const body = req.body || {};
    const clientId = String(body.client_id || '').trim();
    const name = String(body.name || 'Untitled Proposal').trim();
    const pricingMode = normalizeRole(body.pricing_mode || 'cost_plus') === 'turnkey' ? 'turnkey' : 'cost_plus';
    const currency = String(body.currency || 'USD').trim().toUpperCase();
    if (!clientId) return res.status(400).json({ error: 'client_id_required' });

    const { data, error } = await supabase
      .from('ignite_proposals')
      .insert({
        workspace_id: ctx.workspaceId,
        client_id: clientId,
        created_by: ctx.userId,
        updated_by: ctx.userId,
        name,
        status: 'draft',
        pricing_mode: pricingMode,
        currency,
        assumptions_json: body.assumptions_json || {},
        settings_json: body.settings_json || {}
      })
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ proposal: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_proposal' });
  }
});

// Optional list endpoint for portal/backoffice views
router.get('/proposals', async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    let query = supabase
      .from('ignite_proposals')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!ctx.isTeam) {
      const clientIds = Array.from(ctx.clientIds);
      if (!clientIds.length) return res.json({ proposals: [] });
      query = query.in('client_id', clientIds);
    } else if (ctx.workspaceId) {
      query = query.eq('workspace_id', ctx.workspaceId);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ proposals: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_proposals' });
  }
});

// GET /ignite/proposals/:id
router.get('/proposals/:id', async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const proposalId = String(req.params.id || '');
    const proposal = await getProposalOr404(proposalId, res);
    if (!proposal) return;
    if (!assertProposalScopeOr403(ctx, proposal, res)) return;

    const bundle = await loadProposalBundle(proposalId);
    if (ctx.isTeam) return res.json(bundle);
    return res.json(sanitizeProposalForClient(bundle));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_proposal' });
  }
});

// PATCH /ignite/proposals/:id autosave patch
router.patch('/proposals/:id', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const proposalId = String(req.params.id || '');
    const proposal = await getProposalOr404(proposalId, res);
    if (!proposal) return;
    if (!assertProposalScopeOr403(ctx, proposal, res)) return;

    const body = req.body || {};
    const patch: Record<string, any> = {
      updated_by: ctx.userId,
      updated_at: new Date().toISOString()
    };
    const allowedKeys = [
      'name',
      'status',
      'pricing_mode',
      'currency',
      'assumptions_json',
      'settings_json'
    ];
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        patch[key] = body[key];
      }
    }

    const { data, error } = await supabase
      .from('ignite_proposals')
      .update(patch)
      .eq('id', proposalId)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ proposal: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_patch_proposal' });
  }
});

// PATCH /ignite/proposals/:id/costs
router.patch('/proposals/:id/costs', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const proposalId = String(req.params.id || '');
    const proposal = await getProposalOr404(proposalId, res);
    if (!proposal) return;
    if (!assertProposalScopeOr403(ctx, proposal, res)) return;

    const body = req.body || {};
    const optionsInput = Array.isArray(body.options) ? body.options : [];
    const lineItemsInput = Array.isArray(body.line_items) ? body.line_items : [];

    const normalizedOptions = optionsInput.map((option: any, index: number) => {
      const optionKey = String(option?.option_key || '').trim();
      return {
        option_key: optionKey || `option_${index + 1}`,
        label: String(option?.label || `Option ${index + 1}`),
        sort_order: Number.isFinite(Number(option?.sort_order)) ? Number(option.sort_order) : index,
        is_enabled: option?.is_enabled !== false,
        pricing_mode: normalizeRole(option?.pricing_mode) === 'turnkey' ? 'turnkey' : 'cost_plus',
        package_price:
          option?.package_price === null || option?.package_price === undefined
            ? null
            : toNumber(option.package_price, 0),
        metadata_json: option?.metadata_json && typeof option.metadata_json === 'object' ? option.metadata_json : {}
      };
    });

    await supabase.from('ignite_proposal_line_items').delete().eq('proposal_id', proposalId);
    await supabase.from('ignite_proposal_options').delete().eq('proposal_id', proposalId);

    let insertedOptions: any[] = [];
    if (normalizedOptions.length) {
      const { data: optionRows, error: optionError } = await supabase
        .from('ignite_proposal_options')
        .insert(
          normalizedOptions.map((option) => ({
            proposal_id: proposalId,
            ...option
          }))
        )
        .select('id,option_key');
      if (optionError) return res.status(500).json({ error: optionError.message });
      insertedOptions = optionRows || [];
    }

    const optionIdByKey = new Map<string, string>();
    for (const row of insertedOptions) {
      optionIdByKey.set(String(row.option_key), String(row.id));
    }

    const normalizedLineItems = lineItemsInput.map((item: any, index: number) => {
      const optionKey = String(item?.option_key || '').trim();
      const optionId = optionIdByKey.get(optionKey) || null;
      return {
        proposal_id: proposalId,
        option_id: optionId,
        category: String(item?.category || 'Other'),
        line_name: String(item?.line_name || 'Untitled line item'),
        description: item?.description ? String(item.description) : null,
        qty: toNumber(item?.qty, 0),
        unit_cost: toNumber(item?.unit_cost, 0),
        apply_service: Boolean(item?.apply_service),
        service_rate: toNumber(item?.service_rate, 0),
        apply_tax: Boolean(item?.apply_tax),
        tax_rate: toNumber(item?.tax_rate, 0),
        tax_applies_after_service: item?.tax_applies_after_service !== false,
        sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index,
        is_hidden_from_client: Boolean(item?.is_hidden_from_client),
        metadata_json: item?.metadata_json && typeof item.metadata_json === 'object' ? item.metadata_json : {}
      };
    });

    if (normalizedLineItems.length) {
      const { error: lineItemError } = await supabase
        .from('ignite_proposal_line_items')
        .insert(normalizedLineItems);
      if (lineItemError) return res.status(500).json({ error: lineItemError.message });
    }

    await supabase
      .from('ignite_proposals')
      .update({
        updated_by: ctx.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId);

    return res.json({
      proposal_id: proposalId,
      options_count: normalizedOptions.length,
      line_items_count: normalizedLineItems.length
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_sync_proposal_costs' });
  }
});

// POST /ignite/proposals/:id/compute
router.post('/proposals/:id/compute', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const proposalId = String(req.params.id || '');
    const bundle = await loadProposalBundle(proposalId);
    const proposal = bundle?.proposal;
    if (!proposal) return res.status(404).json({ error: 'proposal_not_found' });
    if (!assertProposalScopeOr403(ctx, proposal, res)) return;

    const computed = computeProposal(proposal, bundle.options, bundle.line_items);
    const { data, error } = await supabase
      .from('ignite_proposals')
      .update({
        computed_json: computed,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId)
      .select('id,computed_json,updated_at')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ computed: data?.computed_json || computed, proposal_id: proposalId });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_compute_proposal' });
  }
});

// POST /ignite/proposals/:id/version
router.post('/proposals/:id/version', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const proposalId = String(req.params.id || '');
    const bundle = await loadProposalBundle(proposalId);
    if (!bundle?.proposal) return res.status(404).json({ error: 'proposal_not_found' });
    if (!assertProposalScopeOr403(ctx, bundle.proposal, res)) return;

    const { data: maxVersionRows, error: versionErr } = await supabase
      .from('ignite_proposal_versions')
      .select('version_number')
      .eq('proposal_id', proposalId)
      .order('version_number', { ascending: false })
      .limit(1);
    if (versionErr) return res.status(500).json({ error: versionErr.message });
    const maxVersion = Array.isArray(maxVersionRows) && maxVersionRows[0]?.version_number
      ? Number(maxVersionRows[0].version_number)
      : 0;
    const nextVersion = maxVersion + 1;
    const label = String((req.body || {}).label || `Version ${nextVersion}`);

    const snapshot = {
      proposal: bundle.proposal,
      options: bundle.options,
      line_items: bundle.line_items
    };
    const { data, error } = await supabase
      .from('ignite_proposal_versions')
      .insert({
        proposal_id: proposalId,
        version_number: nextVersion,
        label,
        snapshot_json: snapshot,
        computed_json: bundle.proposal.computed_json || {},
        created_by: ctx.userId
      })
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });

    await supabase
      .from('ignite_proposals')
      .update({
        current_version: nextVersion,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId);

    return res.status(201).json({ version: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_version' });
  }
});

// POST /ignite/proposals/:id/share
router.post('/proposals/:id/share', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const proposalId = String(req.params.id || '');
    const proposal = await getProposalOr404(proposalId, res);
    if (!proposal) return;
    if (!assertProposalScopeOr403(ctx, proposal, res)) return;

    const expiresAt = (req.body || {}).expires_at || null;
    const maxAccessCount = toNumber((req.body || {}).max_access_count, 0) || null;
    const token = crypto.randomBytes(24).toString('hex');
    const { data, error } = await supabase
      .from('ignite_share_links')
      .insert({
        proposal_id: proposalId,
        client_id: proposal.client_id,
        token,
        expires_at: expiresAt,
        max_access_count: maxAccessCount,
        created_by: ctx.userId
      })
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ share: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_share' });
  }
});

async function createExportRecord(
  proposalId: string,
  exportType: 'pdf' | 'xlsx',
  exportView: 'internal' | 'client',
  createdBy: string
) {
  const payload = {
    proposal_id: proposalId,
    export_type: exportType,
    export_view: exportView,
    status: 'completed',
    metadata_json: {
      generated_at: new Date().toISOString(),
      note: 'Export stub generated by API route. File generation wiring comes next.'
    },
    created_by: createdBy
  };
  const { data, error } = await supabase
    .from('ignite_exports')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// POST /ignite/proposals/:id/export/pdf
router.post('/proposals/:id/export/pdf', async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const proposalId = String(req.params.id || '');
    const proposal = await getProposalOr404(proposalId, res);
    if (!proposal) return;
    if (!assertProposalScopeOr403(ctx, proposal, res)) return;

    const exportView = normalizeRole((req.body || {}).export_view) === 'client' ? 'client' : 'internal';
    const createdBy = ctx.userId;
    const exportRow = await createExportRecord(proposalId, 'pdf', exportView, createdBy);
    return res.status(201).json({ export: exportRow });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_export_pdf' });
  }
});

// POST /ignite/proposals/:id/export/xlsx
router.post('/proposals/:id/export/xlsx', async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const proposalId = String(req.params.id || '');
    const proposal = await getProposalOr404(proposalId, res);
    if (!proposal) return;
    if (!assertProposalScopeOr403(ctx, proposal, res)) return;

    const exportView = normalizeRole((req.body || {}).export_view) === 'client' ? 'client' : 'internal';
    const createdBy = ctx.userId;
    const exportRow = await createExportRecord(proposalId, 'xlsx', exportView, createdBy);
    return res.status(201).json({ export: exportRow });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_export_xlsx' });
  }
});

// GET /ignite/exports
router.get('/exports', async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    let proposalQuery = supabase
      .from('ignite_proposals')
      .select('id,name,client_id,workspace_id');

    if (ctx.isTeam) {
      if (ctx.workspaceId) proposalQuery = proposalQuery.eq('workspace_id', ctx.workspaceId);
    } else {
      const clientIds = Array.from(ctx.clientIds);
      if (!clientIds.length) return res.json({ exports: [] });
      proposalQuery = proposalQuery.in('client_id', clientIds);
    }

    const { data: proposalRows, error: proposalError } = await proposalQuery;
    if (proposalError) return res.status(500).json({ error: proposalError.message });
    const proposals = proposalRows || [];
    if (!proposals.length) return res.json({ exports: [] });

    const proposalMap = new Map<string, { name: string | null; client_id: string | null }>();
    const proposalIds = proposals.map((row) => String(row.id));
    for (const proposal of proposals) {
      proposalMap.set(String(proposal.id), {
        name: proposal.name ? String(proposal.name) : null,
        client_id: proposal.client_id ? String(proposal.client_id) : null
      });
    }

    const { data: exportRows, error: exportError } = await supabase
      .from('ignite_exports')
      .select('*')
      .in('proposal_id', proposalIds)
      .order('created_at', { ascending: false });
    if (exportError) return res.status(500).json({ error: exportError.message });

    const exportsWithProposal = (exportRows || []).map((row: any) => {
      const proposalMeta = proposalMap.get(String(row.proposal_id));
      return {
        ...row,
        proposal_name: proposalMeta?.name || null,
        client_id: proposalMeta?.client_id || null
      };
    });

    return res.json({ exports: exportsWithProposal });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_exports' });
  }
});

// GET /ignite/clients
router.get('/clients', async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    let query = supabase.from('ignite_clients').select('*').order('created_at', { ascending: false });
    if (ctx.isTeam) {
      if (ctx.workspaceId) query = query.eq('workspace_id', ctx.workspaceId);
    } else {
      const clientIds = Array.from(ctx.clientIds);
      if (!clientIds.length) return res.json({ clients: [] });
      query = query.in('id', clientIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ clients: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_clients' });
  }
});

// POST /ignite/clients
router.post('/clients', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const name = String((req.body || {}).name || '').trim();
    if (!name) return res.status(400).json({ error: 'name_required' });

    const payload = {
      workspace_id: ctx.workspaceId,
      name,
      legal_name: (req.body || {}).legal_name || null,
      external_ref: (req.body || {}).external_ref || null,
      metadata_json: (req.body || {}).metadata_json || {},
      created_by: ctx.userId
    };
    const { data, error } = await supabase
      .from('ignite_clients')
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ client: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_client' });
  }
});

// GET /ignite/templates
router.get('/templates', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    let query = supabase
      .from('ignite_templates')
      .select('*')
      .order('updated_at', { ascending: false });
    if (ctx.workspaceId) query = query.eq('workspace_id', ctx.workspaceId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ templates: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_templates' });
  }
});

// POST /ignite/templates
router.post('/templates', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const name = String((req.body || {}).name || '').trim();
    if (!name) return res.status(400).json({ error: 'name_required' });
    const payload = {
      workspace_id: ctx.workspaceId,
      client_id: (req.body || {}).client_id || null,
      name,
      description: (req.body || {}).description || null,
      data_json: (req.body || {}).data_json || {},
      is_default: Boolean((req.body || {}).is_default),
      created_by: ctx.userId
    };
    const { data, error } = await supabase
      .from('ignite_templates')
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ template: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_template' });
  }
});

// GET /ignite/vendor-rate-cards
router.get('/vendor-rate-cards', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    let query = supabase
      .from('ignite_vendor_rate_cards')
      .select('*')
      .order('updated_at', { ascending: false });
    if (ctx.workspaceId) query = query.eq('workspace_id', ctx.workspaceId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ vendor_rate_cards: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_vendor_rate_cards' });
  }
});

// POST /ignite/vendor-rate-cards
router.post('/vendor-rate-cards', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    const name = String((req.body || {}).name || '').trim();
    if (!name) return res.status(400).json({ error: 'name_required' });
    const payload = {
      workspace_id: ctx.workspaceId,
      client_id: (req.body || {}).client_id || null,
      name,
      vendor_name: (req.body || {}).vendor_name || null,
      category: (req.body || {}).category || null,
      currency: String((req.body || {}).currency || 'USD').trim().toUpperCase(),
      rates_json: (req.body || {}).rates_json || {},
      is_active: (req.body || {}).is_active !== false,
      created_by: ctx.userId
    };
    const { data, error } = await supabase
      .from('ignite_vendor_rate_cards')
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ vendor_rate_card: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_vendor_rate_card' });
  }
});

// GET /ignite/venue-presets
router.get('/venue-presets', requireIgniteTeam as any, async (req: ApiRequest, res: Response) => {
  try {
    const ctx = req.igniteContext!;
    let query = supabase
      .from('ignite_venue_presets')
      .select('*')
      .order('updated_at', { ascending: false });
    if (ctx.workspaceId) query = query.eq('workspace_id', ctx.workspaceId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ venue_presets: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_venue_presets' });
  }
});

export default router;
