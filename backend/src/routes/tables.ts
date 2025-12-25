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
        const { data: inviter } = await supabase.from('users').select('email').eq('id', inviterId).maybeSingle();
        const inviterName = inviter?.email || 'a teammate';
        const subject = `You were added to a Table on HirePilot`;
        const html = `
          <p>${inviterName} added you as a collaborator to the table <strong>${table.name || 'Untitled Table'}</strong>.</p>
          <p><a href="${appUrl}/tables/${id}/edit">Open the table</a></p>
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
        const subject = `You were invited to collaborate on a Table in HirePilot`;
        const html = `
          <p>You were invited to collaborate on the table <strong>${table.name || 'Untitled Table'}</strong>.</p>
          <p>Create/sign in to your recruiter account, then open: <a href="${appUrl}/tables/${id}/edit">${appUrl}/tables/${id}/edit</a></p>
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
      const subject = `You were invited to collaborate on a Table in HirePilot`;
      const html = `
        <p>You were invited to collaborate on the table <strong>${table.name || 'Untitled Table'}</strong>.</p>
        <p>Create/sign in to your recruiter account, then open: <a href="${appUrl}/tables/${id}/edit">${appUrl}/tables/${id}/edit</a></p>
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

export default router;


