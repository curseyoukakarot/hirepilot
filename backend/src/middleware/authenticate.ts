import type { Request } from 'express';
import { withApiKeyAuth } from './withApiKeyAuth';
import { supabase } from '../lib/supabase';

export type AuthResult = {
  userId: string;
  user: any | null;
  source: 'api_key' | 'session';
};

export async function authenticate(req: Request): Promise<AuthResult | null> {
  // 1) API Key
  try {
    const apiKeyAuth = await withApiKeyAuth(req);
    if (apiKeyAuth) {
      console.log(`[Auth] Authenticated via API key for user_id ${apiKeyAuth.userId}`);
      return { userId: apiKeyAuth.userId, user: apiKeyAuth.user, source: 'api_key' };
    }
  } catch {}

  // 2) Session (Bearer or hp_session cookie)
  try {
    let token: string | null = null;
    const authHeader = String(req.headers.authorization || '');
    if (authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1] || null;
    if (!token) {
      const cookieToken = (req as any)?.cookies?.hp_session as string | undefined;
      if (cookieToken) token = cookieToken;
    }
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const u = data.user as any;
        console.log(`[Auth] Authenticated via session for user_id ${u.id}`);
        return { userId: u.id, user: u, source: 'session' };
      }
    }
  } catch {}

  // 3) Neither
  return null;
}


