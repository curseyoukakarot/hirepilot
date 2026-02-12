import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace from '../middleware/activeWorkspace';
import { supabase } from '../lib/supabase';
import { applyWorkspaceScope } from '../lib/workspaceScope';
import { computeFormula, Filter, SourceSpec, JoinSpec } from '../services/analytics/formulaEngine';
import { runWidgetQuery, resolveColumn, type TableColumn, type WidgetQueryInput } from '../services/analytics/widgetQueryEngine';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const scoped = (req: Request, table: string, ownerColumn: string = 'user_id') =>
  applyWorkspaceScope(supabase.from(table), {
    workspaceId: (req as any).workspaceId,
    userId: (req as any)?.user?.id,
    ownerColumn
  });

// -------------------- Sharing helpers (recruiter-only) --------------------
const USER_SELECT_FULL = 'id,email,first_name,last_name,full_name,avatar_url,team_id,role';
const USER_SELECT_MIN = 'id,email,role,team_id,avatar_url';
const USER_SELECT_TINY = 'id,email,role';

function normRole(role: any): string {
  return String(role || '').toLowerCase().replace(/\s|-/g, '_');
}

function isJobSeekerRole(role: any): boolean {
  return normRole(role).startsWith('job_seeker');
}

function displayName(u: any): string {
  const full = String(u?.full_name || '').trim();
  if (full) return full;
  const composed = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
  if (composed) return composed;
  return String(u?.email || u?.id || 'User');
}

async function runUsersQueryWithFallback<T>(
  build: (selectCols: string) => Promise<{ data: T; error: any }>
): Promise<{ data: T; error: any }> {
  const selects = [USER_SELECT_FULL, USER_SELECT_MIN, USER_SELECT_TINY];
  let last: { data: any; error: any } = { data: null, error: null };
  for (const cols of selects) {
    const resp = await build(cols);
    last = resp as any;
    if (!resp?.error) return resp as any;
    if (String(resp.error?.code || '') !== '42703') return resp as any;
  }
  return last as any;
}

async function getMe(userId: string): Promise<{ id: string; role: string; team_id: string | null; email: string | null }> {
  const meResp = await runUsersQueryWithFallback<any>(async (_cols) => {
    // minimal stable subset
    const resp = await supabase.from('users').select('id,role,team_id,email').eq('id', userId).maybeSingle();
    return { data: resp.data, error: resp.error };
  });
  const data = (meResp as any)?.data;
  return {
    id: userId,
    role: String((data as any)?.role || ''),
    team_id: (data as any)?.team_id || null,
    email: (data as any)?.email || null,
  };
}

function parseCollaborators(raw: any): Array<{ user_id: string; role: 'view' | 'edit' }> {
  const arr = Array.isArray(raw) ? raw : [];
  const out: Array<{ user_id: string; role: 'view' | 'edit' }> = [];
  const seen = new Set<string>();
  for (const c of arr) {
    const uid = String((c as any)?.user_id || '').trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const role = (String((c as any)?.role || '').toLowerCase() === 'edit') ? 'edit' : 'view';
    out.push({ user_id: uid, role });
  }
  return out;
}

async function getDashboardById(
  id: string,
  workspaceId?: string | null,
  userId?: string | null
): Promise<{ id: string; user_id: string; layout: any; collaborators: any; updated_at: any } | null> {
  // collaborators may not exist in old envs; treat missing as empty list
  const base = workspaceId
    ? applyWorkspaceScope(supabase.from('user_dashboards'), { workspaceId, userId, ownerColumn: 'user_id' })
    : supabase.from('user_dashboards');
  const { data, error } = await base
    .select('id,user_id,layout,updated_at,collaborators')
    .eq('id', id)
    .maybeSingle();
  if (error && String((error as any)?.code || '') === '42703') {
    const fallbackBase = workspaceId
      ? applyWorkspaceScope(supabase.from('user_dashboards'), { workspaceId, userId, ownerColumn: 'user_id' })
      : supabase.from('user_dashboards');
    const { data: d2 } = await fallbackBase
      .select('id,user_id,layout,updated_at')
      .eq('id', id)
      .maybeSingle();
    if (!d2?.id) return null;
    return { id: String(d2.id), user_id: String((d2 as any).user_id), layout: (d2 as any).layout, collaborators: [], updated_at: (d2 as any).updated_at };
  }
  if (!data?.id) return null;
  return {
    id: String((data as any).id),
    user_id: String((data as any).user_id),
    layout: (data as any).layout,
    collaborators: Array.isArray((data as any).collaborators) ? (data as any).collaborators : [],
    updated_at: (data as any).updated_at,
  };
}

async function upsertDashboardCollaborator(
  dashboardId: string,
  userId: string,
  role: 'view' | 'edit',
  workspaceId?: string | null
): Promise<void> {
  const dash = await getDashboardById(dashboardId, workspaceId, userId);
  if (!dash) throw new Error('not_found');
  const existing = Array.isArray(dash.collaborators) ? dash.collaborators : [];
  const map = new Map<string, { user_id: string; role: 'view' | 'edit' }>();
  for (const c of existing) {
    const uid = String((c as any)?.user_id || '').trim();
    if (!uid) continue;
    map.set(uid, { user_id: uid, role: (String((c as any)?.role || '').toLowerCase() === 'edit' ? 'edit' : 'view') });
  }
  map.set(String(userId), { user_id: String(userId), role });
  const merged = Array.from(map.values());
  const base = workspaceId
    ? applyWorkspaceScope(supabase.from('user_dashboards'), { workspaceId, userId, ownerColumn: 'user_id' })
    : supabase.from('user_dashboards');
  await base
    .update({ collaborators: merged, updated_at: new Date().toISOString() })
    .eq('id', dashboardId);
}

async function canAccessTable(userId: string, tableId: string, workspaceId?: string | null): Promise<boolean> {
  try {
    const base = workspaceId
      ? applyWorkspaceScope(supabase.from('custom_tables'), { workspaceId, userId, ownerColumn: 'user_id' })
      : supabase.from('custom_tables');
    const { data } = await base
      .select('id,user_id,collaborators')
      .eq('id', tableId)
      .maybeSingle();
    if (!data) return false;
    if ((data as any).user_id === userId) return true;
    try {
      const collabs = ((data as any).collaborators || []) as Array<{ id?: string; user_id?: string; email?: string; role?: string }>;
      const ok = collabs.some(c => c?.user_id === userId || c?.id === userId);
      return ok;
    } catch { return false; }
  } catch { return false; }
}

async function canAccessDashboard(userId: string, dashboardId: string, workspaceId?: string | null): Promise<boolean> {
  try {
    const dash = await getDashboardById(dashboardId, workspaceId, userId || null);
    if (!dash) return false;
    if (String(dash.user_id) === String(userId)) return true;
    const collabs = parseCollaborators(dash.collaborators);
    return collabs.some((c) => String(c.user_id) === String(userId));
  } catch {
    return false;
  }
}

async function canAccessDashboardTable(userId: string, dashboardId: string, tableId: string, workspaceId?: string | null): Promise<boolean> {
  try {
    const dash = await getDashboardById(dashboardId, workspaceId, userId || null);
    if (!dash) return false;
    const hasDashAccess =
      String(dash.user_id) === String(userId)
      || parseCollaborators(dash.collaborators).some((c) => String(c.user_id) === String(userId));
    if (!hasDashAccess) return false;

    const sources = Array.isArray((dash.layout as any)?.sources) ? (dash.layout as any).sources : [];
    const referenced = sources.some((s: any) => String(s?.tableId || s?.table_id || '').trim() === String(tableId));
    return referenced;
  } catch {
    return false;
  }
}

// POST /api/dashboards/:id/widgets/:widgetId/preview
router.post('/:id/widgets/:widgetId/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    const dashboardId = String(req.params?.id || '').trim();
    const cfg = req.body || {};
    const type = String(cfg?.type || '').toLowerCase();
    // Accept both tranche-1 chart/metric and tranche-2 formula types; here we focus on formula types
    if (type !== 'formulametric' && type !== 'formulachart') {
      res.status(400).json({ error: 'unsupported_type', detail: 'Use formulaMetric or formulaChart' });
      return;
    }
    const sources: SourceSpec[] = Array.isArray(cfg.sources) ? cfg.sources : [];
    if (!sources.length) { res.status(400).json({ error: 'sources_required' }); return; }
    // Access checks
    for (const s of sources) {
      const ok = await canAccessTable(userId, s.tableId, (req as any).workspaceId) || (dashboardId && await canAccessDashboardTable(userId, dashboardId, s.tableId, (req as any).workspaceId));
      if (!ok) { res.status(403).json({ error: 'forbidden_table', tableId: s.tableId }); return; }
    }
    const joins: JoinSpec[] | undefined = Array.isArray(cfg.joins) ? cfg.joins : undefined;
    const filters: Filter[] | undefined = Array.isArray(cfg.filters) ? cfg.filters : undefined;
    const timeBucket = (cfg.timeBucket || 'none') as any;
    const formula: string = String(cfg.formula || '').trim();
    if (!formula) { res.status(400).json({ error: 'formula_required' }); return; }

    // Row loader from Supabase (service role; we enforce access above)
    const loadRows = async (tableId: string) => {
      const { data } = await scoped(req, 'custom_tables')
        .select('schema_json,data_json')
        .eq('id', tableId)
        .maybeSingle();
      const rows = ((data as any)?.data_json || []) as any[];
      return { rows, schema: (data as any)?.schema_json };
    };

    const result = await computeFormula({
      formula,
      sources,
      joins,
      timeBucket,
      groupBy: cfg.groupBy,
      filters,
      loadRows
    });
    if (result.kind === 'metric') {
      res.json({ value: result.value });
      return;
    }
    res.json({ points: result.points });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'preview_failed' });
  }
});

// POST /api/dashboards/widgets/query
// Universal widget query endpoint: stable column_id support, bucketing, range, filters, warnings.
router.post('/widgets/query', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    const cfg = (req.body || {}) as Partial<WidgetQueryInput> & { dashboard_id?: string };
    const tableId = String(cfg.table_id || '').trim();
    if (!tableId) { res.status(400).json({ error: 'table_id_required' }); return; }
    const dashboardId = String((cfg as any)?.dashboard_id || '').trim();
    const ok = await canAccessTable(userId, tableId, (req as any).workspaceId) || (dashboardId ? await canAccessDashboardTable(userId, dashboardId, tableId, (req as any).workspaceId) : false);
    if (!ok) { res.status(403).json({ error: 'forbidden_table', tableId }); return; }

    const metrics = Array.isArray(cfg.metrics) ? cfg.metrics : [];
    if (!metrics.length) { res.status(400).json({ error: 'metrics_required' }); return; }

    const { data } = await scoped(req, 'custom_tables')
      .select('schema_json,data_json')
      .eq('id', tableId)
      .maybeSingle();
    const schema = (Array.isArray((data as any)?.schema_json) ? (data as any).schema_json : []) as TableColumn[];
    const rows = (Array.isArray((data as any)?.data_json) ? (data as any).data_json : []) as any[];

    // Validate that referenced columns exist (by id/key/label) to avoid confusing all-zero results.
    const missing: string[] = [];
    for (const m of metrics) {
      const cid = String((m as any)?.column_id || '');
      if (!resolveColumn(schema, cid)) missing.push(cid);
    }
    if (cfg.date_column_id) {
      const dc = String(cfg.date_column_id || '');
      if (dc && !resolveColumn(schema, dc)) missing.push(dc);
    }
    if (missing.length) {
      res.status(400).json({ error: 'unknown_column', missing: Array.from(new Set(missing)) });
      return;
    }

    const result = runWidgetQuery(
      {
        table_id: tableId,
        metrics: metrics as any,
        date_column_id: cfg.date_column_id ? String(cfg.date_column_id) : undefined,
        time_bucket: (cfg.time_bucket || 'none') as any,
        range: (cfg.range || 'all_time') as any,
        range_start: cfg.range_start ? String(cfg.range_start) : undefined,
        range_end: cfg.range_end ? String(cfg.range_end) : undefined,
        filters: Array.isArray(cfg.filters) ? (cfg.filters as any) : undefined
      },
      schema,
      rows
    );

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'query_failed' });
  }
});

// -------------------- Dashboard sharing endpoints --------------------

// GET /api/dashboards/:id/collaborators-unified
router.get('/:id/collaborators-unified', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const { id } = req.params;
    const dash = await getDashboardById(id, (req as any).workspaceId, userId || null);
    if (!dash) return res.status(404).json({ error: 'not_found' });

    const collabs = parseCollaborators(dash.collaborators);
    const isOwner = dash.user_id === userId;
    const isExisting = collabs.some((c) => String(c.user_id) === userId);
    if (!(isOwner || isExisting)) return res.status(403).json({ error: 'access_denied' });

    const isSuper = ['super_admin', 'superadmin'].includes(normRole(me.role));
    const isTeamAdmin = normRole(me.role) === 'team_admin';
    let ownerTeam: string | null = null;
    try {
      const ownerRowResp = await runUsersQueryWithFallback<any>(async (cols) => {
        const resp = await supabase.from('users').select(cols).eq('id', dash.user_id).maybeSingle();
        return { data: resp.data, error: resp.error };
      });
      ownerTeam = (ownerRowResp.data as any)?.team_id || null;
    } catch {}
    const canManageAccess = Boolean(isSuper || (isTeamAdmin && me.team_id && ownerTeam && me.team_id === ownerTeam));

    const ids = Array.from(new Set([dash.user_id, ...collabs.map((c) => c.user_id)]));
    const usersResp = ids.length
      ? await runUsersQueryWithFallback<any[]>(async (cols) => {
          const resp = await supabase.from('users').select(cols).in('id', ids);
          return { data: resp.data, error: resp.error };
        })
      : ({ data: [], error: null } as any);
    const byId = new Map((usersResp.data || []).map((u: any) => [String(u.id), u]));
    const owner = byId.get(String(dash.user_id)) || ({ id: dash.user_id, email: null } as any);
    const memberCollaborators = collabs.map((c) => ({
      kind: 'member',
      user_id: c.user_id,
      role: c.role,
      user: byId.get(String(c.user_id)) || ({ id: c.user_id, email: null } as any),
    }));

    let guests: any[] = [];
    try {
      const { data: guestRows } = await supabase
        .from('dashboard_guest_collaborators')
        .select('email,role,status')
        .eq('dashboard_id', id);
      guests = (guestRows || []).map((g: any) => ({
        kind: 'guest',
        email: String(g.email || '').toLowerCase(),
        role: String(g.role || 'view') === 'edit' ? 'edit' : 'view',
        status: String(g.status || 'pending'),
      }));
    } catch {}

    return res.json({
      dashboard: { id: dash.id, name: String((dash.layout as any)?.name || '').trim() || 'Custom Dashboard', owner_id: dash.user_id },
      owner,
      collaborators: [...memberCollaborators, ...guests],
      can_manage_access: canManageAccess,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// POST /api/dashboards/:id/collaborators  { collaborators: [{ user_id, role }] }
router.post('/:id/collaborators', requireAuth, async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id as string | undefined;
    if (!actorId) return res.status(401).json({ error: 'unauthorized' });
    const me = await getMe(actorId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const isSuper = ['super_admin', 'superadmin'].includes(normRole(me.role));
    const isTeamAdmin = normRole(me.role) === 'team_admin';
    if (!(isSuper || isTeamAdmin)) return res.status(403).json({ error: 'Only team admins can manage access' });

    const { id } = req.params;
    const dash = await getDashboardById(id, (req as any).workspaceId, userId || null);
    if (!dash) return res.status(404).json({ error: 'not_found' });

    if (!isSuper) {
      const ownerRowResp = await runUsersQueryWithFallback<any>(async (cols) => {
        const resp = await supabase.from('users').select(cols).eq('id', dash.user_id).maybeSingle();
        return { data: resp.data, error: resp.error };
      });
      const ownerTeam = (ownerRowResp.data as any)?.team_id || null;
      if (!me.team_id || !ownerTeam || me.team_id !== ownerTeam) return res.status(403).json({ error: 'access_denied' });
    }

    const incoming = Array.isArray((req.body as any)?.collaborators) ? (req.body as any).collaborators : [];
    const cleaned = parseCollaborators(incoming).filter((c) => c.user_id !== dash.user_id);
    const targetIds = cleaned.map((c) => c.user_id);
    if (targetIds.length > 100) return res.status(400).json({ error: 'too_many_collaborators' });
    if (targetIds.length) {
      const targetsResp = await runUsersQueryWithFallback<any[]>(async (cols) => {
        const resp = await supabase.from('users').select(cols).in('id', targetIds);
        return { data: resp.data, error: resp.error };
      });
      if (targetsResp.error) return res.status(500).json({ error: targetsResp.error.message || String(targetsResp.error) });
      const byId = new Map((targetsResp.data || []).map((t: any) => [String(t.id), t]));
      const invalid = targetIds.filter((tid) => {
        const t = byId.get(String(tid));
        if (!t) return true;
        if (isJobSeekerRole((t as any).role)) return true;
        return false;
      });
      if (invalid.length) return res.status(400).json({ error: 'invalid_collaborators', invalid_user_ids: invalid });
    }

    const { data: updated, error } = await scoped(req, 'user_dashboards')
      .update({ collaborators: cleaned, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ dashboard: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// POST /api/dashboards/:id/guest-invite  { email, role }
router.post('/:id/guest-invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const inviterId = (req as any).user?.id as string | undefined;
    if (!inviterId) return res.status(401).json({ error: 'unauthorized' });
    const me = await getMe(inviterId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const isSuper = ['super_admin', 'superadmin'].includes(normRole(me.role));
    const isTeamAdmin = normRole(me.role) === 'team_admin';
    if (!(isSuper || isTeamAdmin)) return res.status(403).json({ error: 'Only team admins can manage access' });

    const { id } = req.params;
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const roleIn = String((req.body || {}).role || '').toLowerCase();
    const role: 'view' | 'edit' = roleIn === 'edit' ? 'edit' : 'view';
    if (!email) return res.status(400).json({ error: 'missing_email' });

    const dash = await getDashboardById(id, (req as any).workspaceId, userId || null);
    if (!dash) return res.status(404).json({ error: 'not_found' });

    if (!isSuper) {
      const ownerRowResp = await runUsersQueryWithFallback<any>(async (cols) => {
        const resp = await supabase.from('users').select(cols).eq('id', dash.user_id).maybeSingle();
        return { data: resp.data, error: resp.error };
      });
      const ownerTeam = (ownerRowResp.data as any)?.team_id || null;
      if (!me.team_id || !ownerTeam || me.team_id !== ownerTeam) return res.status(403).json({ error: 'access_denied' });
    }

    // If email belongs to an existing public.users user, grant access immediately
    const existingUserResp = await runUsersQueryWithFallback<any>(async (cols) => {
      const resp = await supabase.from('users').select(cols).ilike('email', email).maybeSingle();
      return { data: resp.data, error: resp.error };
    });
    const existingUser = existingUserResp.data as any;
    if (existingUser?.id && isJobSeekerRole(existingUser?.role)) return res.status(400).json({ error: 'jobseeker_not_allowed' });
    if (existingUser?.id) {
      await upsertDashboardCollaborator(id, String(existingUser.id), role, (req as any).workspaceId);
      try { await supabase.from('dashboard_guest_collaborators').delete().eq('dashboard_id', id).eq('email', email); } catch {}

      // best-effort email (simple)
      try {
        const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com').replace(/\/$/, '');
        const name = String((dash.layout as any)?.name || '').trim() || 'Custom Dashboard';
        const subject = `You were added to "${name}" on HirePilot`;
        const inviterDisplay = me.email || 'a teammate';
        const html = `
          <p>Hi,</p>
          <p>${inviterDisplay} added you as a collaborator to the dashboard <strong>${name}</strong>.</p>
          <p>No action is required. The dashboard will now appear in your Dashboards list.</p>
          <p><a href="${appUrl}/dashboards/${id}">Open the dashboard</a></p>
          <p style="color:#888;font-size:12px;margin-top:16px">You received this because your email (${email}) is a HirePilot account.</p>
        `;
        const { sendEmail } = await import('../../services/emailService');
        await sendEmail(email, subject, subject, html);
      } catch {}

      return res.json({ kind: 'member', user_id: String(existingUser.id), role });
    }

    // Guest invite row (pending)
    const { data: existingInvite } = await supabase
      .from('dashboard_guest_collaborators')
      .select('id')
      .eq('dashboard_id', id)
      .eq('email', email)
      .maybeSingle();
    if (existingInvite?.id) {
      const { data: upd, error } = await supabase
        .from('dashboard_guest_collaborators')
        .update({ invited_by: inviterId, role, status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', existingInvite.id)
        .select('*')
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      try {
        const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com').replace(/\/$/, '');
        const name = String((dash.layout as any)?.name || '').trim() || 'Custom Dashboard';
        const subject = `You're invited to collaborate on "${name}" on HirePilot`;
        const html = `
          <p>Hi,</p>
          <p>You were invited to collaborate on the dashboard <strong>${name}</strong>.</p>
          <p>To access it, create/sign in to your HirePilot recruiter account using this email address, and the dashboard will appear in your Dashboards list.</p>
          <p><a href="${appUrl}/dashboards/${id}">Open the dashboard</a></p>
          <p style="color:#888;font-size:12px;margin-top:16px">You received this invite because someone shared a dashboard with ${email}.</p>
        `;
        const { sendEmail } = await import('../../services/emailService');
        await sendEmail(email, subject, subject, html);
      } catch {}
      return res.json({ kind: 'guest', email, role, status: (upd as any)?.status || 'pending' });
    }

    const { data: ins, error: insErr } = await supabase
      .from('dashboard_guest_collaborators')
      .insert({ dashboard_id: id, email, role, invited_by: inviterId, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select('*')
      .maybeSingle();
    if (insErr) return res.status(500).json({ error: insErr.message });
    try {
      const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com').replace(/\/$/, '');
      const name = String((dash.layout as any)?.name || '').trim() || 'Custom Dashboard';
      const subject = `You're invited to collaborate on "${name}" on HirePilot`;
      const html = `
        <p>Hi,</p>
        <p>You were invited to collaborate on the dashboard <strong>${name}</strong>.</p>
        <p>To access it, create/sign in to your HirePilot recruiter account using this email address, and the dashboard will appear in your Dashboards list.</p>
        <p><a href="${appUrl}/dashboards/${id}">Open the dashboard</a></p>
        <p style="color:#888;font-size:12px;margin-top:16px">You received this invite because someone shared a dashboard with ${email}.</p>
      `;
      const { sendEmail } = await import('../../services/emailService');
      await sendEmail(email, subject, subject, html);
    } catch {}
    return res.json({ kind: 'guest', email, role, status: (ins as any)?.status || 'pending' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'invite_failed' });
  }
});

// DELETE /api/dashboards/:id/guest-invite?email=...
router.delete('/:id/guest-invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id as string | undefined;
    if (!actorId) return res.status(401).json({ error: 'unauthorized' });
    const me = await getMe(actorId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const isSuper = ['super_admin', 'superadmin'].includes(normRole(me.role));
    const isTeamAdmin = normRole(me.role) === 'team_admin';
    if (!(isSuper || isTeamAdmin)) return res.status(403).json({ error: 'Only team admins can manage access' });

    const { id } = req.params;
    const email = String((req.query as any)?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'missing_email' });

    const dash = await getDashboardById(id, (req as any).workspaceId, userId || null);
    if (!dash) return res.status(404).json({ error: 'not_found' });
    if (!isSuper) {
      const ownerRowResp = await runUsersQueryWithFallback<any>(async (cols) => {
        const resp = await supabase.from('users').select(cols).eq('id', dash.user_id).maybeSingle();
        return { data: resp.data, error: resp.error };
      });
      const ownerTeam = (ownerRowResp.data as any)?.team_id || null;
      if (!me.team_id || !ownerTeam || me.team_id !== ownerTeam) return res.status(403).json({ error: 'access_denied' });
    }

    await supabase.from('dashboard_guest_collaborators').delete().eq('dashboard_id', id).eq('email', email);
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'delete_failed' });
  }
});

export default router;


