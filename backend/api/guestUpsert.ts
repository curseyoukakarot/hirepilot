import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

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

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Try find existing user by email (no typed email filter; list and filter client-side)
    const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return res.status(500).json({ error: `List failed: ${listError.message}` });
    const existing = (users?.users || []).find(u => String(u.email || '').toLowerCase() === email);

    if (existing?.id) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { role: 'guest' },
      });
      if (updateError) return res.status(500).json({ error: `Update failed: ${updateError.message}` });
      return res.json({ id: existing.id, updated: true });
    }

    // Create if not exists
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'guest' },
    });
    if (createError) return res.status(500).json({ error: `Create failed: ${createError.message}` });
    return res.status(201).json({ id: created?.user?.id, created: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to upsert guest user' });
  }
}
