import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function guestSignup(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) return res.status(500).json({ error: 'Server auth is not configured' });

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Try create
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'guest' },
    });
    if (!created.error && created.data?.user?.id) {
      return res.status(201).json({ id: created.data.user.id, created: true });
    }

    // If already exists, find by email and update password/confirm via Admin REST
    const adminBase = `${url}/auth/v1`;
    const headers: any = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
    // lookup
    const findResp = await fetch(`${adminBase}/admin/users?email=${encodeURIComponent(email)}`, { headers });
    if (!findResp.ok) {
      const t = await findResp.text();
      return res.status(400).json({ error: `Lookup failed: ${t}` });
    }
    const body = await findResp.json();
    const user = Array.isArray(body?.users) ? body.users[0] : (body?.id ? body : null);
    if (!user?.id) return res.status(400).json({ error: 'User not found and create failed' });
    const upd = await fetch(`${adminBase}/admin/users/${user.id}`, { method: 'PUT', headers, body: JSON.stringify({ password, email_confirm: true, user_metadata: { role: 'guest' } }) });
    if (!upd.ok) {
      const t = await upd.text();
      return res.status(upd.status).json({ error: `Update failed: ${t}` });
    }
    return res.json({ id: user.id, updated: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to create guest user' });
  }
}
