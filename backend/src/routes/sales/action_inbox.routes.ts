import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { salesSendQueue } from '../../workers/queues';

function uid(req: Request){ return (req as any).user?.id || (req.headers['x-user-id'] as string); }

async function getLatestInbound(threadId: string){
  const { data } = await supabase.from('sales_messages')
    .select('id, subject, body, sender, recipient, created_at')
    .eq('thread_id', threadId)
    .eq('direction','inbound')
    .order('created_at',{ ascending:false })
    .limit(1);
  return data?.[0] || null;
}
async function getDrafts(threadId: string){
  const { data } = await supabase.from('sales_messages')
    .select('id, subject, body, assets, created_at')
    .eq('thread_id', threadId)
    .eq('direction','draft')
    .order('created_at',{ ascending:false })
    .limit(5);
  return data || [];
}

const router = Router();

// GET /api/sales/inbox
router.get('/api/sales/inbox', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const { data: threads, error } = await supabase.from('sales_threads')
      .select('id, status, channel, last_inbound_at, last_outbound_at, meta')
      .eq('user_id', user_id)
      .eq('status', 'awaiting_user')
      .order('last_inbound_at', { ascending:false })
      .limit(50);
    if (error) { res.status(500).json({ error: error.message }); return; }

    const enriched: any[] = [];
    for (const t of threads || []) {
      const inbound = await getLatestInbound((t as any).id);
      const drafts = await getDrafts((t as any).id);
      enriched.push({ thread: t, inbound, drafts });
    }
    res.json({ items: enriched });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/sales/inbox/send-draft
router.post('/api/sales/inbox/send-draft', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const body = z.object({ thread_id: z.string().uuid(), draft_id: z.string().uuid() }).parse(req.body);
    const { data: draft, error: de } = await supabase.from('sales_messages')
      .select('id, subject, body, assets')
      .eq('id', body.draft_id)
      .eq('thread_id', body.thread_id)
      .eq('direction','draft')
      .maybeSingle();
    if (de) { res.status(500).json({ error: de.message }); return; }
    if (!draft) { res.status(404).json({ error: 'draft_not_found' }); return; }

    await salesSendQueue.add('send-approved', {
      thread_id: body.thread_id,
      subject: (draft as any).subject || '(no subject)',
      body: (draft as any).body,
      assets: (draft as any).assets || {}
    }, { delay: 200 });
    res.json({ ok: true, queued: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/sales/inbox/edit-send
router.post('/api/sales/inbox/edit-send', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const body = z.object({ thread_id: z.string().uuid(), subject: z.string().optional(), content: z.string().min(1), assets: z.any().optional() }).parse(req.body);
    await salesSendQueue.add('send-approved', { thread_id: body.thread_id, subject: body.subject || '(no subject)', body: body.content, assets: body.assets || {} }, { delay: 200 });
    res.json({ ok: true, queued: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/sales/inbox/offer-meeting
router.post('/api/sales/inbox/offer-meeting', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const body = z.object({ thread_id: z.string().uuid(), event_type: z.string().optional() }).parse(req.body);
    await salesSendQueue.add('offer-scheduling', { thread_id: body.thread_id, event_type: body.event_type }, { delay: 200 });
    res.json({ ok: true, queued: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/sales/inbox/escalate
router.post('/api/sales/inbox/escalate', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const body = z.object({ thread_id: z.string().uuid(), note: z.string().optional() }).parse(req.body);
    await supabase.from('sales_actions').insert({ thread_id: body.thread_id, action: 'escalate', payload: { note: body.note || '' } });
    await supabase.from('sales_threads').update({ status: 'awaiting_user' }).eq('id', body.thread_id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


