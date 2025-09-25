import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import Stripe from 'stripe';
import { createInvoiceWithItem } from '../services/stripe';

const router = express.Router();
const platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' });

async function getRoleTeam(userId: string): Promise<{ role: string; team_id: string | null }> {
  const { data } = await supabase.from('users').select('role, team_id').eq('id', userId).maybeSingle();
  return { role: String((data as any)?.role || ''), team_id: (data as any)?.team_id || null };
}

async function canViewBilling(userId: string): Promise<boolean> {
  const { role, team_id } = await getRoleTeam(userId);
  const lc = String(role || '').toLowerCase();
  if (['super_admin','superadmin'].includes(lc)) return true;
  // Block Free plan regardless of role
  try {
    const { data: sub } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier = String((sub as any)?.plan_tier || '').toLowerCase();
    if (tier === 'free' || !tier) {
      const { data: usr } = await supabase.from('users').select('plan').eq('id', userId).maybeSingle();
      const plan = String((usr as any)?.plan || 'free').toLowerCase();
      if (plan === 'free') return false;
    }
  } catch {}
  try {
    const { data: sub2 } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier2 = String((sub2 as any)?.plan_tier || '').toLowerCase();
    if (tier2 === 'team' && team_id && lc !== 'team_admin') {
      const { data } = await supabase.from('deal_permissions').select('can_view_billing').eq('user_id', userId).maybeSingle();
      return Boolean((data as any)?.can_view_billing);
    }
  } catch {}
  return true;
}

// GET /api/invoices - list invoices by team scope
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!(await canViewBilling(userId))) { res.status(403).json({ error: 'access_denied' }); return; }

    const { role, team_id } = await getRoleTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    let base = supabase.from('invoices').select('*');
    if (isSuper) {
      // no filter
    } else if (isTeamAdmin && team_id) {
      const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
      const ids = (teamUsers || []).map((u: any) => u.id);
      // Join by opportunities.owner_id via client/opportunity linkage is not needed if invoices are scoped by client/opportunity
      // For now, return all invoices for clients/opps owned by team members
      const { data: opps } = await supabase.from('opportunities').select('id').in('owner_id', ids);
      const oppIds = (opps || []).map((o: any) => o.id);
      base = base.or(`opportunity_id.in.(${oppIds.join(',')})`);
    } else {
      const { data: opps } = await supabase.from('opportunities').select('id').eq('owner_id', userId);
      const oppIds = (opps || []).map((o: any) => o.id);
      base = base.or(`opportunity_id.in.(${oppIds.join(',')})`);
    }

    const { data, error } = await base.order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/invoices/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  if (error || !data) { res.status(404).json({ error: 'not_found' }); return; }
  res.json(data);
});

// PATCH /api/invoices/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const allowed = ['status','paid_at','due_at','notes'];
  const update: any = {};
  for (const f of allowed) if (req.body?.[f] !== undefined) update[f] = req.body[f];
  const { data, error } = await supabase.from('invoices').update(update).eq('id', id).select('*').maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || {});
});

// DELETE /api/invoices/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!(await canViewBilling(userId))) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const { data: row, error: fetchErr } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
    if (fetchErr) { res.status(500).json({ error: fetchErr.message }); return; }
    if (!row) { res.status(404).json({ error: 'not_found' }); return; }

    // Try to void Stripe invoice if present
    try {
      if (row.stripe_invoice_id) {
        const { data: integ } = await supabase
          .from('user_integrations')
          .select('stripe_mode,stripe_secret_key,stripe_connected_account_id')
          .eq('user_id', userId)
          .maybeSingle();
        const mode = (integ as any)?.stripe_mode || 'connect';
        const useUserKeys = mode === 'keys' && (integ as any)?.stripe_secret_key;
        const connectedId = (integ as any)?.stripe_connected_account_id || null;
        const s = useUserKeys ? new Stripe((integ as any).stripe_secret_key, { apiVersion: '2022-11-15' }) : platformStripe;
        await s.invoices.voidInvoice(row.stripe_invoice_id, connectedId && !useUserKeys ? { stripeAccount: connectedId } as any : undefined);
      }
    } catch (e) {
      // ignore void errors; proceed to delete locally
    }

    const { error: delErr } = await supabase.from('invoices').delete().eq('id', id);
    if (delErr) { res.status(500).json({ error: delErr.message }); return; }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// POST /api/invoices/create
router.post('/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!(await canViewBilling(userId))) { res.status(403).json({ error: 'access_denied' }); return; }

    const { opportunity_id, billing_type, fields, recipient_email, notes } = req.body || {};
    if (!opportunity_id || !billing_type) { res.status(400).json({ error: 'Missing required fields' }); return; }

    // Fetch opportunity + client
    const { data: opp } = await supabase.from('opportunities').select('id,title,value,client_id').eq('id', opportunity_id).maybeSingle();
    if (!opp) { res.status(404).json({ error: 'opportunity_not_found' }); return; }
    const { data: client } = await supabase.from('clients').select('id,name').eq('id', opp.client_id).maybeSingle();

    // Calculate amount based on billing_type (sanitize inputs like "$5,000" or "20%")
    const parseNum = (v: any): number => {
      const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    let amount = Number(opp.value) || 0;
    const f = fields || {};
    switch (String(billing_type).toLowerCase()) {
      case 'contingency': {
        const salary = parseNum(f.salary);
        const pct = parseNum(f.percent || 20);
        amount = Math.round(salary * (pct / 100));
        break;
      }
      case 'retainer': {
        amount = parseNum(f.flat_fee);
        break;
      }
      case 'rpo': {
        amount = parseNum(f.monthly);
        break;
      }
      case 'staffing': {
        const hours = parseNum(f.hours);
        const rate = parseNum(f.hourly_rate);
        amount = Math.round(hours * rate);
        break;
      }
    }

    // Resolve Stripe mode and customer
    const { data: integ } = await supabase
      .from('user_integrations')
      .select('stripe_mode,stripe_secret_key,stripe_connected_account_id')
      .eq('user_id', userId)
      .maybeSingle();

    const mode = (integ as any)?.stripe_mode || 'connect';
    const useUserKeys = mode === 'keys' && (integ as any)?.stripe_secret_key;
    const connectedId = (integ as any)?.stripe_connected_account_id || null;

    const stripe = useUserKeys
      ? new Stripe((integ as any).stripe_secret_key, { apiVersion: '2022-11-15' })
      : platformStripe;

    // Ensure or reuse Stripe customer id for this client
    let stripeCustomerId = (client as any)?.stripe_customer_id || null;
    const createOrUpdateCustomer = async () => {
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          name: client?.name || undefined,
          email: recipient_email || undefined,
        }, connectedId && !useUserKeys ? { stripeAccount: connectedId } as any : undefined);
        stripeCustomerId = customer.id;
        await supabase.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', client?.id || '');
        return customer;
      } else if (recipient_email) {
        // Ensure email is present on existing customer for sendInvoice
        await stripe.customers.update(stripeCustomerId, { email: recipient_email }, connectedId && !useUserKeys ? { stripeAccount: connectedId } as any : undefined);
      }
      return null as any;
    };
    await createOrUpdateCustomer();

    const hosted = await createInvoiceWithItem({
      userId,
      customerEmail: recipient_email,
      description: `${client?.name || 'Client'} • ${opp.title}`,
      amountCents: Math.max(0, Math.round(amount * 100)),
      meta: { opportunity_id: String(opportunity_id), billing_type: String(billing_type || '') },
      account: connectedId && !useUserKeys ? connectedId : undefined,
    });

    // Store invoice row
    const { data, error } = await supabase.from('invoices').insert({
      opportunity_id,
      client_id: opp.client_id,
      billing_type,
      amount,
      status: 'sent',
      sent_at: new Date().toISOString(),
      due_at: new Date(Date.now() + 14*24*60*60*1000).toISOString(),
      recipient_email: recipient_email || null,
      notes: notes || null,
      stripe_invoice_id: (hosted as any)?.invoice || null
    }).select('*').single();
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json({ invoice: data, hosted_invoice_url: (hosted as any)?.hosted_invoice_url || null });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Invoice creation failed' });
  }
});

export default router;


