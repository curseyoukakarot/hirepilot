import { supabaseDb } from './supabase';
import { getUserTeamContextDb } from './userTeamContext';

export type DealsSharingContext = {
  teamId: string | null;
  role: string | null;
  shareDeals: boolean;
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

async function fetchShareDeals(teamId: string): Promise<boolean> {
  // Default should be ON for teams
  const defaultValue = true;
  try {
    const { data, error } = await supabaseDb
      .from('team_settings')
      .select('share_deals')
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
              .select('share_deals')
              .eq('team_admin_id', adminId)
              .maybeSingle();
            const raw = (attempt.data as any)?.share_deals;
            return raw === undefined || raw === null ? defaultValue : !!raw;
          }
        } catch {}
      }
      if (code === '42P01') return defaultValue;
      return defaultValue;
    }
    if (!data) return defaultValue;
    const raw = (data as any).share_deals;
    return raw === undefined || raw === null ? defaultValue : !!raw;
  } catch {
    return defaultValue;
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
    return { teamId: null, role: role ?? null, shareDeals: false, visibleOwnerIds: [userId] };
  }

  const shareDeals = await fetchShareDeals(teamId);
  if (!shareDeals) {
    return { teamId, role: role ?? null, shareDeals: false, visibleOwnerIds: [userId] };
  }

  const ids = await fetchTeamMemberIds(teamId);
  const unique = Array.from(new Set([...(ids || []), userId])).filter(Boolean);
  return { teamId, role: role ?? null, shareDeals: true, visibleOwnerIds: unique.length ? unique : [userId] };
}


