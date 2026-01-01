import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = express.Router();

type UserLite = {
  id: string;
  email: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  team_id?: string | null;
  role?: string | null;
};

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
  // Some environments have schema drift (missing first_name/full_name/etc).
  // Retry with minimal selects when PostgREST returns undefined-column (42703).
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

function isValidRecruiterRole(role: any): boolean {
  const r = normRole(role);
  if (!r) return true; // treat unknown/empty as recruiter-side (we will default to 'free' in public.users)
  return !r.startsWith('job_seeker');
}

async function authAdminLookupByEmail(email: string): Promise<any | null> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;

  const url = (process.env.SUPABASE_URL as string) || '';
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY as string) || '';
  if (url && serviceKey) {
    try {
      const adminBase = `${url}/auth/v1`;
      const headers: any = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
      const resp = await fetch(`${adminBase}/admin/users?email=${encodeURIComponent(normalized)}`, { headers });
      if (!resp.ok) return null;
      const body = await resp.json();
      const user = Array.isArray(body?.users) ? body.users[0] : (body?.id ? body : null);
      if (!user?.id) return null;
      return user;
    } catch {}
  }

  // Fallback: scan a few pages (best-effort)
  try {
    const perPage = 200;
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await (supabase as any).auth.admin.listUsers({ page, perPage });
      if (error) break;
      const found = (data?.users || []).find((u: any) => String(u.email || '').toLowerCase() === normalized);
      if (found) return found;
      if ((data?.users || []).length < perPage) break;
    }
  } catch {}
  return null;
}

async function ensurePublicUserFromAuth(authUser: any): Promise<any | null> {
  try {
    const id = String(authUser?.id || authUser?.user?.id || '').trim();
    const email = String(authUser?.email || authUser?.user?.email || '').trim().toLowerCase();
    if (!id || !email) return null;

    const meta = (authUser?.user_metadata || authUser?.user?.user_metadata || {}) as any;
    const app = (authUser?.app_metadata || authUser?.user?.app_metadata || {}) as any;
    const roleRaw = meta.role || meta.account_type || meta.user_type || app.role || null;
    if (!isValidRecruiterRole(roleRaw)) return null;

    // Default role to 'free' to satisfy RLS predicate (role NOT ilike job_seeker% must be true)
    const role = roleRaw ? String(roleRaw) : 'free';

    // Upsert minimal public.users row so sharing/RLS works immediately
    const upsert = await runUsersQueryWithFallback<any>(async (cols) => {
      const resp = await supabase
        .from('users')
        .upsert({ id, email, role } as any, { onConflict: 'id' })
        .select(cols)
        .maybeSingle();
      return { data: resp.data, error: resp.error };
    });
    if (upsert.error) return null;
    return (upsert.data as any) || null;
  } catch {
    return null;
  }
}

async function getMe(userId: string): Promise<{ id: string; role: string; team_id: string | null; email: string | null }> {
  const meResp = await runUsersQueryWithFallback<any>(async (cols) => {
    // Always include role/email/team_id if present; fallback helper will trim if needed
    const wanted = cols.includes('team_id') ? 'id,role,team_id,email' : 'id,role,email';
    const resp = await supabase.from('users').select(wanted).eq('id', userId).maybeSingle();
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

async function getTableById(id: string): Promise<{ id: string; name: string | null; user_id: string; collaborators: any } | null> {
  const { data } = await supabase
    .from('custom_tables')
    .select('id,name,user_id,collaborators')
    .eq('id', id)
    .maybeSingle();
  if (!data?.id) return null;
  return {
    id: String((data as any).id),
    name: (data as any).name ?? null,
    user_id: String((data as any).user_id),
    collaborators: (data as any).collaborators,
  };
}

async function upsertTableCollaborator(tableId: string, userId: string, role: 'view' | 'edit'): Promise<void> {
  const table = await getTableById(tableId);
  if (!table) throw new Error('not_found');
  const existing = Array.isArray(table.collaborators) ? table.collaborators : [];
  const mergedMap = new Map<string, { user_id: string; role: 'view' | 'edit' }>();
  for (const c of existing) {
    const uid = String((c as any)?.user_id || '').trim();
    if (!uid) continue;
    mergedMap.set(uid, { user_id: uid, role: (String((c as any)?.role || '').toLowerCase() === 'edit' ? 'edit' : 'view') });
  }
  mergedMap.set(String(userId), { user_id: String(userId), role });
  const merged = Array.from(mergedMap.values());
  await supabase
    .from('custom_tables')
    .update({ collaborators: merged, updated_at: new Date().toISOString() })
    .eq('id', tableId);
}

// GET /api/tables/users/search?q=...
// Recruiter-only user search for sharing tables.
router.get('/users/search', requireAuth, async (req: Request, res: Response) => {
  try {
    // Avoid browser/proxy caching confusing the UI
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Vary', 'Authorization');

    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const q = String((req.query as any)?.q || '').trim();
    const limit = Math.max(1, Math.min(50, Number((req.query as any)?.limit || 20) || 20));
    if (!q) return res.json({ users: [] });

    const term = `%${q.replace(/%/g, '').replace(/,/g, '')}%`;
    // NOTE: don't filter by role in SQL because role may be null in some envs.
    // We'll filter out job_seekers in JS to keep results reliable.
    const searchResp = await runUsersQueryWithFallback<any[]>(async (cols) => {
      let query = supabase
        .from('users')
        .select(cols)
        .limit(Math.min(100, limit * 3));

      // Only reference columns that exist in this environment (schema drift safe)
      const ors: string[] = [`email.ilike.${term}`];
      if (cols.includes('full_name')) ors.push(`full_name.ilike.${term}`);
      if (cols.includes('first_name')) ors.push(`first_name.ilike.${term}`);
      if (cols.includes('last_name')) ors.push(`last_name.ilike.${term}`);
      query = query.or(ors.join(','));
      const resp = await query.order('email', { ascending: true });
      return { data: resp.data, error: resp.error };
    });
    const data = (searchResp as any)?.data || [];
    const error = (searchResp as any)?.error || null;
    if (error) return res.status(500).json({ error: error.message || String(error) });

    const users = (data || [])
      .filter((u: any) => !isJobSeekerRole(u?.role))
      .slice(0, limit)
      .map((u: any) => ({
        id: String(u.id),
        email: u.email || null,
        name: displayName(u),
        avatar_url: u.avatar_url || null,
        team_id: u.team_id || null,
        role: u.role || null,
      }));

    // If query looks like an email and we found nothing, fallback to Auth lookup (handles missing public.users row)
    if (users.length === 0 && q.includes('@') && q.includes('.')) {
      const authUser = await authAdminLookupByEmail(q);
      const publicRow = authUser ? await ensurePublicUserFromAuth(authUser) : null;
      if (publicRow?.id && !isJobSeekerRole(publicRow?.role)) {
        return res.json({
          users: [{
            id: String(publicRow.id),
            email: publicRow.email || null,
            name: displayName(publicRow),
            avatar_url: publicRow.avatar_url || null,
            team_id: publicRow.team_id || null,
            role: publicRow.role || null,
          }]
        });
      }
    }

    return res.json({ users });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'search_failed' });
  }
});

// GET /api/tables/users/resolve?email=... OR ?q=...
// Resolves a single recruiter-side user for share-by-typing flows.
router.get('/users/resolve', requireAuth, async (req: Request, res: Response) => {
  try {
    // Avoid browser/proxy caching confusing the UI
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Vary', 'Authorization');

    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const emailRaw = String((req.query as any)?.email || '').trim().toLowerCase();
    const qRaw = String((req.query as any)?.q || '').trim();

    let row: any | null = null;
    if (emailRaw) {
      const byEmail = await runUsersQueryWithFallback<any>(async (cols) => {
        const resp = await supabase
          .from('users')
          .select(cols)
          .ilike('email', emailRaw)
          .maybeSingle();
        return { data: resp.data, error: resp.error };
      });
      if (byEmail.error) return res.status(500).json({ error: byEmail.error.message || String(byEmail.error) });
      row = byEmail.data || null;
      if (!row) {
        const authUser = await authAdminLookupByEmail(emailRaw);
        row = authUser ? await ensurePublicUserFromAuth(authUser) : null;
      }
    } else if (qRaw) {
      const term = `%${qRaw.replace(/%/g, '').replace(/,/g, '')}%`;
      const byQ = await runUsersQueryWithFallback<any[]>(async (cols) => {
        const resp = await supabase
          .from('users')
          .select(cols)
          .or((() => {
            const ors: string[] = [`email.ilike.${term}`];
            if (cols.includes('full_name')) ors.push(`full_name.ilike.${term}`);
            if (cols.includes('first_name')) ors.push(`first_name.ilike.${term}`);
            if (cols.includes('last_name')) ors.push(`last_name.ilike.${term}`);
            return ors.join(',');
          })())
          .limit(5);
        return { data: resp.data, error: resp.error };
      });
      if (byQ.error) return res.status(500).json({ error: byQ.error.message || String(byQ.error) });
      const filtered = (Array.isArray(byQ.data) ? byQ.data : []).filter((u: any) => !isJobSeekerRole(u?.role));
      // Only resolve automatically if it's an unambiguous single match (after filtering job seekers)
      row = filtered.length === 1 ? filtered[0] : null;
      if (!row && filtered.length > 1) {
        return res.status(409).json({ error: 'ambiguous', count: filtered.length });
      }
    } else {
      return res.status(400).json({ error: 'missing_email_or_q' });
    }

    if (!row?.id) return res.status(404).json({ error: 'user_not_found' });
    if (isJobSeekerRole(row.role)) return res.status(400).json({ error: 'invalid_user_type' });

    return res.json({
      user: {
        id: String(row.id),
        email: row.email || null,
        name: displayName(row),
        avatar_url: row.avatar_url || null,
        team_id: row.team_id || null,
        role: row.role || null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'resolve_failed' });
  }
});

// POST /api/tables/:id/guest-invite
// Body: { email: string, role: 'view'|'edit' }
// Mirrors Job REQ "guest invite" UX: invite by email without needing to search/select a user.
router.post('/:id/guest-invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const inviterId = (req as any).user?.id as string | undefined;
    if (!inviterId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(inviterId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const { id } = req.params;
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const roleIn = String((req.body || {}).role || '').toLowerCase();
    const role: 'view' | 'edit' = roleIn === 'edit' ? 'edit' : 'view';
    if (!email) return res.status(400).json({ error: 'missing_email' });

    // Only team_admin / super_admin can invite
    const isSuper = ['super_admin', 'superadmin'].includes(normRole(me.role));
    const isTeamAdmin = normRole(me.role) === 'team_admin';
    if (!(isSuper || isTeamAdmin)) return res.status(403).json({ error: 'Only team admins can manage access' });

    const table = await getTableById(id);
    if (!table) return res.status(404).json({ error: 'not_found' });

    // team_admin can only manage tables owned by their team
    if (!isSuper) {
      const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', table.user_id).maybeSingle();
      const ownerTeam = (ownerRow as any)?.team_id || null;
      if (!me.team_id || !ownerTeam || me.team_id !== ownerTeam) return res.status(403).json({ error: 'access_denied' });
    }

    // If email belongs to an existing public.users user, grant access immediately via collaborators[]
    const existingUserResp = await runUsersQueryWithFallback<any>(async (cols) => {
      const resp = await supabase.from('users').select(cols).ilike('email', email).maybeSingle();
      return { data: resp.data, error: resp.error };
    });
    let existingUser = existingUserResp.data as any;

    // Fallback: Auth lookup by email (handles auth-only accounts) and upsert public.users
    if (!existingUser?.id) {
      const authUser = await authAdminLookupByEmail(email);
      existingUser = authUser ? await ensurePublicUserFromAuth(authUser) : null;
    }

    // Reject jobseeker accounts
    if (existingUser?.id && isJobSeekerRole(existingUser?.role)) {
      return res.status(400).json({ error: 'jobseeker_not_allowed' });
    }

    if (existingUser?.id) {
      await upsertTableCollaborator(id, String(existingUser.id), role);
      // Clean up any pending guest invite rows for this table/email
      try {
        await supabase.from('table_guest_collaborators').delete().eq('table_id', id).eq('email', email);
      } catch {}

      // Notify existing user (best-effort)
      try {
        const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com').replace(/\/$/, '');
        const inviterResp = await runUsersQueryWithFallback<any>(async (cols) => {
          const resp = await supabase.from('users').select(cols).eq('id', inviterId).maybeSingle();
          return { data: resp.data, error: resp.error };
        });
        const inviter = inviterResp.data as any;
        const inviterDisplay =
          (inviter && displayName(inviter) !== inviterId ? displayName(inviter) : null)
          || inviter?.email
          || 'a teammate';
        const tableName = table.name || 'Untitled Table';
        const subject = `You were added to "${tableName}" on HirePilot`;
        const html = `
          <p>Hi,</p>
          <p>${inviterDisplay} added you as a collaborator to the table <strong>${tableName}</strong>.</p>
          <p>No action is required. The table will now appear in your Tables list.</p>
          <p><a href="${appUrl}/tables/${id}/edit">Open the table</a></p>
          <p style="color:#888;font-size:12px;margin-top:16px">You received this because your email (${email}) is a HirePilot account.</p>
        `;
        const { sendEmail } = await import('../../services/emailService');
        await sendEmail(email, subject, subject, html);
      } catch {}

      return res.json({ kind: 'member', user_id: String(existingUser.id), role });
    }

    // Guest path: create/update pending invite row (no account yet)
    const { data: existingInvite } = await supabase
      .from('table_guest_collaborators')
      .select('id')
      .eq('table_id', id)
      .eq('email', email)
      .maybeSingle();

    if (existingInvite?.id) {
      const { data: upd, error } = await supabase
        .from('table_guest_collaborators')
        .update({ invited_by: inviterId, role, status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', existingInvite.id)
        .select('*')
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      // Best-effort email invite
      try {
        const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com').replace(/\/$/, '');
        const tableName = table.name || 'Untitled Table';
        const subject = `You're invited to collaborate on "${tableName}" on HirePilot`;
        const html = `
          <p>Hi,</p>
          <p>You were invited to collaborate on the table <strong>${tableName}</strong>.</p>
          <p>To access it, create/sign in to your HirePilot recruiter account using this email address, and the table will appear in your Tables list.</p>
          <p><a href="${appUrl}/tables/${id}/edit">Open the table</a></p>
          <p style="color:#888;font-size:12px;margin-top:16px">You received this invite because someone shared a table with ${email}.</p>
        `;
        const { sendEmail } = await import('../../services/emailService');
        await sendEmail(email, subject, subject, html);
      } catch {}
      return res.json({ kind: 'guest', email, role, status: (upd as any)?.status || 'pending' });
    }

    const { data: ins, error: insErr } = await supabase
      .from('table_guest_collaborators')
      .insert({ table_id: id, email, role, invited_by: inviterId, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select('*')
      .maybeSingle();
    if (insErr) return res.status(500).json({ error: insErr.message });

    // Best-effort email invite
    try {
      const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com').replace(/\/$/, '');
      const tableName = table.name || 'Untitled Table';
      const subject = `You're invited to collaborate on "${tableName}" on HirePilot`;
      const html = `
        <p>Hi,</p>
        <p>You were invited to collaborate on the table <strong>${tableName}</strong>.</p>
        <p>To access it, create/sign in to your HirePilot recruiter account using this email address, and the table will appear in your Tables list.</p>
        <p><a href="${appUrl}/tables/${id}/edit">Open the table</a></p>
        <p style="color:#888;font-size:12px;margin-top:16px">You received this invite because someone shared a table with ${email}.</p>
      `;
      const { sendEmail } = await import('../../services/emailService');
      await sendEmail(email, subject, subject, html);
    } catch {}

    return res.json({ kind: 'guest', email, role, status: (ins as any)?.status || 'pending' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'invite_failed' });
  }
});

// DELETE /api/tables/:id/guest-invite?email=...
// Removes a pending guest invite (email-based).
router.delete('/:id/guest-invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const inviterId = (req as any).user?.id as string | undefined;
    if (!inviterId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(inviterId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const isSuper = ['super_admin', 'superadmin'].includes(normRole(me.role));
    const isTeamAdmin = normRole(me.role) === 'team_admin';
    if (!(isSuper || isTeamAdmin)) return res.status(403).json({ error: 'Only team admins can manage access' });

    const { id } = req.params;
    const email = String((req.query as any)?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'missing_email' });

    const table = await getTableById(id);
    if (!table) return res.status(404).json({ error: 'not_found' });

    if (!isSuper) {
      const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', table.user_id).maybeSingle();
      const ownerTeam = (ownerRow as any)?.team_id || null;
      if (!me.team_id || !ownerTeam || me.team_id !== ownerTeam) return res.status(403).json({ error: 'access_denied' });
    }

    await supabase.from('table_guest_collaborators').delete().eq('table_id', id).eq('email', email);
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'delete_failed' });
  }
});

// GET /api/tables/:id/collaborators-unified
router.get('/:id/collaborators-unified', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const { id } = req.params;
    const table = await getTableById(id);
    if (!table) return res.status(404).json({ error: 'not_found' });

    const ownerId = String(table.user_id);
    const collabs = parseCollaborators(table.collaborators);
    const isOwner = ownerId === userId;
    const isExisting = collabs.some((c) => String(c.user_id) === userId);
    if (!(isOwner || isExisting)) return res.status(403).json({ error: 'access_denied' });

    const isSuper = ['super_admin', 'superadmin'].includes(normRole(me.role));
    const isTeamAdmin = normRole(me.role) === 'team_admin';

    // Allow manage if super OR team_admin of same team as the table owner
    let ownerTeam: string | null = null;
    try {
      const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', ownerId).maybeSingle();
      ownerTeam = (ownerRow as any)?.team_id || null;
    } catch {}
    const canManageAccess = Boolean(isSuper || (isTeamAdmin && me.team_id && ownerTeam && me.team_id === ownerTeam));

    // Attach user profiles for owner + collaborators
    const ids = Array.from(new Set([ownerId, ...collabs.map((c) => c.user_id)]));
    const usersResp = ids.length
      ? await runUsersQueryWithFallback<any[]>(async (cols) => {
          const resp = await supabase.from('users').select(cols).in('id', ids);
          return { data: resp.data, error: resp.error };
        })
      : ({ data: [] as any[], error: null } as any);
    const users = (usersResp as any)?.data || [];
    const byId = new Map<string, UserLite>(((users || []) as any[]).map((u: any) => [String(u.id), u]));

    const owner = byId.get(ownerId) || ({ id: ownerId, email: null } as any);
    const memberCollaborators = collabs.map((c) => ({
      kind: 'member',
      user_id: c.user_id,
      role: c.role,
      user: byId.get(String(c.user_id)) || ({ id: c.user_id, email: null } as any),
    }));

    // Include pending guest invites
    let guests: any[] = [];
    try {
      const { data: guestRows } = await supabase
        .from('table_guest_collaborators')
        .select('email,role,status')
        .eq('table_id', id);
      guests = (guestRows || []).map((g: any) => ({
        kind: 'guest',
        email: String(g.email || '').toLowerCase(),
        role: String(g.role || 'view') === 'edit' ? 'edit' : 'view',
        status: String(g.status || 'pending'),
      }));
    } catch {}

    return res.json({
      table: { id: String(table.id), name: table.name || null, owner_id: ownerId },
      owner,
      collaborators: [...memberCollaborators, ...guests],
      can_manage_access: canManageAccess,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// POST /api/tables/:id/collaborators
// Body: { collaborators: [{ user_id, role: 'view'|'edit' }] }
router.post('/:id/collaborators', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const isSuper = ['super_admin', 'superadmin'].includes(normRole(me.role));
    const isTeamAdmin = normRole(me.role) === 'team_admin';
    if (!(isSuper || isTeamAdmin)) return res.status(403).json({ error: 'Only team admins can manage access' });

    const { id } = req.params;
    const incoming = Array.isArray((req.body as any)?.collaborators) ? (req.body as any).collaborators : [];

    const { data: table, error: tableErr } = await supabase
      .from('custom_tables')
      .select('id,name,user_id,collaborators')
      .eq('id', id)
      .maybeSingle();
    if (tableErr) return res.status(500).json({ error: tableErr.message });
    if (!table) return res.status(404).json({ error: 'not_found' });

    const ownerId = String((table as any).user_id);

    // team_admin can only manage tables owned by their team
    if (!isSuper) {
      const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', ownerId).maybeSingle();
      const ownerTeam = (ownerRow as any)?.team_id || null;
      if (!me.team_id || !ownerTeam || me.team_id !== ownerTeam) return res.status(403).json({ error: 'access_denied' });
    }

    // Normalize incoming list (unique, valid role)
    const cleaned = parseCollaborators(incoming).filter((c) => c.user_id !== ownerId);

    // Verify all target users exist AND are recruiter-side
    const targetIds = cleaned.map((c) => c.user_id);
    if (targetIds.length > 50) return res.status(400).json({ error: 'too_many_collaborators' });
    if (targetIds.length) {
      const { data: targets, error: targetsErr } = await supabase
        .from('users')
        .select('id,role')
        .in('id', targetIds);
      if (targetsErr) return res.status(500).json({ error: targetsErr.message });
      const byId = new Map((targets || []).map((t: any) => [String(t.id), t]));
      const invalid = targetIds.filter((tid) => {
        const t = byId.get(String(tid));
        if (!t) return true;
        if (isJobSeekerRole(t.role)) return true;
        return false;
      });
      if (invalid.length) return res.status(400).json({ error: 'invalid_collaborators', invalid_user_ids: invalid });
    }

    // Replace collaborators list (canonical), owner is implicit
    const merged = cleaned;

    const { data: updated, error: upErr } = await supabase
      .from('custom_tables')
      .update({ collaborators: merged, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,name,user_id,collaborators')
      .maybeSingle();
    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.json({ table: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// POST /api/tables/:id/bulk-add
// Body: { entity: 'leads'|'candidates'|'opportunities'|'clients'|'contacts', ids: string[] }
// Recruiter-side only. Appends rows into custom_tables.data_json and expands schema_json as needed.
router.post('/:id/bulk-add', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const { id: tableId } = req.params as any;
    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});

    const normalizeEntity = (raw: any): 'leads'|'candidates'|'opportunities'|'clients'|'contacts'|null => {
      const v = String(raw || '').trim().toLowerCase();
      if (!v) return null;
      if (v === 'lead' || v === '/leads') return 'leads';
      if (v === 'candidate' || v === '/candidates') return 'candidates';
      if (v === 'deal' || v === 'deals' || v === '/deals' || v === 'opportunity' || v === 'opportunities' || v === '/opportunities') return 'opportunities';
      if (v === 'client' || v === 'clients' || v === '/clients') return 'clients';
      if (v === 'contact' || v === 'contacts' || v === 'decision_maker' || v === 'decisionmakers') return 'contacts';
      return null;
    };

    const entity = normalizeEntity(body.entity || body.source || body.type);
    if (!entity) return res.status(400).json({ error: 'invalid_entity' });

    const idsIn = Array.isArray(body.ids) ? body.ids : [];
    const ids = Array.from(new Set(idsIn.map((x: any) => String(x || '').trim()).filter(Boolean)));
    if (!ids.length) return res.status(400).json({ error: 'missing_ids' });
    if (ids.length > 1000) return res.status(400).json({ error: 'too_many_ids', limit: 1000 });

    const { data: table, error: tableErr } = await supabase
      .from('custom_tables')
      .select('id,name,user_id,collaborators,schema_json,data_json,import_sources')
      .eq('id', tableId)
      .maybeSingle();
    if (tableErr) return res.status(500).json({ error: tableErr.message });
    if (!table) return res.status(404).json({ error: 'not_found' });

    const ownerId = String((table as any).user_id);
    const collabs = parseCollaborators((table as any).collaborators);
    const canEdit = ownerId === userId || collabs.some((c) => String(c.user_id) === userId && c.role === 'edit');
    if (!canEdit) return res.status(403).json({ error: 'access_denied' });

    const existingSources: string[] = Array.isArray((table as any).import_sources)
      ? (table as any).import_sources.map((s: any) => String(s || '').toLowerCase()).filter(Boolean)
      : [];
    if (existingSources.length && !existingSources.includes(entity)) {
      return res.status(409).json({ error: 'table_source_mismatch', existing_sources: existingSources, requested: entity });
    }

    // ---- helpers for schema/rows ----
    const colLabelAny = (c: any) => String(c?.label || c?.name || c?.key || '').trim();
    const norm = (s: any) => String(s || '').trim().toLowerCase();
    const ensureCol = (schema: any[], label: string, type: any) => {
      const key = norm(label);
      if (!key) return schema;
      const exists = (schema || []).some((c) => norm(colLabelAny(c)) === key);
      if (exists) return schema;
      return [...(schema || []), { name: label, type }];
    };

    const existingSchema = Array.isArray((table as any).schema_json) ? (table as any).schema_json : [];
    const existingRows = Array.isArray((table as any).data_json) ? (table as any).data_json : [];

    const recordIdCol = 'Record ID';
    const recordTypeCol = 'Record Type';
    const existingRecordIds = new Set(
      existingRows
        .map((r: any) => (r && (r[recordIdCol] ?? r[norm(recordIdCol)] ?? r['hp_record_id'] ?? r['id'])) || null)
        .filter(Boolean)
        .map((v: any) => String(v))
    );

    const chunk = <T,>(arr: T[], size: number) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    // Team sharing helpers (for leads/candidates visibility)
    type TeamSharingSettings = {
      share_leads: boolean;
      share_candidates: boolean;
      allow_team_editing: boolean;
      team_admin_view_pool: boolean;
    };
    const DEFAULT_TEAM_SETTINGS: TeamSharingSettings = {
      share_leads: false,
      share_candidates: false,
      allow_team_editing: false,
      team_admin_view_pool: true,
    };
    const fetchTeamSettingsForTeam = async (teamId?: string | null): Promise<TeamSharingSettings> => {
      if (!teamId) return DEFAULT_TEAM_SETTINGS;
      const { data } = await supabase
        .from('team_settings')
        .select('share_leads, share_candidates, allow_team_editing, team_admin_view_pool')
        .eq('team_id', teamId)
        .maybeSingle();
      return {
        share_leads: !!(data as any)?.share_leads,
        share_candidates: !!(data as any)?.share_candidates,
        allow_team_editing: !!(data as any)?.allow_team_editing,
        team_admin_view_pool:
          (data as any)?.team_admin_view_pool === undefined || (data as any)?.team_admin_view_pool === null
            ? true
            : !!(data as any)?.team_admin_view_pool,
      };
    };

    const viewer = await supabase.from('users').select('team_id, role').eq('id', userId).maybeSingle();
    const viewerTeamId = (viewer.data as any)?.team_id || null;
    const viewerRole = String((viewer.data as any)?.role || '').toLowerCase();
    const isTeamAdmin = viewerRole === 'team_admin';
    const isAdmin = ['admin', 'team_admin', 'super_admin', 'superadmin'].includes(viewerRole);

    const teamSharing = viewerTeamId ? await fetchTeamSettingsForTeam(viewerTeamId) : DEFAULT_TEAM_SETTINGS;
    let teamUserIds: string[] = [];
    if (viewerTeamId) {
      const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', viewerTeamId);
      teamUserIds = (teamUsers || []).map((u: any) => String(u.id)).filter(Boolean);
    }

    const fetchVisibleLeads = async (): Promise<any[]> => {
      const fields = 'id,name,email,company,title,status,linkedin_url,phone,location,city,state,country,source,tags,created_at,updated_at,user_id,shared';
      let q: any = supabase.from('leads').select(fields).in('id', ids);
      if (viewerTeamId && teamUserIds.length > 0) {
        const otherTeamMembers = teamUserIds.filter((tid) => tid !== userId);
        if (isAdmin) {
          if (teamSharing.team_admin_view_pool) q = q.in('user_id', Array.from(new Set([userId, ...teamUserIds])));
          else q = q.eq('user_id', userId);
        } else if (teamSharing.share_leads) {
          q = q.in('user_id', Array.from(new Set([userId, ...teamUserIds])));
        } else {
          if (otherTeamMembers.length > 0) {
            q = q.or(`user_id.eq.${userId},and(user_id.in.(${otherTeamMembers.join(',')}),shared.eq.true)`);
          } else {
            q = q.eq('user_id', userId);
          }
        }
      } else {
        q = q.eq('user_id', userId);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
    };

    const fetchVisibleCandidates = async (): Promise<any[]> => {
      const fields = 'id,first_name,last_name,name,email,title,linkedin_url,status,phone,location,source,created_at,updated_at,user_id,shared,job_assigned';
      let q: any = supabase.from('candidates').select(fields).in('id', ids);
      if (viewerTeamId && teamUserIds.length > 0) {
        const otherTeamMembers = teamUserIds.filter((tid) => tid !== userId);
        if (isAdmin) {
          if (teamSharing.team_admin_view_pool) q = q.in('user_id', Array.from(new Set([userId, ...teamUserIds])));
          else q = q.eq('user_id', userId);
        } else if (teamSharing.share_candidates) {
          q = q.in('user_id', Array.from(new Set([userId, ...teamUserIds])));
        } else {
          if (otherTeamMembers.length > 0) {
            q = q.or(`user_id.eq.${userId},and(user_id.in.(${otherTeamMembers.join(',')}),shared.eq.true)`);
          } else {
            q = q.eq('user_id', userId);
          }
        }
      } else {
        q = q.eq('user_id', userId);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
    };

    const fetchOpportunities = async (): Promise<any[]> => {
      const fields = 'id,title,value,billing_type,stage,status,owner_id,client_id,created_at,forecast_date';
      let q: any = supabase.from('opportunities').select(fields).in('id', ids);
      // Mirror opportunities route: super admins scoped to self by default; team_admin can view team pool; others scoped to self.
      if (['super_admin','superadmin'].includes(viewerRole)) {
        q = q.eq('owner_id', userId);
      } else if (isTeamAdmin && viewerTeamId) {
        const idsTeam = teamUserIds.length ? teamUserIds : [userId];
        q = q.in('owner_id', idsTeam);
      } else {
        q = q.eq('owner_id', userId);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
    };

    const fetchClients = async (): Promise<any[]> => {
      const fields = 'id,name,domain,industry,revenue,location,stage,notes,created_at,owner_id';
      // Mirror clients route: always scope to authenticated user
      const { data, error } = await supabase.from('clients').select(fields).in('id', ids).eq('owner_id', userId);
      if (error) throw new Error(error.message);
      return data || [];
    };

    const fetchContacts = async (): Promise<any[]> => {
      const fields = 'id,client_id,name,title,email,phone,owner_id,created_at';
      // Safer-than-existing route: scope to owner_id for bulk export into tables
      const { data, error } = await supabase.from('contacts').select(fields).in('id', ids).eq('owner_id', userId);
      if (error) throw new Error(error.message);
      return data || [];
    };

    // ---- build mapped rows + schema defaults ----
    const toLeadRow = (l: any) => {
      const parts = [l?.city, l?.state, l?.country].filter(Boolean);
      const loc = parts.length ? parts.join(', ') : (l?.location || '');
      return {
        [recordTypeCol]: 'Lead',
        [recordIdCol]: String(l.id),
        Name: l?.name || '',
        Email: l?.email || '',
        Company: l?.company || '',
        Title: l?.title || '',
        Status: l?.status || '',
        LinkedIn: l?.linkedin_url || '',
        Phone: l?.phone || '',
        Location: loc,
        Source: l?.source || '',
        Tags: Array.isArray(l?.tags) ? l.tags.join(', ') : (l?.tags || ''),
        Created: l?.created_at || null,
        Updated: l?.updated_at || null,
      };
    };

    const toCandidateRow = (c: any) => {
      const fullName = (c?.name || [c?.first_name, c?.last_name].filter(Boolean).join(' ')).trim();
      return {
        [recordTypeCol]: 'Candidate',
        [recordIdCol]: String(c.id),
        Name: fullName || '',
        Email: c?.email || '',
        Title: c?.title || '',
        Status: c?.status || '',
        Job: c?.job_assigned || '',
        LinkedIn: c?.linkedin_url || '',
        Phone: c?.phone || '',
        Location: c?.location || '',
        Source: c?.source || '',
        Created: c?.created_at || null,
        Updated: c?.updated_at || null,
      };
    };

    const toClientRow = (cl: any) => ({
      [recordTypeCol]: 'Client',
      [recordIdCol]: String(cl.id),
      'Client Name': cl?.name || '',
      Domain: cl?.domain || '',
      Industry: cl?.industry || '',
      Revenue: (cl?.revenue ?? null),
      Location: cl?.location || '',
      Stage: cl?.stage || '',
      Notes: cl?.notes || '',
      Created: cl?.created_at || null,
    });

    const toContactRow = (dm: any, clientName: string) => ({
      [recordTypeCol]: 'Contact',
      [recordIdCol]: String(dm.id),
      Name: dm?.name || '',
      Title: dm?.title || '',
      Email: dm?.email || '',
      Phone: dm?.phone || '',
      Client: clientName || '',
      Created: dm?.created_at || null,
    });

    const toOppRow = (o: any, clientName: string, ownerName: string) => ({
      [recordTypeCol]: 'Opportunity',
      [recordIdCol]: String(o.id),
      'Deal Title': o?.title || '',
      Client: clientName || '',
      Value: (o?.value ?? null),
      Stage: o?.stage || '',
      Status: o?.status || '',
      'Billing Type': o?.billing_type || '',
      'Forecast Date': o?.forecast_date || null,
      Owner: ownerName || '',
      Created: o?.created_at || null,
    });

    const defaultSchemaForEntity = (ent: string) => {
      const base = [
        { name: recordTypeCol, type: 'text' },
        { name: recordIdCol, type: 'text' },
      ] as any[];
      if (ent === 'leads') {
        return [...base,
          { name: 'Name', type: 'text' },
          { name: 'Email', type: 'text' },
          { name: 'Company', type: 'text' },
          { name: 'Title', type: 'text' },
          { name: 'Status', type: 'status' },
          { name: 'LinkedIn', type: 'text' },
          { name: 'Phone', type: 'text' },
          { name: 'Location', type: 'text' },
          { name: 'Source', type: 'text' },
          { name: 'Tags', type: 'text' },
          { name: 'Created', type: 'date' },
          { name: 'Updated', type: 'date' },
        ];
      }
      if (ent === 'candidates') {
        return [...base,
          { name: 'Name', type: 'text' },
          { name: 'Email', type: 'text' },
          { name: 'Title', type: 'text' },
          { name: 'Status', type: 'status' },
          { name: 'Job', type: 'text' },
          { name: 'LinkedIn', type: 'text' },
          { name: 'Phone', type: 'text' },
          { name: 'Location', type: 'text' },
          { name: 'Source', type: 'text' },
          { name: 'Created', type: 'date' },
          { name: 'Updated', type: 'date' },
        ];
      }
      if (ent === 'clients') {
        return [...base,
          { name: 'Client Name', type: 'text' },
          { name: 'Domain', type: 'text' },
          { name: 'Industry', type: 'text' },
          { name: 'Revenue', type: 'number' },
          { name: 'Location', type: 'text' },
          { name: 'Stage', type: 'status' },
          { name: 'Notes', type: 'text' },
          { name: 'Created', type: 'date' },
        ];
      }
      if (ent === 'contacts') {
        return [...base,
          { name: 'Name', type: 'text' },
          { name: 'Title', type: 'text' },
          { name: 'Email', type: 'text' },
          { name: 'Phone', type: 'text' },
          { name: 'Client', type: 'text' },
          { name: 'Created', type: 'date' },
        ];
      }
      // opportunities
      return [...base,
        { name: 'Deal Title', type: 'text' },
        { name: 'Client', type: 'text' },
        { name: 'Value', type: 'number' },
        { name: 'Stage', type: 'status' },
        { name: 'Status', type: 'status' },
        { name: 'Billing Type', type: 'text' },
        { name: 'Forecast Date', type: 'date' },
        { name: 'Owner', type: 'text' },
        { name: 'Created', type: 'date' },
      ];
    };

    let newRows: any[] = [];

    if (entity === 'leads') {
      const leads = await fetchVisibleLeads();
      newRows = leads.map(toLeadRow);
    } else if (entity === 'candidates') {
      const cands = await fetchVisibleCandidates();
      newRows = cands.map(toCandidateRow);
    } else if (entity === 'clients') {
      const clients = await fetchClients();
      newRows = clients.map(toClientRow);
    } else if (entity === 'contacts') {
      const contacts = await fetchContacts();
      const clientIds = Array.from(new Set(contacts.map((c: any) => c.client_id).filter(Boolean).map(String)));
      const { data: clientRows } = clientIds.length
        ? await supabase.from('clients').select('id,name,domain').in('id', clientIds)
        : ({ data: [] as any[] } as any);
      const byClientId = new Map<string, string>((clientRows || []).map((c: any) => [String(c.id), String(c.name || c.domain || '')]));
      newRows = contacts.map((dm: any) => toContactRow(dm, byClientId.get(String(dm.client_id)) || ''));
    } else {
      const opps = await fetchOpportunities();
      const clientIds = Array.from(new Set(opps.map((o: any) => o.client_id).filter(Boolean).map(String)));
      const ownerIds = Array.from(new Set(opps.map((o: any) => o.owner_id).filter(Boolean).map(String)));
      const [{ data: clientRows }, { data: ownerRows }] = await Promise.all([
        clientIds.length ? supabase.from('clients').select('id,name,domain').in('id', clientIds) : Promise.resolve({ data: [] as any[] }),
        ownerIds.length ? supabase.from('users').select('id,first_name,last_name,email').in('id', ownerIds) : Promise.resolve({ data: [] as any[] }),
      ] as any);
      const byClientId = new Map<string, string>((clientRows || []).map((c: any) => [String(c.id), String(c.name || c.domain || '')]));
      const byOwnerId = new Map<string, string>((ownerRows || []).map((u: any) => [String(u.id), String(([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || ''))]));
      newRows = opps.map((o: any) => toOppRow(o, byClientId.get(String(o.client_id)) || '', byOwnerId.get(String(o.owner_id)) || ''));
    }

    // Dedup by Record ID
    const dedupedToAdd: any[] = [];
    let skipped = 0;
    for (const r of newRows) {
      const rid = r?.[recordIdCol] ? String(r[recordIdCol]) : '';
      if (rid && existingRecordIds.has(rid)) { skipped += 1; continue; }
      if (rid) existingRecordIds.add(rid);
      dedupedToAdd.push(r);
    }

    // Build schema: if empty, start with defaults for this entity; else keep existing and ensure any missing columns.
    let nextSchema: any[] = (existingSchema && existingSchema.length) ? [...existingSchema] : defaultSchemaForEntity(entity);
    // Always ensure base id/type columns exist
    nextSchema = ensureCol(nextSchema, recordTypeCol, 'text');
    nextSchema = ensureCol(nextSchema, recordIdCol, 'text');
    // Ensure columns for any new row keys
    const allKeys = Array.from(new Set(dedupedToAdd.flatMap((r: any) => Object.keys(r || {}))));
    const typeHint = (k: string) => {
      const kk = norm(k);
      if (kk.includes('created') || kk.includes('updated') || kk.includes('date')) return 'date';
      if (kk.includes('value') || kk.includes('revenue') || kk.includes('amount')) return 'number';
      if (kk === 'status' || kk === 'stage') return 'status';
      return 'text';
    };
    for (const k of allKeys) {
      if (!k) continue;
      nextSchema = ensureCol(nextSchema, k, typeHint(k));
    }

    const nextRows = [...existingRows, ...dedupedToAdd];
    const nextSources = existingSources.includes(entity) ? existingSources : [...existingSources, entity];
    if (!nextSources.length) nextSources.push(entity);

    const { data: updated, error: updErr } = await supabase
      .from('custom_tables')
      .update({
        schema_json: nextSchema,
        data_json: nextRows,
        import_sources: nextSources,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tableId)
      .select('id,name,import_sources')
      .maybeSingle();
    if (updErr) return res.status(500).json({ error: updErr.message });

    return res.json({
      success: true,
      table: updated,
      entity,
      requested: ids.length,
      mapped: newRows.length,
      added: dedupedToAdd.length,
      skipped,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'bulk_add_failed' });
  }
});

export default router;


