import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';

function uid(req: Request){ return (req as any).user?.id || (req.headers['x-user-id'] as string); }

const StrategySchema = z.object({
  tone: z.enum(['professional','conversational','warm','direct','enterprise','highenergy']),
  priority: z.enum(['book','warm','qualify','objection','soft']),
  instructions: z.string().max(2000).optional().default('')
});

const router = Router();

// PATCH /api/sales-agent/strategy
router.patch('/api/sales-agent/strategy', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req);
    if (!user_id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const body = StrategySchema.parse(req.body || {});

    // Upsert into dedicated settings table
    const { error: upErr } = await supabase
      .from('sales_agent_settings')
      .upsert({ user_id, response_strategy: body, updated_at: new Date().toISOString() });
    if (upErr) { res.status(500).json({ error: upErr.message }); return; }

    // Also mirror into sales_agent_policies.policy to keep legacy readers consistent
    try {
      const { data: existing } = await supabase
        .from('sales_agent_policies')
        .select('policy')
        .eq('user_id', user_id)
        .maybeSingle();
      const merged = {
        ...(existing?.policy || {}),
        reply_style: { ...(existing?.policy?.reply_style || {}), tone: body.tone },
        response_strategy: body,
        reply_strategy: body
      };
      await supabase
        .from('sales_agent_policies')
        .upsert({ user_id, policy: merged, updated_at: new Date().toISOString() });
    } catch {}

    res.json({ ok: true, response_strategy: body });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'bad_request' });
  }
});

export default router;


