import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export function getBearerToken(req: VercelRequest): string | null {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7);
  }
  // Fallback: Supabase cookie set by the front-end (if proxied through Next)
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/sb-access-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createSupabaseForRequest(req: VercelRequest) {
  const url = process.env.SUPABASE_URL as string;
  const anon = process.env.SUPABASE_ANON_KEY as string;
  const token = getBearerToken(req);
  return createClient(url, anon, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function assertAuth(token: string | null) {
  if (!token) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}


