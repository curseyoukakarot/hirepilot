import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function authDebug(req: Request, res: Response) {
  try {
    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    const admin = (url && serviceKey) ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

    const token = String(req.headers.authorization || '').split(' ')[1] || '';
    let tokenUser: any = null;
    if (token && admin) {
      try { const { data } = await admin.auth.getUser(token); tokenUser = data.user; } catch {}
    }

    const email = String(req.query.email || '').toLowerCase();
    let authUser: any = null;
    if (email && admin) {
      try {
        const adminBase = `${url}/auth/v1`;
        const headers = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } as any;
        const resp = await fetch(`${adminBase}/admin/users?email=${encodeURIComponent(email)}`, { headers });
        if (resp.ok) {
          const body = await resp.json();
          authUser = Array.isArray(body?.users) ? body.users[0] : (body?.id ? body : null);
        }
      } catch {}
    }

    res.json({
      beSupabaseUrl: url || null,
      serviceKeyHash: serviceKey ? serviceKey.slice(0, 6) : null,
      tokenSub: tokenUser?.id || null,
      tokenEmail: tokenUser?.email || null,
      queryEmail: email || null,
      authUserId: authUser?.id || null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'auth-debug failed' });
  }
}
