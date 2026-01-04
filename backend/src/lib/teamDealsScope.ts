import { supabaseDb } from './supabase';

export type DealsSharingContext = {
  isTeamAccount: boolean;
  teamAdminId: string | null; // canonical owner of the team plan (billing admin)
  teamId: string | null; // legacy teams table id, if present
  shareDeals: boolean;
  shareDealsMembers: boolean;
  visibleOwnerIds: string[];
  roleInTeam: 'admin' | 'member' | null;
  resolutionSource: 'team_credit_sharing' | 'team_members' | 'users.team_id' | 'metadata' | 'none';
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

async function resolveRoleFromUsersTable(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseDb.from('users').select('role').eq('id', userId).maybeSingle();
    const r = (data as any)?.role;
    return r ? String(r) : null;
  } catch {
    return null;
  }
}

async function resolveTeamFromCreditSharing(userId: string): Promise<{ teamAdminId: string | null; roleInTeam: 'admin' | 'member' | null; memberIds: string[]; source: DealsSharingContext['resolutionSource'] }> {
  // Highest priority signal for paid Team plans.
  // If viewer is admin, they show up as team_admin_id. If viewer is a seat, they show up as team_member_id.
  try {
    const { data: adminRows } = await supabaseDb
      .from('team_credit_sharing')
      .select('team_admin_id, team_member_id')
      .eq('team_admin_id', userId);
    if (Array.isArray(adminRows) && adminRows.length) {
      const memberIds = await fetchTeamMemberIdsByAdmin(userId);
      return { teamAdminId: userId, roleInTeam: 'admin', memberIds, source: 'team_credit_sharing' };
    }
  } catch {}

  const teamAdminId = await fetchTeamAdminIdForUser(userId);
  if (teamAdminId) {
    const memberIds = await fetchTeamMemberIdsByAdmin(teamAdminId);
    return { teamAdminId, roleInTeam: 'member', memberIds, source: 'team_credit_sharing' };
  }

  return { teamAdminId: null, roleInTeam: null, memberIds: [], source: 'none' };
}

async function resolveTeamFromLegacy(userId: string): Promise<{ teamId: string | null; roleInTeam: 'admin' | 'member' | null; memberIds: string[]; source: DealsSharingContext['resolutionSource'] }> {
  const adminRoles = new Set(['team_admin', 'team_admins', 'admin', 'super_admin', 'superadmin']);

  // users.team_id
  try {
    const { data: userRow, error } = await supabaseDb.from('users').select('team_id, role').eq('id', userId).maybeSingle();
    const teamId = (userRow as any)?.team_id ? String((userRow as any).team_id) : null;
    const role = String((userRow as any)?.role || '').toLowerCase();
    if (!error && teamId) {
      const memberIds = await fetchTeamMemberIds(teamId);
      return { teamId, roleInTeam: adminRoles.has(role) ? 'admin' : 'member', memberIds, source: 'users.team_id' };
    }
  } catch {}

  // team_members
  try {
    const { data: membershipRow, error: membershipError } = await supabaseDb
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (!membershipError && (membershipRow as any)?.team_id) {
      const teamId = String((membershipRow as any).team_id);
      const memberIds = await fetchTeamMemberIds(teamId);
      const role = (await resolveRoleFromUsersTable(userId)) || null;
      const roleLc = String(role || '').toLowerCase();
      return { teamId, roleInTeam: adminRoles.has(roleLc) ? 'admin' : 'member', memberIds, source: 'team_members' };
    }
  } catch {}

  // metadata.team_id (best-effort)
  try {
    const { data } = await supabaseDb.auth.admin.getUserById(userId);
    const u: any = data?.user || null;
    const meta: any = (u?.user_metadata || {}) as any;
    const metaTeamId = meta?.team_id ? String(meta.team_id) : null;
    if (metaTeamId) {
      // Best-effort: persist
      try { await supabaseDb.from('users').update({ team_id: metaTeamId }).eq('id', userId); } catch {}
      try {
        await supabaseDb.from('team_members').upsert(
          [{ team_id: metaTeamId, user_id: userId }],
          { onConflict: 'team_id,user_id' } as any
        );
      } catch {}
      const memberIds = await fetchTeamMemberIds(metaTeamId);
      const role = String(meta?.role || meta?.account_type || meta?.user_type || '').toLowerCase();
      return { teamId: metaTeamId, roleInTeam: adminRoles.has(role) ? 'admin' : 'member', memberIds, source: 'metadata' };
    }
  } catch {}

  return { teamId: null, roleInTeam: null, memberIds: [], source: 'none' };
}

/**
 * Deals visibility scope for team accounts.
 * - shareDeals defaults to ON
 * - when ON: all teammates can *view* all team deals (pool)
 * - when OFF: users see only their own deals
 */
export async function getDealsSharingContext(userId: string): Promise<DealsSharingContext> {
  // 1) Highest priority: paid Team plans via billing seats
  const credit = await resolveTeamFromCreditSharing(userId);
  let teamAdminId = credit.teamAdminId;
  let teamId: string | null = null;
  let roleInTeam: 'admin' | 'member' | null = credit.roleInTeam;
  let memberIds: string[] = credit.memberIds || [];
  let resolutionSource: DealsSharingContext['resolutionSource'] = credit.source;

  // 2) Fallback: legacy teams
  if (!teamAdminId) {
    const legacy = await resolveTeamFromLegacy(userId);
    teamId = legacy.teamId;
    roleInTeam = legacy.roleInTeam;
    memberIds = legacy.memberIds || [];
    resolutionSource = legacy.source;
  }

  const isTeamAccount = Boolean(teamAdminId || teamId);
  if (!isTeamAccount) {
    return {
      isTeamAccount: false,
      teamAdminId: null,
      teamId: null,
      shareDeals: false,
      shareDealsMembers: false,
      visibleOwnerIds: [userId],
      roleInTeam: null,
      resolutionSource: 'none',
    };
  }

  const settings = await fetchDealsSharingSettings({ teamId, teamAdminId });
  const shareDeals = settings.shareDeals;
  const shareDealsMembers = settings.shareDealsMembers;
  if (!shareDeals) {
    return {
      isTeamAccount: true,
      teamAdminId: teamAdminId || null,
      teamId: teamId || null,
      shareDeals: false,
      shareDealsMembers,
      visibleOwnerIds: [userId],
      roleInTeam,
      resolutionSource,
    };
  }

  // If viewer is member and member pooling is disabled, restrict to self.
  if (roleInTeam === 'member' && !shareDealsMembers) {
    return {
      isTeamAccount: true,
      teamAdminId: teamAdminId || null,
      teamId: teamId || null,
      shareDeals: true,
      shareDealsMembers,
      visibleOwnerIds: [userId],
      roleInTeam,
      resolutionSource,
    };
  }

  // Pooling enabled: show all owners in the resolved team set (+ explicit admin if known).
  const owners = new Set<string>();
  (memberIds || []).forEach(id => id && owners.add(String(id)));
  if (teamAdminId) owners.add(String(teamAdminId));
  owners.add(String(userId));

  return {
    isTeamAccount: true,
    teamAdminId: teamAdminId || null,
    teamId: teamId || null,
    shareDeals: true,
    shareDealsMembers,
    visibleOwnerIds: Array.from(owners),
    roleInTeam,
    resolutionSource,
  };
}


