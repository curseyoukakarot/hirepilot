import { Request, Response } from 'express';

export default async function guestUpsert(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    let { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    email = String(email).trim().toLowerCase();
    password = String(password);

    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) return res.status(500).json({ error: 'Server auth is not configured' });

    const adminBase = `${url}/auth/v1`;
    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    } as any;

    // 1) Try to find existing user by email
    const findResp = await fetch(`${adminBase}/admin/users?email=${encodeURIComponent(email)}`, { headers });
    if (!findResp.ok) {
      const t = await findResp.text();
      return res.status(findResp.status).json({ error: `Lookup failed: ${t}` });
    }
    const found = await findResp.json();
    const user = Array.isArray(found?.users) ? found.users[0] : (found?.id ? found : null);

    if (user?.id) {
      // 2) Update password and confirm
      const upd = await fetch(`${adminBase}/admin/users/${user.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ password, email_confirm: true, user_metadata: { role: 'guest' } }),
      });
      if (!upd.ok) {
        const t = await upd.text();
        return res.status(upd.status).json({ error: `Update failed: ${t}` });
      }
      return res.json({ id: user.id, updated: true });
    }

    // 3) Create if not exists
    const crt = await fetch(`${adminBase}/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { role: 'guest' } }),
    });
    if (!crt.ok) {
      const t = await crt.text();
      return res.status(crt.status).json({ error: `Create failed: ${t}` });
    }
    const created = await crt.json();
    return res.status(201).json({ id: created?.id || created?.user?.id, created: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to upsert guest user' });
  }
}
