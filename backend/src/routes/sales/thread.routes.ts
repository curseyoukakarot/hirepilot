import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabase';

function uid(req: Request){ return (req as any).user?.id || (req.headers['x-user-id'] as string); }

const router = Router();

// GET /api/sales/thread/:id/timeline
router.get('/api/sales/thread/:id/timeline', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error:'unauthorized' }); return; }
    const threadId = (req.params as any).id as string;

    const { data: thread, error: te } = await supabase.from('sales_threads')
      .select('id, user_id, channel, status, meta, last_inbound_at, last_outbound_at, lead_id')
      .eq('id', threadId).maybeSingle();
    if (te) { res.status(500).json({ error: te.message }); return; }
    if (!thread) { res.status(404).json({ error: 'thread_not_found' }); return; }
    if ((thread as any).user_id !== user_id) { res.status(403).json({ error: 'forbidden' }); return; }

    const { data: messages, error: me } = await supabase.from('sales_messages')
      .select('id, direction, sender, recipient, subject, body, assets, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (me) { res.status(500).json({ error: me.message }); return; }

    const { data: actions } = await supabase.from('sales_actions')
      .select('id, action, payload, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    let lead: any = null;
    if ((thread as any).lead_id) {
      const { data: l } = await supabase.from('sourcing_leads')
        .select('id, first_name, last_name, email, company, title, linkedin_url')
        .eq('id', (thread as any).lead_id).maybeSingle();
      lead = l || null;
    }

    res.json({ thread, lead, messages: messages || [], actions: actions || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


