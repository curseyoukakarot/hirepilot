import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function guestExists(req: Request, res: Response) {
  try {
    const emailRaw = (req.query.email || req.body?.email || '').toString();
    const email = emailRaw.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email required' });

    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) return res.status(500).json({ error: 'Server auth is not configured' });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    let exists = false;
    for (let page = 1; page <= 10 && !exists; page++) {
      const { data: users, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 } as any);
      if (error) throw error;
      exists = Boolean((users?.users || []).find(u => String(u.email || '').toLowerCase() === email));
      if ((users?.users || []).length < 1000) break;
    }

    res.json({ exists });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'failed' });
  }
}


