import { supabaseDb } from './supabase';
import { getUserTeamContextDb } from './userTeamContext';

const PAID_ROLES = new Set([
  'member',
  'admin',
  'team_admin',
  'team_admins',
  'recruitpro',
  'recruit_pro',
  'recruiter_pro',
  'super_admin',
  'superadmin',
]);

/**
 * Deals entitlement gate.
 *
 * Rule: ONLY block when the user is explicitly "free/guest".
 * Team accounts should NEVER be blocked by stale subscription data.
 */
export async function isDealsEntitled(userId: string): Promise<boolean> {
  // Prefer role/team context (supports team_members + legacy users.team_id).
  const ctx = await getUserTeamContextDb(userId);
  const roleLc = String(ctx.role || '').toLowerCase();

  // Paid roles are always allowed (even if subscriptions table is stale).
  if (PAID_ROLES.has(roleLc)) return true;

  // Any team member should be allowed (team deals should never be blocked by default).
  if (ctx.teamId) return true;

  // Explicit free/guest blocks
  if (roleLc === 'guest' || roleLc === 'free') return false;

  // Subscription-based explicit free block
  try {
    const { data: sub } = await supabaseDb
      .from('subscriptions')
      .select('plan_tier')
      .eq('user_id', userId)
      .maybeSingle();
    const tier = String((sub as any)?.plan_tier || '').toLowerCase();
    if (tier === 'free') return false;
    if (!tier) {
      const { data: usr } = await supabaseDb.from('users').select('plan').eq('id', userId).maybeSingle();
      const plan = String((usr as any)?.plan || '').toLowerCase();
      if (plan === 'free') return false;
    }
  } catch {}

  // Default allow (do not gate on missing/unknown)
  return true;
}


