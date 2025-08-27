import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';

const PolicySchema = z.object({
  mode: z.enum(['share','handle']).default('handle'),
  reply_style: z.object({
    tone: z.string().default('friendly-direct'),
    length: z.string().default('short'),
    format: z.string().default('bullet_then_cta'),
    objection_posture: z.string().default('clarify_then_value')
  }).default({}),
  contact_capture: z.object({
    ask_phone: z.boolean().default(false),
    ask_team_size: z.boolean().default(true),
    ask_timeline: z.boolean().default(true),
    only_if_missing: z.boolean().default(true)
  }).default({}),
  scheduling: z.object({
    provider: z.enum(['calendly']).default('calendly'),
    event_type: z.string().default('hirepilot/15min-intro'),
    time_window_days: z.number().int().min(1).max(30).default(10),
    work_hours: z.string().default('9-5'),
    timezone: z.string().default('America/Chicago'),
    fallback_link: z.string().url().optional()
  }).default({}),
  sender: z.object({
    behavior: z.enum(['single','rotate']).default('single'),
    email: z.string().email().optional()
  }).default({}),
  offers: z.array(z.object({
    sku: z.string(),
    name: z.string(),
    price: z.string().optional(),
    url: z.string().url().optional()
  })).default([]),
  assets: z.object({
    demo_video_url: z.string().url().optional(),
    deck_url: z.string().url().optional(),
    pricing_url: z.string().url().optional(),
    one_pager_url: z.string().url().optional()
  }).default({}),
  limits: z.object({
    per_thread_daily: z.number().int().min(1).max(3).default(1),
    quiet_hours_local: z.string().default('20:00-07:00'),
    max_followups: z.number().int().min(1).max(8).default(4)
  }).default({})
});

function uid(req: Request){
  return (req as any).user?.id || req.headers['x-user-id'];
}

const router = Router();

router.get('/api/sales/policy', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req);
    if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const { data, error } = await supabase.from('sales_agent_policies').select('policy').eq('user_id', user_id as string).maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data?.policy ?? {});
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

router.post('/api/sales/policy', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req);
    if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const body = PolicySchema.parse(req.body ?? {});
    const { error } = await supabase.from('sales_agent_policies').upsert({ user_id, policy: body, updated_at: new Date().toISOString() });
    if (error) { res.status(500).json({ error: error.message }); return; }
    // Soft guidance: let frontend know if important fields are missing
    const needs: string[] = [];
    if (!body?.sender?.email && body?.sender?.behavior === 'single') needs.push('sender_email');
    if (!body?.assets?.demo_video_url) needs.push('demo_video_url');
    if (!body?.assets?.pricing_url) needs.push('pricing_url');
    res.json({ ok: true, policy: body, needs });
  } catch (e: any) {
    if (e instanceof z.ZodError) { res.status(400).json({ error: 'validation_error', details: e.errors }); return; }
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


