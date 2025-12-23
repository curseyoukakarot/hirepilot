import { supabaseDb } from '../../lib/supabase';

type TeamContext = {
  teamId: string | null;
  role: string | null;
};

/**
 * Resolve the authenticated user's team + role.
 *
 * We support both legacy membership via `users.team_id` and newer membership via
 * `team_members` (which is what our RLS policies reference).
 */
export async function getUserTeamContext(userId: string): Promise<TeamContext> {
  // First try the simplest/legacy path: users.team_id
  const { data: userRow, error: userError } = await supabaseDb
    .from('users')
    .select('team_id, role')
    .eq('id', userId)
    .maybeSingle();

  if (!userError && userRow?.team_id) {
    return { teamId: userRow.team_id, role: userRow.role ?? null };
  }

  // If `users` query failed, keep going—we may still be able to infer team from team_members.
  // (This also covers cases where team_id wasn't populated but membership exists.)
  const { data: membershipRow, error: membershipError } = await supabaseDb
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!membershipError && membershipRow?.team_id) {
    return { teamId: membershipRow.team_id, role: userRow?.role ?? null };
  }

  // If the `team_members` table doesn't exist in a given env, PostgREST returns 42P01.
  // In that case we fall back to whatever we got from `users` (even if null).
  const membershipCode = (membershipError as any)?.code;
  if (membershipCode === '42P01') {
    return { teamId: userRow?.team_id ?? null, role: userRow?.role ?? null };
  }

  return { teamId: userRow?.team_id ?? null, role: userRow?.role ?? null };
}


