import { supabaseDb } from './supabase';

export type UserTeamContext = {
  teamId: string | null;
  role: string | null;
};

/**
 * Resolve a user's team + role using the backend service-role client.
 *
 * Supports:
 * - legacy membership via `users.team_id`
 * - newer membership via `team_members`
 * - fallback inference via `team_invites` (best-effort)
 */
export async function getUserTeamContextDb(userId: string): Promise<UserTeamContext> {
  // 1) users.team_id (legacy + common)
  try {
    const { data: userRow, error } = await supabaseDb
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .maybeSingle();
    if (!error && userRow?.team_id) {
      return { teamId: (userRow as any).team_id || null, role: (userRow as any).role ?? null };
    }
    // keep role even if no team
    const role = (userRow as any)?.role ?? null;

    // 2) team_members (preferred if present)
    const { data: membershipRow, error: membershipError } = await supabaseDb
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (!membershipError && membershipRow?.team_id) {
      return { teamId: (membershipRow as any).team_id || null, role };
    }

    // If team_members doesn't exist, PostgREST returns 42P01
    const membershipCode = (membershipError as any)?.code;
    if (membershipCode === '42P01') {
      return { teamId: (userRow as any)?.team_id ?? null, role };
    }

    // 3) infer from most recent invite sent by this user
    try {
      const { data: lastInvite } = await supabaseDb
        .from('team_invites')
        .select('team_id')
        .eq('invited_by', userId)
        .not('team_id', 'is', null as any)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const inferredTeamId = (lastInvite as any)?.team_id || null;
      if (inferredTeamId) return { teamId: inferredTeamId, role };
    } catch {}

    return { teamId: null, role };
  } catch {
    return { teamId: null, role: null };
  }
}


