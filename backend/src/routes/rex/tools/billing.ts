import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../../middleware/authMiddleware';

export const rexBilling = Router();
rexBilling.use(requireAuth as any);

const PurchaseSchema = z.object({ packageId: z.string() });
rexBilling.post('/credits/purchase', async (req, res) => {
  const parsed = PurchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/credits/purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data) });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'credits_purchase_failed' }); }
});

rexBilling.post('/checkout', async (req, res) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/billing/checkout`, { method: 'POST', headers: { Authorization: req.headers.authorization as string } });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'checkout_failed' }); }
});

rexBilling.post('/cancel', async (req, res) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/billing/cancel`, { method: 'POST', headers: { Authorization: req.headers.authorization as string } });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'cancel_failed' }); }
});

const InvoiceSchema = z.object({ client_id: z.string().uuid(), amount: z.number().positive(), currency: z.string().optional(), description: z.string().optional(), opportunity_id: z.string().optional(), billing_type: z.string().optional(), recipient_email: z.string().email().optional(), notes: z.string().optional() });
rexBilling.post('/invoice', async (req, res) => {
  const parsed = InvoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  try {
    const { default: fetch } = await import('node-fetch');
    const base = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
    // Prefer the invoices/create route if opportunity/billing_type provided; otherwise simple create
    if (parsed.data.opportunity_id && parsed.data.billing_type) {
      const r = await fetch(`${base}/api/invoices/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data) });
      const j = await r.json();
      return res.status(r.status).json(j);
    }
    const r = await fetch(`${base}/api/invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization as string }, body: JSON.stringify(parsed.data) });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e: any) { return res.status(500).json({ error: e?.message || 'invoice_failed' }); }
});

export default rexBilling;

