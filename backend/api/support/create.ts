import type { ApiHandler } from '../../apiRouter';
import { createClient } from '@supabase/supabase-js';

const handler: ApiHandler = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  try {
    const { query, userId } = (req.body || {}) as { query?: string; userId?: string | null };
    if (!query || typeof query !== 'string') { res.status(400).json({ error: 'Missing query' }); return; }
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supabase
      .from('support_tickets')
      .insert([{ user_id: userId || null, query, status: 'open' }])
      .select()
      .single();
    if (error) throw error;

    const hook = process.env.SLACK_SUPPORT_WEBHOOK_URL;
    if (hook) {
      try {
        await fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `📩 New Support Ticket\nUser: ${userId || 'anon'}\nQuery: ${query}\nTicket ID: ${data.id}` }),
        });
      } catch {}
    }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to create ticket' });
  }
};

export default handler;


