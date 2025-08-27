import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { salesSendQueue, salesSweepQueue } from '../../workers/queues';

function uid(req: Request){ return (req as any).user?.id || req.headers['x-user-id']; }

const router = Router();

router.post('/api/sales/manual-handoff', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const body = z.object({ thread_id: z.string().uuid() }).parse(req.body);
    const { error } = await supabase.from('sales_threads').update({ status:'awaiting_prospect' }).eq('id', body.thread_id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) { res.status(400).json({ error: 'validation_error', details: e.errors }); return; }
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

router.post('/api/sales/propose-reply', async (req: Request, res: Response) => {
  try {
    const body = z.object({ thread_id: z.string().uuid(), n: z.number().int().min(1).max(3).default(3) }).parse(req.body);
    await salesSendQueue.add('propose-drafts', body, { delay: 500 });
    res.json({ ok: true, queued: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) { res.status(400).json({ error: 'validation_error', details: e.errors }); return; }
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

router.post('/api/sales/send', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      thread_id: z.string().uuid(),
      subject: z.string().optional(),
      body: z.string(),
      assets: z.any().optional()
    }).parse(req.body);
    await salesSendQueue.add('send-approved', body, { delay: 500 });
    res.json({ ok: true, queued: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) { res.status(400).json({ error: 'validation_error', details: e.errors }); return; }
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

router.post('/api/sales/schedule', async (req: Request, res: Response) => {
  try {
    const body = z.object({ thread_id: z.string().uuid(), event_type: z.string().optional(), window_days: z.number().int().min(1).max(30).optional() }).parse(req.body);
    await salesSendQueue.add('offer-scheduling', body, { delay: 500 });
    res.json({ ok: true, queued: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) { res.status(400).json({ error: 'validation_error', details: e.errors }); return; }
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

router.post('/api/sales/proposal', async (req: Request, res: Response) => {
  try {
    const body = z.object({ thread_id: z.string().uuid(), sku: z.string(), terms: z.any().optional() }).parse(req.body);
    await salesSendQueue.add('send-proposal', body, { delay: 500 });
    res.json({ ok: true, queued: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) { res.status(400).json({ error: 'validation_error', details: e.errors }); return; }
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

router.post('/api/sales/sweep', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const body = z.object({ lookback_hours: z.number().int().min(1).max(72).default(24) }).parse(req.body ?? {});
    await salesSweepQueue.add('run', { userId: user_id, lookback_hours: body.lookback_hours }, { delay: 500 });
    res.json({ ok: true, queued: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) { res.status(400).json({ error: 'validation_error', details: e.errors }); return; }
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


