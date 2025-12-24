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
    const { data, error } = await supabase
      .from('users')
      .upsert({ id, email, role } as any, { onConflict: 'id' })
      .select('id,email,first_name,last_name,full_name,avatar_url,team_id,role')
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

async function getMe(userId: string): Promise<{ id: string; role: string; team_id: string | null; email: string | null }> {
  const { data } = await supabase.from('users').select('id,role,team_id,email').eq('id', userId).maybeSingle();
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

// GET /api/tables/users/search?q=...
// Recruiter-only user search for sharing tables.
router.get('/users/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const q = String((req.query as any)?.q || '').trim();
    const limit = Math.max(1, Math.min(50, Number((req.query as any)?.limit || 20) || 20));
    if (!q) return res.json({ users: [] });

    const term = `%${q.replace(/%/g, '').replace(/,/g, '')}%`;
    let query = supabase
      .from('users')
      .select('id,email,first_name,last_name,full_name,avatar_url,team_id,role')
      // NOTE: don't filter by role in SQL because role may be null in some envs.
      // We'll filter out job_seekers in JS to keep results reliable.
      .limit(Math.min(100, limit * 3));

    query = query.or(
      [
        `email.ilike.${term}`,
        `full_name.ilike.${term}`,
        `first_name.ilike.${term}`,
        `last_name.ilike.${term}`,
      ].join(',')
    );

    const { data, error } = await query.order('email', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

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
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const emailRaw = String((req.query as any)?.email || '').trim().toLowerCase();
    const qRaw = String((req.query as any)?.q || '').trim();

    let row: any | null = null;
    if (emailRaw) {
      const { data, error } = await supabase
        .from('users')
        .select('id,email,first_name,last_name,full_name,avatar_url,team_id,role')
        .eq('email', emailRaw)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      row = data || null;
      if (!row) {
        const authUser = await authAdminLookupByEmail(emailRaw);
        row = authUser ? await ensurePublicUserFromAuth(authUser) : null;
      }
    } else if (qRaw) {
      const term = `%${qRaw.replace(/%/g, '').replace(/,/g, '')}%`;
      const { data, error } = await supabase
        .from('users')
        .select('id,email,first_name,last_name,full_name,avatar_url,team_id,role')
        .or(
          [
            `email.ilike.${term}`,
            `full_name.ilike.${term}`,
            `first_name.ilike.${term}`,
            `last_name.ilike.${term}`,
          ].join(',')
        )
        .limit(5);
      if (error) return res.status(500).json({ error: error.message });
      const filtered = (Array.isArray(data) ? data : []).filter((u: any) => !isJobSeekerRole(u?.role));
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

// GET /api/tables/:id/collaborators-unified
router.get('/:id/collaborators-unified', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const me = await getMe(userId);
    if (isJobSeekerRole(me.role)) return res.status(403).json({ error: 'jobseeker_forbidden' });

    const { id } = req.params;
    const { data: table, error: tableErr } = await supabase
      .from('custom_tables')
      .select('id,name,user_id,collaborators')
      .eq('id', id)
      .maybeSingle();
    if (tableErr) return res.status(500).json({ error: tableErr.message });
    if (!table) return res.status(404).json({ error: 'not_found' });

    const ownerId = String((table as any).user_id);
    const collabs = parseCollaborators((table as any).collaborators);
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
    const { data: users } = ids.length
      ? await supabase.from('users').select('id,email,first_name,last_name,full_name,avatar_url,team_id,role').in('id', ids)
      : ({ data: [] } as any);
    const byId = new Map<string, UserLite>(((users || []) as any[]).map((u: any) => [String(u.id), u]));

    const owner = byId.get(ownerId) || ({ id: ownerId, email: null } as any);
    const collaborators = collabs.map((c) => ({
      user_id: c.user_id,
      role: c.role,
      user: byId.get(String(c.user_id)) || ({ id: c.user_id, email: null } as any),
    }));

    return res.json({
      table: { id: String((table as any).id), name: (table as any).name || null, owner_id: ownerId },
      owner,
      collaborators,
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


