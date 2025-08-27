import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { salesInboundQueue } from '../../workers/queues';

const InboundSchema = z.object({
  user_id: z.string().uuid(),
  channel: z.enum(['email','linkedin','web']),
  external_thread_id: z.string().optional(),
  lead_id: z.string().uuid().optional(),
  sender: z.string().optional(),
  recipient: z.string().optional(),
  subject: z.string().optional(),
  body: z.string(),
});

const router = Router();

router.post('/api/sales/ingest-inbound', async (req: Request, res: Response) => {
  try {
    const payload = InboundSchema.parse(req.body);
    const extId = payload.external_thread_id ?? 'none';

    const { data: threadExisting, error: findErr } = await supabase
      .from('sales_threads')
      .select('id')
      .eq('user_id', payload.user_id)
      .eq('channel', payload.channel)
      .eq('external_thread_id', extId)
      .maybeSingle();
    if (findErr) { res.status(500).json({ error: findErr.message }); return; }

    let threadId = threadExisting?.id as string | undefined;
    if (!threadId) {
      const { data: t, error: te } = await supabase.from('sales_threads').insert({
        user_id: payload.user_id,
        lead_id: payload.lead_id ?? null,
        channel: payload.channel,
        external_thread_id: extId,
        status: 'awaiting_user',
        last_inbound_at: new Date().toISOString()
      }).select().single();
      if (te) { res.status(500).json({ error: te.message }); return; }
      threadId = t.id;
    } else {
      await supabase.from('sales_threads').update({ last_inbound_at: new Date().toISOString(), status: 'awaiting_user' }).eq('id', threadId);
    }

    const { error: me } = await supabase.from('sales_messages').insert({
      thread_id: threadId, direction: 'inbound',
      sender: payload.sender ?? null, recipient: payload.recipient ?? null,
      subject: payload.subject ?? null, body: payload.body, assets: {}
    });
    if (me) { res.status(500).json({ error: me.message }); return; }

    await salesInboundQueue.add('classify-and-respond', { threadId, userId: payload.user_id }, { delay: 1000 });
    res.json({ ok: true, thread_id: threadId, queued: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) { res.status(400).json({ error: 'validation_error', details: e.errors }); return; }
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


