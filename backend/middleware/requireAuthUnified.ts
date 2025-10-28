import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * Unified auth middleware that supports either:
 * - Bearer tokens in Authorization header
 * - HttpOnly cookie token (hp_session)
 *
 * This is additive and gated at the router level so we can roll it out safely.
 */
export async function requireAuthUnified(req: Request, res: Response, next: NextFunction) {
  try {
    // Allowlist: public/alternate-auth endpoints that handle their own auth (e.g., x-user-id)
    // Avoid blocking LinkedIn remote session bootstrap and streaming endpoints
    const path = String(req.path || '');
    if (path.startsWith('/linkedin/session') || path.startsWith('/stream')) {
      return next();
    }

    // Prefer explicit bearer when present
    let token: string | null = null;
    const authHeader = String(req.headers.authorization || '');
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1] || null;
    }

    // Fallback to cookie-based session token
    if (!token) {
      const cookieToken = (req as any)?.cookies?.hp_session as string | undefined;
      if (cookieToken) token = cookieToken;
    }

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const user = data.user as any;
    const appMeta = (user?.app_metadata || {}) as any;
    const userMeta = (user?.user_metadata || {}) as any;

    // Prefer canonical role/plan/credits from DB users table
    let dbRole: string | null = null;
    let dbPlan: string | null = null;
    let dbRemainingCredits: number | null = null;
    let dbMonthlyCredits: number | null = null;
    let dbIsGuest = false;
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('role, plan, remaining_credits, monthly_credits, is_guest')
        .eq('id', user.id)
        .single();
      if (userRow) {
        dbRole = userRow.role ?? null;
        dbPlan = userRow.plan ?? null;
        dbRemainingCredits = userRow.remaining_credits ?? null;
        dbMonthlyCredits = userRow.monthly_credits ?? null;
        dbIsGuest = Boolean(userRow.is_guest);
      }
    } catch {
      // non-fatal; fall through to metadata-based role
    }

    const resolvedRole = dbRole
      || userMeta.role
      || userMeta.account_type
      || appMeta.role
      || user.role
      || 'authenticated';

    (req as any).user = {
      id: user.id,
      email: user.email,
      role: resolvedRole,
      first_name: userMeta.first_name,
      last_name: userMeta.last_name,
      plan: dbPlan,
      remaining_credits: dbRemainingCredits,
      monthly_credits: dbMonthlyCredits,
      is_guest: dbIsGuest,
    };

    next();
  } catch (err) {
    // Do not leak details
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export default requireAuthUnified;


