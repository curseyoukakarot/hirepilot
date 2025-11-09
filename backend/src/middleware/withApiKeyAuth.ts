import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export type ApiKeyAuthContext = {
  userId: string;
  user: any | null;
  keyId: string;
  source: 'api_key';
};

/**
 * Attempt to authenticate the request using an X-API-Key header.
 * Returns a context if valid, otherwise null. Does not throw.
 */
export async function withApiKeyAuth(req: Request): Promise<ApiKeyAuthContext | null> {
  try {
    const headerVal = req.headers['x-api-key'] as string | undefined;
    if (!headerVal) return null;

    // Validate key in api_keys table; prefer active keys
    const { data: keyRow } = await supabase
      .from('api_keys')
      .select('id,key,user_id,is_active')
      .eq('key', headerVal)
      .maybeSingle();
    if (!keyRow || (keyRow as any).is_active === false) {
      console.warn('[Auth] X-API-Key provided but not valid/active');
      return null;
    }

    // Fetch minimal user profile (best-effort)
    let user: any = null;
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('id,email,first_name,last_name,role,team_id,plan')
        .eq('id', (keyRow as any).user_id)
        .maybeSingle();
      user = userRow || null;
    } catch {}

    return {
      userId: (keyRow as any).user_id,
      user,
      keyId: (keyRow as any).id,
      source: 'api_key'
    };
  } catch {
    return null;
  }
}

/**
 * Express middleware that attaches req.user when a valid X-API-Key is provided.
 * Safe to mount globally; no-ops when header is absent or invalid.
 */
export async function attachApiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    // Do not override if a user was already attached (e.g., by session/JWT)
    if ((req as any).user?.id) return next();
    const ctx = await withApiKeyAuth(req);
    if (ctx?.userId) {
      (req as any).user = {
        id: ctx.userId,
        email: ctx.user?.email || null,
        role: ctx.user?.role || 'api_key',
        first_name: ctx.user?.first_name || null,
        last_name: ctx.user?.last_name || null,
        plan: ctx.user?.plan || null,
        team_id: ctx.user?.team_id || null,
        _auth_source: ctx.source,
        _api_key_id: ctx.keyId
      };
      console.log('[Auth] Authenticated via API key for user_id', ctx.userId);
    }
  } catch {
    // swallow; behave like unauthenticated
  } finally {
    next();
  }
}


