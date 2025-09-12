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

    // Create (or update) the user as confirmed to bypass email confirmation
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'guest' },
    });
    if (error) return res.status(400).json({ error: error.message });

    return res.status(201).json({ id: data.user?.id });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to create guest user' });
  }
}
