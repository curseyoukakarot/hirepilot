import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { sendEmail } from '../../integrations/sendgrid';
import { getPolicyForUser, getEffectiveSenderEmail } from '../../services/sales/policy';

function uid(req: Request){ return (req as any).user?.id || (req.headers['x-user-id'] as string); }

const router = Router();

// POST /api/sales/test-email
router.post('/api/sales/test-email', async (req: Request, res: Response) => {
  try {
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error:'unauthorized' }); return; }
    const body = z.object({ to: z.string().email().optional() }).parse(req.body ?? {});

    // 1) fetch policy & sender
    const policy = await getPolicyForUser(user_id);
    const from = await getEffectiveSenderEmail(user_id, policy);
    if (!from) { res.status(400).json({ error: 'missing_sender', message: 'Configure Sales Agent sender email first.' }); return; }

    // 2) resolve recipient (use provided or user’s profile email if stored)
    let to = body.to as string | undefined;
    if (!to) {
      // Try users table first
      const { data: userRow } = await supabase.from('users').select('email').eq('id', user_id).maybeSingle();
      if (userRow?.email) {
        to = userRow.email as string;
      } else {
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', user_id).maybeSingle();
        if (!prof?.email) { res.status(400).json({ error: 'missing_to', message: 'Provide a test recipient email.' }); return; }
        to = prof.email as string;
      }
    }

    // 3) compose email using current assets
    const demo = policy?.assets?.demo_video_url;
    const pricing = policy?.assets?.pricing_url;
    const calendly = policy?.scheduling?.event_type ? `https://calendly.com/${policy.scheduling.event_type}` : null;

    const subject = 'HirePilot Sales Agent — Test Email';
    const lines = [
      `<p>This is a <b>test email</b> from your Sales Agent using sender: <code>${from}</code>.</p>`,
      demo ? `<p>Demo: <a href="${demo}">${demo}</a></p>` : '',
      pricing ? `<p>Pricing: <a href="${pricing}">${pricing}</a></p>` : '',
      calendly ? `<p>Calendly: <a href="${calendly}">${calendly}</a></p>` : '<p>(Calendly not configured)</p>',
      `<p>If this reached you, your sender + SendGrid are wired correctly.</p>`
    ].filter(Boolean).join('');

    await sendEmail({ from, to: to!, subject, html: lines });
    res.json({ ok: true, sent: { from, to } });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/sales/sim-inbound  (dev only)
router.post('/api/sales/sim-inbound', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SIM_INBOUND !== 'true') {
      res.status(403).json({ error: 'forbidden', message: 'Simulate inbound is disabled in production.' });
      return;
    }
    const user_id = uid(req); if (!user_id) { res.status(401).json({ error:'unauthorized' }); return; }

    const payload = z.object({
      thread_id: z.string().uuid().optional(),
      lead_id: z.string().uuid().optional(),
      channel: z.enum(['email','linkedin','web']).default('email'),
      from: z.string().email().default('prospect@example.com'),
      to: z.string().email().optional(),
      subject: z.string().default('Re: HirePilot'),
      body: z.string().default('Hi — interested, can you send pricing and a demo?')
    }).parse(req.body ?? {});

    let threadId = payload.thread_id as string | undefined;
    if (!threadId) {
      const { data: t, error: te } = await supabase.from('sales_threads').insert({
        user_id, lead_id: payload.lead_id ?? null, channel: payload.channel,
        external_thread_id: `sim-${Date.now()}`, status:'awaiting_user', last_inbound_at: new Date().toISOString()
      }).select().single();
      if (te) { res.status(500).json({ error: te.message }); return; }
      threadId = (t as any).id as string;
    } else {
      await supabase.from('sales_threads').update({ last_inbound_at: new Date().toISOString(), status:'awaiting_user' }).eq('id', threadId);
    }

    const { error: me } = await supabase.from('sales_messages').insert({
      thread_id: threadId, direction:'inbound',
      sender: payload.from, recipient: payload.to ?? null, subject: payload.subject, body: payload.body, assets: {}
    });
    if (me) { res.status(500).json({ error: me.message }); return; }

    const { salesInboundQueue } = await import('../../workers/queues');
    await salesInboundQueue.add('classify-and-respond', { threadId, userId: user_id }, { delay: 250 });

    res.json({ ok: true, thread_id: threadId });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


