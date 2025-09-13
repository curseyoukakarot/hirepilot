import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function guestSignup(req: Request, res: Response) {
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

    // Try create
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'guest' },
    });
    if (!createError && created?.user?.id) {
      return res.status(201).json({ id: created.user.id, created: true });
    }

    // If create failed, continue by attempting to find existing user by email

    // If user likely exists, list and filter by email (iterate pages defensively)
    let existing: any | null = null;
    for (let page = 1; page <= 10 && !existing; page++) {
      const { data: users, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError) return res.status(500).json({ error: `List failed: ${listError.message}` });
      existing = (users?.users || []).find(u => String(u.email || '').toLowerCase() === email) || null;
      if ((users?.users || []).length < 1000) break; // no more pages
    }
    if (!existing?.id) return res.status(400).json({ error: 'User not found and create failed' });
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { role: 'guest' },
    });
    if (updateError) return res.status(500).json({ error: `Update failed: ${updateError.message}` });
    return res.json({ id: existing.id, updated: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to create guest user' });
  }
}
