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
 * - team seats via `team_credit_sharing` (best-effort admin team_id)
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
    let role = (userRow as any)?.role ?? null;

    // Fetch auth user (metadata often contains team_id/role even when DB row is missing/incomplete)
    let authTeamId: string | null = null;
    let authRole: string | null = null;
    let authEmail: string | null = null;
    let authFirst: string | null = null;
    let authLast: string | null = null;
    try {
      const { data } = await supabaseDb.auth.admin.getUserById(userId);
      const u: any = data?.user || null;
      const meta: any = (u?.user_metadata || {}) as any;
      const app: any = (u?.app_metadata || {}) as any;
      authTeamId = meta?.team_id ? String(meta.team_id) : null;
      authRole = (meta?.role || meta?.account_type || meta?.user_type || app?.role || null)
        ? String(meta?.role || meta?.account_type || meta?.user_type || app?.role || '').toLowerCase()
        : null;
      authEmail = u?.email ? String(u.email).toLowerCase() : null;
      authFirst = meta?.first_name ? String(meta.first_name) : null;
      authLast = meta?.last_name ? String(meta.last_name) : null;
    } catch {}
    if (!role && authRole) role = authRole;

    // 2) team_members (preferred if present)
    const { data: membershipRow, error: membershipError } = await supabaseDb
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (!membershipError && membershipRow?.team_id) {
      const t = (membershipRow as any).team_id || null;
      // Best-effort: persist legacy users.team_id for compatibility
      try { if (t) await supabaseDb.from('users').update({ team_id: t }).eq('id', userId); } catch {}
      return { teamId: t, role };
    }

    // If team_members doesn't exist, PostgREST returns 42P01
    const membershipCode = (membershipError as any)?.code;
    if (membershipCode === '42P01') {
      return { teamId: (userRow as any)?.team_id ?? null, role };
    }

  // 2b) team_credit_sharing (team seats without team_id)
  try {
    const { data: creditRow, error: creditErr } = await supabaseDb
      .from('team_credit_sharing')
      .select('team_admin_id')
      .eq('team_member_id', userId)
      .maybeSingle();
    if (!creditErr && (creditRow as any)?.team_admin_id) {
      const adminId = String((creditRow as any).team_admin_id);
      let inferredTeamId: string | null = null;
      try {
        const { data: adminRow } = await supabaseDb
          .from('users')
          .select('team_id')
          .eq('id', adminId)
          .maybeSingle();
        inferredTeamId = (adminRow as any)?.team_id ? String((adminRow as any).team_id) : null;
      } catch {}
      if (inferredTeamId) {
        try { await supabaseDb.from('users').update({ team_id: inferredTeamId }).eq('id', userId); } catch {}
        try {
          await supabaseDb.from('team_members').upsert(
            [{ team_id: inferredTeamId, user_id: userId }],
            { onConflict: 'team_id,user_id' } as any
          );
        } catch {}
      }
      return { teamId: inferredTeamId, role };
    }
  } catch {}

    // 3) infer from auth metadata team_id (common for team seats)
    if (authTeamId) {
      // Best-effort: ensure users row exists + persist team_id
      try {
        // Insert minimal users row if missing (schema varies across envs; retry without team_id if needed)
        if (!userRow) {
          const email = authEmail || `unknown+${String(userId).slice(0, 8)}@noemail.hirepilot`;
          const first = authFirst || (email.split('@')[0] || 'User');
          const last = authLast || 'Member';
          const normalizedRole = role ? String(role).toLowerCase() : 'member';
          const attempt = await supabaseDb.from('users').insert({
            id: userId,
            email,
            first_name: first,
            last_name: last,
            role: normalizedRole,
            team_id: authTeamId
          } as any);
          if ((attempt as any)?.error && mentionMissingColumn((attempt as any).error, 'team_id')) {
            await supabaseDb.from('users').insert({
              id: userId,
              email,
              first_name: first,
              last_name: last,
              role: normalizedRole,
            } as any);
            try { await supabaseDb.from('users').update({ team_id: authTeamId }).eq('id', userId); } catch {}
          }
        } else {
          await supabaseDb.from('users').update({ team_id: authTeamId }).eq('id', userId);
        }
      } catch {}
      // Best-effort: create team_members row if table exists
      try {
        await supabaseDb.from('team_members').upsert(
          [{ team_id: authTeamId, user_id: userId }],
          { onConflict: 'team_id,user_id' } as any
        );
      } catch {}
      return { teamId: authTeamId, role };
    }

    // 4) infer from team_invites by email (only works in envs where team_invites has team_id)
    try {
      if (authEmail) {
        const inv = await supabaseDb
          .from('team_invites')
          .select('team_id,status')
          .eq('email', authEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const inferredTeamId = (inv.data as any)?.team_id || null;
        const status = String((inv.data as any)?.status || '').toLowerCase();
        if (inferredTeamId && (!status || status === 'accepted' || status === 'pending')) {
          try { await supabaseDb.from('users').update({ team_id: inferredTeamId }).eq('id', userId); } catch {}
          try {
            await supabaseDb.from('team_members').upsert(
              [{ team_id: inferredTeamId, user_id: userId }],
              { onConflict: 'team_id,user_id' } as any
            );
          } catch {}
          return { teamId: inferredTeamId, role };
        }
      }
    } catch {}

    return { teamId: null, role };
  } catch {
    return { teamId: null, role: null };
  }
}

function mentionMissingColumn(err: any, col: string): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return code === '42703' || (msg.includes(col) && msg.includes('does not exist'));
}


