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
    const role = userMeta.role || userMeta.account_type || appMeta.role || user.role || null;

    (req as any).user = {
      id: user.id,
      email: user.email,
      role,
      first_name: userMeta.first_name,
      last_name: userMeta.last_name,
    };

    next();
  } catch (err) {
    // Do not leak details
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export default requireAuthUnified;


