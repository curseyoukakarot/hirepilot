// Vercel edge/function-like Next-style API implemented in Vite project via rewrite to backend.
// We will forward this request to backend Express API if available; otherwise, insert directly using service envs.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { query, userId } = (req.body || {}) as { query?: string; userId?: string | null };
  if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Missing query' });

  // Prefer forwarding to backend /api/support/create if configured
  const base = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || '';
  const forwardUrl = base ? `${base.replace(/\/$/, '')}/api/support/create` : '';
  try {
    if (forwardUrl) {
      const resp = await fetch(forwardUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, userId: userId || null }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return res.status(200).json(data);
      }
    }
  } catch {}

  // Fallback: Insert directly using service role if available (for local dev)
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) throw new Error('Missing Supabase envs');
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('support_tickets')
      .insert([{ user_id: userId || null, query, status: 'open' }])
      .select()
      .single();
    if (error) throw error;

    // Slack webhook notify if set
    const hook = process.env.SLACK_SUPPORT_WEBHOOK_URL;
    if (hook) {
      await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `📩 New Support Ticket\nUser: ${userId || 'anon'}\nQuery: ${query}\nTicket ID: ${data.id}` }),
      }).catch(() => {});
    }
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to create ticket' });
  }
}


