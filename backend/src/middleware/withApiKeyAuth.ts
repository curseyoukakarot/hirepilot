import type { Request, Response, NextFunction } from 'express';
import { supabaseDb } from '../../lib/supabase';

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
    // Try multiple sources for resilience: header (preferred), query, then body (for tools)
    const headerVal = req.headers['x-api-key'] as string | undefined;
    const queryVal = (req as any)?.query?.['x-api-key'] || (req as any)?.query?.api_key as string | undefined;
    const bodyVal = (req as any)?.body?.['x-api-key'] || (req as any)?.body?.api_key as string | undefined;
    const keyValue = (headerVal || queryVal || bodyVal || '').toString().trim();
    if (!keyValue) return null;

    // Validate key in api_keys table; prefer active keys.
    // Resilient lookup across common column names. Avoid .or() to handle missing columns cleanly.
    const candidateColumns = ['key','api_key','token','id'];
    let keyRow: any = null;
    const checked: string[] = [];
    for (const col of candidateColumns) {
      try {
        checked.push(col);
        const { data, error } = await (supabaseDb as any)
          .from('api_keys')
          .select('*')
          .eq(col as any, keyValue)
          .maybeSingle();
        if (error) {
          console.log(`[Auth] api_keys lookup error on column '${col}': ${error.message}`);
          continue;
        }
        if (data) {
          keyRow = data;
          console.log(`[Auth] API key matched via column '${col}'`);
          break;
        }
      } catch (e: any) {
        console.log(`[Auth] api_keys lookup exception on column '${col}': ${e?.message || String(e)}`);
      }
    }

    // If still not found or inactive, reject (no env fallback to avoid cross-tenant access)
    if (!keyRow) {
      console.warn(`[Auth] X-API-Key not found; columns checked: ${checked.join(', ')}`);
      return null;
    }
    if ((keyRow as any).is_active === false) {
      console.warn('[Auth] API key found but inactive (is_active=false)');
      return null;
    }

    // Fetch minimal user profile (best-effort)
    let user: any = null;
    try {
      const { data: userRow } = await supabaseDb
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


