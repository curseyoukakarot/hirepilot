import { Request, Response } from 'express';

export default async function guestStatus(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { emails } = req.body || {};
    if (!Array.isArray(emails)) return res.status(400).json({ error: 'emails must be an array' });

    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) return res.status(500).json({ error: 'Server auth is not configured' });

    const adminBase = `${url}/auth/v1`;
    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    } as any;

    const result: Record<string, boolean> = {};
    for (const rawEmail of emails) {
      const email = String(rawEmail || '').toLowerCase();
      if (!email) continue;
      try {
        const resp = await fetch(`${adminBase}/admin/users?email=${encodeURIComponent(email)}`, { headers });
        if (!resp.ok) { result[email] = false; continue; }
        const data = await resp.json();
        // Depending on response shape
        const found = Array.isArray(data?.users) ? data.users.length > 0 : !!data?.id;
        result[email] = !!found;
      } catch {
        result[email] = false;
      }
    }

    return res.json({ accepted: result });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to check guest status' });
  }
}
