import { supabaseDb } from './supabase';
import { getUserTeamContextDb } from './userTeamContext';

export type DealsSharingContext = {
  teamId: string | null;
  teamAdminId: string | null;
  role: string | null;
  shareDeals: boolean;
  shareDealsMembers: boolean;
  visibleOwnerIds: string[];
};

async function fetchTeamAdminIdForUser(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseDb
      .from('team_credit_sharing')
      .select('team_admin_id')
      .eq('team_member_id', userId)
      .maybeSingle();
    if (error) return null;
    const id = (data as any)?.team_admin_id;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

async function fetchTeamMemberIdsByAdmin(teamAdminId: string): Promise<string[]> {
  const ids = new Set<string>();
  ids.add(String(teamAdminId));
  try {
    const { data } = await supabaseDb
      .from('team_credit_sharing')
      .select('team_member_id')
      .eq('team_admin_id', teamAdminId);
    (data || []).forEach((r: any) => {
      const id = String(r?.team_member_id || '').trim();
      if (id) ids.add(id);
    });
  } catch {}
  return Array.from(ids);
}

async function fetchTeamMemberIds(teamId: string): Promise<string[]> {
  // Robust: union both membership sources (some envs have partial `team_members` data).
  const ids = new Set<string>();

  // 1) team_members (newer schema)
  try {
    const { data, error } = await supabaseDb
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);
    if (!error && Array.isArray(data)) {
      (data || []).forEach((r: any) => {
        const id = String(r?.user_id || '').trim();
        if (id) ids.add(id);
      });
    }
    // If table doesn't exist, PostgREST uses 42P01; ignore and rely on users.team_id below.
  } catch {}

  // 2) users.team_id (legacy + still authoritative for many team_admin accounts)
  try {
    const { data } = await supabaseDb.from('users').select('id').eq('team_id', teamId);
    (data || []).forEach((u: any) => {
      const id = String(u?.id || '').trim();
      if (id) ids.add(id);
    });
  } catch {}

  return Array.from(ids);
}

async function fetchDealsSharingSettings(params: { teamId?: string | null; teamAdminId?: string | null }): Promise<{ shareDeals: boolean; shareDealsMembers: boolean }> {
  // Defaults should be ON for teams (preserve pooled behavior)
  const defaults = { shareDeals: true, shareDealsMembers: true };
  const teamId = params.teamId || null;
  const teamAdminId = params.teamAdminId || null;
  try {
    // If team_id schema exists and we have a teamId, use it.
    if (teamId) {
      const { data, error } = await supabaseDb
        .from('team_settings')
        .select('share_deals, share_deals_members')
        .eq('team_id', teamId)
        .maybeSingle();
      if (!error) {
        if (!data) return defaults;
        const rawDeals = (data as any).share_deals;
        const rawMembers = (data as any).share_deals_members;
        return {
          shareDeals: rawDeals === undefined || rawDeals === null ? defaults.shareDeals : !!rawDeals,
          shareDealsMembers: rawMembers === undefined || rawMembers === null ? defaults.shareDealsMembers : !!rawMembers,
        };
      }
      // If error is about missing team_id, fall through to admin-scoped below.
    }

    // Admin-scoped schema: team_settings.team_admin_id
    if (teamAdminId) {
      const attempt = await supabaseDb
        .from('team_settings')
        .select('share_deals, share_deals_members')
        .eq('team_admin_id', teamAdminId)
        .maybeSingle();
      if (!attempt.error) {
        const rawDeals = (attempt.data as any)?.share_deals;
        const rawMembers = (attempt.data as any)?.share_deals_members;
        return {
          shareDeals: rawDeals === undefined || rawDeals === null ? defaults.shareDeals : !!rawDeals,
          shareDealsMembers: rawMembers === undefined || rawMembers === null ? defaults.shareDealsMembers : !!rawMembers,
        };
      }
      // If columns are missing, fail open.
    }

    // Legacy fallback: try to locate an admin for a teamId if provided.
    if (teamId) {
      const { data: adminUser } = await supabaseDb
        .from('users')
        .select('id')
        .eq('team_id', teamId)
        .in('role', ['admin', 'team_admin', 'team_admins', 'super_admin', 'superadmin'] as any)
        .limit(1)
        .maybeSingle();
      const adminId = (adminUser as any)?.id ? String((adminUser as any).id) : null;
      if (adminId) {
        const attempt = await supabaseDb
          .from('team_settings')
          .select('share_deals, share_deals_members')
          .eq('team_admin_id', adminId)
          .maybeSingle();
        const rawDeals = (attempt.data as any)?.share_deals;
        const rawMembers = (attempt.data as any)?.share_deals_members;
        return {
          shareDeals: rawDeals === undefined || rawDeals === null ? defaults.shareDeals : !!rawDeals,
          shareDealsMembers: rawMembers === undefined || rawMembers === null ? defaults.shareDealsMembers : !!rawMembers,
        };
      }
    }

    return defaults;
  } catch {
    return defaults;
  }

  // unreachable
  /* istanbul ignore next */
  return defaults;
}

/**
 * Deals visibility scope for team accounts.
 * - shareDeals defaults to ON
 * - when ON: all teammates can *view* all team deals (pool)
 * - when OFF: users see only their own deals
 */
export async function getDealsSharingContext(userId: string): Promise<DealsSharingContext> {
  const { teamId, role } = await getUserTeamContextDb(userId);
  const roleLc = String(role || '').toLowerCase();
  const isAdminRole = ['team_admin', 'team_admins', 'admin', 'super_admin', 'superadmin'].includes(roleLc);

  // Determine team identifier:
  // - Prefer explicit teamId (teams/team_members)
  // - Otherwise fall back to billing team mapping via team_credit_sharing (team_admin_id)
  let teamAdminId: string | null = null;
  if (!teamId) {
    teamAdminId = isAdminRole ? userId : await fetchTeamAdminIdForUser(userId);
  }

  // If we still don't have any team context, scope to self.
  if (!teamId && !teamAdminId) {
    return { teamId: null, teamAdminId: null, role: role ?? null, shareDeals: false, shareDealsMembers: false, visibleOwnerIds: [userId] };
  }

  const settings = await fetchDealsSharingSettings({ teamId, teamAdminId });
  const shareDeals = settings.shareDeals;
  const shareDealsMembers = settings.shareDealsMembers;
  if (!shareDeals) {
    return { teamId: teamId || null, teamAdminId: teamAdminId || null, role: role ?? null, shareDeals: false, shareDealsMembers, visibleOwnerIds: [userId] };
  }

  // Admins always see pool when shareDeals is enabled.
  // Members only see pool when shareDealsMembers is enabled.
  if (!isAdminRole && !shareDealsMembers) {
    return { teamId: teamId || null, teamAdminId: teamAdminId || null, role: role ?? null, shareDeals: true, shareDealsMembers, visibleOwnerIds: [userId] };
  }

  // Visible owners list
  let ids: string[] = [];
  if (teamId) {
    ids = await fetchTeamMemberIds(teamId);
  } else if (teamAdminId) {
    ids = await fetchTeamMemberIdsByAdmin(teamAdminId);
  }
  const unique = Array.from(new Set([...(ids || []), userId, ...(teamAdminId ? [teamAdminId] : [])])).filter(Boolean);
  return { teamId: teamId || null, teamAdminId: teamAdminId || null, role: role ?? null, shareDeals: true, shareDealsMembers, visibleOwnerIds: unique.length ? unique : [userId] };
}


