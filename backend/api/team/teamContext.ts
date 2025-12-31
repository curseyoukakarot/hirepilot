import { supabaseDb } from '../../lib/supabase';

type TeamContext = {
  teamId: string | null;
  role: string | null;
  teamAdminId?: string | null;
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

  // Fallback: infer team from most recent invite sent by this user (common when team_id
  // wasn't backfilled for older team_admin accounts, but invites were created with team_id).
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
    if (inferredTeamId) {
      // Best-effort: persist for future lookups
      try {
        await supabaseDb.from('users').update({ team_id: inferredTeamId }).eq('id', userId);
      } catch {}
      // Best-effort: create team_members row if table exists
      try {
        await supabaseDb.from('team_members').upsert(
          [{ team_id: inferredTeamId, user_id: userId }],
          { onConflict: 'team_id,user_id' } as any
        );
      } catch {}
      // Best-effort: sync auth metadata (so future JWTs include it for frontend heuristics)
      try {
        const { data } = await supabaseDb.auth.admin.getUserById(userId);
        const authUser = data?.user;
        const nextMeta = { ...(authUser?.user_metadata as any), team_id: inferredTeamId };
        await supabaseDb.auth.admin.updateUserById(userId, { user_metadata: nextMeta } as any);
      } catch {}
      return { teamId: inferredTeamId, role: userRow?.role ?? null };
    }
  } catch {}

  // Last resort for team_admins: create a team and assign them.
  const normalizedRole = String(userRow?.role || '').toLowerCase();
  if (['team_admin', 'admin', 'super_admin', 'superadmin'].includes(normalizedRole)) {
    try {
      const { data: teamRow, error: teamErr } = await supabaseDb
        .from('teams')
        .insert({ name: `Team ${String(userId).slice(0, 8)}` })
        .select('id')
        .single();
      if (!teamErr) {
        const createdTeamId = (teamRow as any)?.id || null;
        if (createdTeamId) {
          try {
            await supabaseDb.from('users').update({ team_id: createdTeamId }).eq('id', userId);
          } catch {}
          try {
            await supabaseDb.from('team_members').upsert(
              [{ team_id: createdTeamId, user_id: userId }],
              { onConflict: 'team_id,user_id' } as any
            );
          } catch {}
          try {
            const { data } = await supabaseDb.auth.admin.getUserById(userId);
            const authUser = data?.user;
            const nextMeta = { ...(authUser?.user_metadata as any), team_id: createdTeamId };
            await supabaseDb.auth.admin.updateUserById(userId, { user_metadata: nextMeta } as any);
          } catch {}
          return { teamId: createdTeamId, role: userRow?.role ?? null };
        }
      }
    } catch {}
  }

  return { teamId: userRow?.team_id ?? null, role: userRow?.role ?? null };
}


