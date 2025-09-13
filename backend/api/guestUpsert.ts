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

    // Try find existing user by email (paginate defensively)
    let existing: any | null = null;
    for (let page = 1; page <= 20 && !existing; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return res.status(500).json({ error: `List failed: ${error.message}` });
      existing = (data?.users || []).find(u => String(u.email || '').toLowerCase() === email) || null;
      if ((data?.users || []).length < 1000) break;
    }

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
    if (createError) return res.status(400).json({ error: `Create failed: ${createError.message}` });
    return res.status(201).json({ id: created?.user?.id, created: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to upsert guest user' });
  }
}
