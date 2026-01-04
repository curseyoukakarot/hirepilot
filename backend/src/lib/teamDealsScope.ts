import { supabaseDb } from './supabase';
import { getUserTeamContextDb } from './userTeamContext';

export type DealsSharingContext = {
  teamId: string | null;
  role: string | null;
  shareDeals: boolean;
  shareDealsMembers: boolean;
  visibleOwnerIds: string[];
};

async function fetchTeamMemberIds(teamId: string): Promise<string[]> {
  // Prefer team_members if present (newer schema)
  try {
    const { data, error } = await supabaseDb
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);
    if (!error && Array.isArray(data) && data.length) {
      return data.map((r: any) => String(r.user_id)).filter(Boolean);
    }
    // If table doesn't exist, PostgREST uses 42P01; fall through to legacy
  } catch {}

  // Legacy: users.team_id
  const { data } = await supabaseDb.from('users').select('id').eq('team_id', teamId);
  return (data || []).map((u: any) => String(u.id)).filter(Boolean);
}

async function fetchDealsSharingSettings(teamId: string): Promise<{ shareDeals: boolean; shareDealsMembers: boolean }> {
  // Defaults should be ON for teams (preserve pooled behavior)
  const defaults = { shareDeals: true, shareDealsMembers: true };
  try {
    const { data, error } = await supabaseDb
      .from('team_settings')
      .select('share_deals, share_deals_members')
      .eq('team_id', teamId)
      .maybeSingle();
    if (error) {
      // Column/team_id may not exist in some envs; attempt admin-scoped schema, then fail open.
      const code = String((error as any)?.code || '');
      const msg = String((error as any)?.message || '');
      const teamIdMissing = code === '42703' || msg.includes('team_id') && msg.includes('does not exist');
      if (teamIdMissing) {
        try {
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
        } catch {}
      }
      if (code === '42P01') return defaults;
      return defaults;
    }
    if (!data) return defaults;
    const rawDeals = (data as any).share_deals;
    const rawMembers = (data as any).share_deals_members;
    return {
      shareDeals: rawDeals === undefined || rawDeals === null ? defaults.shareDeals : !!rawDeals,
      shareDealsMembers: rawMembers === undefined || rawMembers === null ? defaults.shareDealsMembers : !!rawMembers,
    };
  } catch {
    return defaults;
  }
}

/**
 * Deals visibility scope for team accounts.
 * - shareDeals defaults to ON
 * - when ON: all teammates can *view* all team deals (pool)
 * - when OFF: users see only their own deals
 */
export async function getDealsSharingContext(userId: string): Promise<DealsSharingContext> {
  const { teamId, role } = await getUserTeamContextDb(userId);
  if (!teamId) {
    return { teamId: null, role: role ?? null, shareDeals: false, shareDealsMembers: false, visibleOwnerIds: [userId] };
  }

  const settings = await fetchDealsSharingSettings(teamId);
  const shareDeals = settings.shareDeals;
  const shareDealsMembers = settings.shareDealsMembers;
  if (!shareDeals) {
    return { teamId, role: role ?? null, shareDeals: false, shareDealsMembers, visibleOwnerIds: [userId] };
  }

  const roleLc = String(role || '').toLowerCase();
  const isAdmin = ['team_admin', 'team_admins', 'admin', 'super_admin', 'superadmin'].includes(roleLc);
  // Admins always see pool when shareDeals is enabled.
  // Members only see pool when shareDealsMembers is enabled.
  if (!isAdmin && !shareDealsMembers) {
    return { teamId, role: role ?? null, shareDeals, shareDealsMembers, visibleOwnerIds: [userId] };
  }

  const ids = await fetchTeamMemberIds(teamId);
  const unique = Array.from(new Set([...(ids || []), userId])).filter(Boolean);
  return { teamId, role: role ?? null, shareDeals: true, shareDealsMembers, visibleOwnerIds: unique.length ? unique : [userId] };
}


