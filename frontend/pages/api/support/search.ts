import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const base = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || '';
    const forwardUrl = base ? `${base.replace(/\/$/, '')}/api/support/search` : '';
    if (!forwardUrl) return res.status(500).json({ error: 'No backend configured' });
    const r = await fetch(forwardUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body || {}) });
    const body = await r.json().catch(() => ({}));
    return res.status(r.status).json(body);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'proxy failed' });
  }
}


