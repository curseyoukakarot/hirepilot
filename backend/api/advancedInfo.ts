import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function advancedInfo(req: Request, res: Response) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) return res.status(500).json({ error: 'Server auth is not configured' });

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    let userId = String(req.headers['x-user-id'] || '').trim();
    let userEmail = String((req.query.email as any) || req.headers['x-user-email'] || '').trim().toLowerCase();
    if (!userId) {
      const bearer = String(req.headers.authorization || '').split(' ')[1] || '';
      if (bearer) {
        try {
          const { data } = await admin.auth.getUser(bearer);
          userId = data.user?.id || '';
        } catch {}
      }
    }
    if (!userId && userEmail) {
      try {
        const adminBase = `${url}/auth/v1`;
        const headers = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } as any;
        const findResp = await fetch(`${adminBase}/admin/users?email=${encodeURIComponent(userEmail)}`, { headers });
        if (findResp.ok) {
          const found = await findResp.json();
          const u = Array.isArray(found?.users) ? found.users[0] : (found?.id ? found : null);
          if (u?.id) userId = u.id;
        }
      } catch {}
    }
    if (!userId) return res.status(400).json({ error: 'Missing user_id' });

    // Fetch recent campaigns if table exists
    let campaigns: any[] = [];
    try {
      const { data } = await admin
        .from('campaigns')
        .select('id,name,created_at,status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
      campaigns = data || [];
    } catch {}

    return res.json({ user_id: userId, campaigns });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to load advanced info' });
  }
}
