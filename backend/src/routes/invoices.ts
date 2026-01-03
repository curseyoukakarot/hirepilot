import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import Stripe from 'stripe';
import { createZapEvent, EVENT_TYPES } from '../lib/events';
import { createInvoiceWithItem } from '../services/stripe';
import { getDealsSharingContext } from '../lib/teamDealsScope';

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
  // Block Free plan explicitly (do not gate on missing/unknown)
  try {
    const { data: sub } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier = String((sub as any)?.plan_tier || '').toLowerCase();
    if (tier === 'free') return false;
    if (!tier) {
      const { data: usr } = await supabase.from('users').select('plan').eq('id', userId).maybeSingle();
      const plan = String((usr as any)?.plan || '').toLowerCase();
      if (plan === 'free') return false;
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
    const dealsCtx = await getDealsSharingContext(userId);

    let base = supabase.from('invoices').select('*');
    if (isSuper) {
      // SECURITY: super admins should not see other users' billing by default.
      const { data: opps } = await supabase.from('opportunities').select('id').eq('owner_id', userId);
      const oppIds = (opps || []).map((o: any) => o.id);
      base = base.in('opportunity_id', oppIds.length ? oppIds : ['00000000-0000-0000-0000-000000000000']);
    } else {
      const visibleOwners = dealsCtx.visibleOwnerIds || [userId];
      const { data: opps } = await supabase.from('opportunities').select('id').in('owner_id', visibleOwners.length ? visibleOwners : [userId]);
      const oppIds = (opps || []).map((o: any) => o.id);
      base = base.in('opportunity_id', oppIds.length ? oppIds : ['00000000-0000-0000-0000-000000000000']);
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
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!(await canViewBilling(userId))) { res.status(403).json({ error: 'access_denied' }); return; }

  const { id } = req.params;
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  if (error || !data) { res.status(404).json({ error: 'not_found' }); return; }

  // SECURITY: Ensure invoice belongs to user's visible opportunities (team pool aware for read).
  if (data.opportunity_id) {
    const { data: opp } = await supabase.from('opportunities').select('owner_id').eq('id', data.opportunity_id).maybeSingle();
    const dealsCtx = await getDealsSharingContext(userId);
    const visibleOwners = dealsCtx.visibleOwnerIds || [userId];
    if (!opp || !visibleOwners.includes(String((opp as any).owner_id || ''))) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
  }

  res.json(data);
});

// PATCH /api/invoices/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!(await canViewBilling(userId))) { res.status(403).json({ error: 'access_denied' }); return; }

  const { id } = req.params;

  // SECURITY: Ensure invoice belongs to an opportunity the requester can edit (owner or team_admin same team)
  const { data: existing } = await supabase.from('invoices').select('id, opportunity_id').eq('id', id).maybeSingle();
  if (!existing) { res.status(404).json({ error: 'not_found' }); return; }
  if (existing.opportunity_id) {
    const { data: opp } = await supabase.from('opportunities').select('owner_id').eq('id', existing.opportunity_id).maybeSingle();
    if (!opp) { res.status(404).json({ error: 'not_found' }); return; }
    const dealsCtx = await getDealsSharingContext(userId);
    const roleLc = String(dealsCtx.role || '').toLowerCase();
    const isTeamAdmin = roleLc === 'team_admin';
    const ownerId = String((opp as any).owner_id || '');
    if (ownerId !== userId) {
      if (!isTeamAdmin || !dealsCtx.teamId) { res.status(403).json({ error: 'access_denied' }); return; }
      const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', ownerId).maybeSingle();
      if (!ownerRow || String((ownerRow as any).team_id || '') !== String(dealsCtx.teamId)) { res.status(403).json({ error: 'access_denied' }); return; }
    }
  }

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

    // SECURITY: Ensure invoice belongs to an opportunity the requester can delete (owner or team_admin same team)
    if (row.opportunity_id) {
      const { data: opp } = await supabase.from('opportunities').select('owner_id').eq('id', row.opportunity_id).maybeSingle();
      if (!opp) { return res.status(404).json({ error: 'not_found' }); }
      const dealsCtx = await getDealsSharingContext(userId);
      const roleLc = String(dealsCtx.role || '').toLowerCase();
      const isTeamAdmin = roleLc === 'team_admin';
      const ownerId = String((opp as any).owner_id || '');
      if (ownerId !== userId) {
        if (!isTeamAdmin || !dealsCtx.teamId) { return res.status(403).json({ error: 'access_denied' }); }
        const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', ownerId).maybeSingle();
        if (!ownerRow || String((ownerRow as any).team_id || '') !== String(dealsCtx.teamId)) {
          return res.status(403).json({ error: 'access_denied' });
        }
      }
    }

    // Try to void Stripe invoice if present
    try {
      if (row.stripe_invoice_id) {
        const { data: integ } = await supabase
          .from('user_integrations')
          .select('stripe_mode,stripe_secret_key,stripe_connected_account_id')
          .eq('user_id', userId)
          .maybeSingle();
        const mode = (integ as any)?.stripe_mode || 'connect';
        const userSecretKey = String((integ as any)?.stripe_secret_key || '').trim();
        // If a user-provided secret key exists, always prefer it to avoid falling back to a misconfigured platform key.
        const useUserKeys = !!userSecretKey;
        const connectedId = (integ as any)?.stripe_connected_account_id || null;
        const s = useUserKeys ? new Stripe(userSecretKey, { apiVersion: '2022-11-15' }) : platformStripe;
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
  const debug: any = {};
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!(await canViewBilling(userId))) { res.status(403).json({ error: 'access_denied' }); return; }

    const { opportunity_id, billing_type, fields, recipient_email, notes } = req.body || {};
    if (!opportunity_id || !billing_type) { res.status(400).json({ error: 'Missing required fields' }); return; }

    // Fetch opportunity + client
    const { data: opp } = await supabase.from('opportunities').select('id,title,value,client_id,owner_id').eq('id', opportunity_id).maybeSingle();
    if (!opp) { res.status(404).json({ error: 'opportunity_not_found' }); return; }
    // Only opportunity owner (or team_admin in same team) can create invoices for it
    const dealsCtx = await getDealsSharingContext(userId);
    const roleLc = String(dealsCtx.role || '').toLowerCase();
    const isTeamAdmin = roleLc === 'team_admin';
    const ownerId = String((opp as any).owner_id || '');
    if (ownerId !== userId) {
      if (!isTeamAdmin || !dealsCtx.teamId) { res.status(403).json({ error: 'access_denied' }); return; }
      const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', ownerId).maybeSingle();
      if (!ownerRow || String((ownerRow as any).team_id || '') !== String(dealsCtx.teamId)) { res.status(403).json({ error: 'access_denied' }); return; }
    }
    const { data: client } = await supabase.from('clients').select('id,name,stripe_customer_id').eq('id', opp.client_id).maybeSingle();

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
      case 'down_payment': {
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
    const userSecretKey = String((integ as any)?.stripe_secret_key || '').trim();
    // If a user-provided secret key exists, always prefer it to avoid falling back to a misconfigured platform key.
    // (This also makes billing work even if the UI mode toggle is still set to "connect".)
    const useUserKeys = !!userSecretKey;
    const connectedId = (integ as any)?.stripe_connected_account_id || null;

    debug.stripe_mode = mode;
    debug.has_user_secret_key = !!userSecretKey;
    debug.user_secret_last4 = userSecretKey ? userSecretKey.slice(-4) : null;
    debug.user_secret_prefix = userSecretKey ? userSecretKey.slice(0, 7) : null;
    debug.user_secret_length = userSecretKey ? userSecretKey.length : 0;
    const platformKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
    debug.platform_secret_last4 = platformKey ? platformKey.slice(-4) : null;
    debug.connected_account_present = !!connectedId;
    debug.stripe_source = useUserKeys ? 'user_keys' : (connectedId ? 'connect_platform' : 'platform_env');

    const stripe = useUserKeys
      ? new Stripe(userSecretKey, { apiVersion: '2022-11-15' })
      : platformStripe;

    // Ensure or reuse Stripe customer id for this client
    let stripeCustomerId = (client as any)?.stripe_customer_id || null;
    const createOrUpdateCustomer = async () => {
      const stripeOpts = connectedId && !useUserKeys ? ({ stripeAccount: connectedId } as any) : undefined;
      const isMissingCustomerErr = (err: any): boolean => {
        const msg = String(err?.message || '');
        const code = String(err?.code || err?.raw?.code || '');
        return /no such customer/i.test(msg) || code === 'resource_missing';
      };

      // If we have a customer id, confirm it exists in the current Stripe context.
      // (Customer IDs are scoped to the Stripe account; switching keys can invalidate stored IDs.)
      if (stripeCustomerId) {
        try {
          await stripe.customers.retrieve(stripeCustomerId, stripeOpts);
        } catch (e: any) {
          if (isMissingCustomerErr(e)) {
            stripeCustomerId = null;
          } else {
            throw e;
          }
        }
      }

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          name: client?.name || undefined,
          email: recipient_email || undefined,
        }, stripeOpts);
        stripeCustomerId = customer.id;
        await supabase.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', client?.id || '');
        return customer;
      } else if (recipient_email) {
        // Ensure email is present on existing customer for sendInvoice
        try {
          await stripe.customers.update(stripeCustomerId, { email: recipient_email }, stripeOpts);
        } catch (e: any) {
          if (isMissingCustomerErr(e)) {
            // Customer no longer exists in this Stripe context; recreate and persist.
            const customer = await stripe.customers.create({
              name: client?.name || undefined,
              email: recipient_email || undefined,
            }, stripeOpts);
            stripeCustomerId = customer.id;
            await supabase.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', client?.id || '');
            return customer;
          }
          throw e;
        }
      }
      return null as any;
    };
    await createOrUpdateCustomer();

    const hosted = await createInvoiceWithItem({
      userId,
      stripeClient: stripe,
      customerId: stripeCustomerId || undefined,
      customerEmail: recipient_email || undefined,
      customerName: client?.name || undefined,
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

    try { await createZapEvent({ event_type: EVENT_TYPES.invoice_created, user_id: userId, entity: 'invoice', entity_id: data.id, payload: { amount: data.amount, currency: 'usd' } }); } catch {}
    res.json({ invoice: data, hosted_invoice_url: (hosted as any)?.hosted_invoice_url || null });
  } catch (e: any) {
    // Stripe tends to throw auth errors when an API key is invalid; don't echo secrets back.
    const type = String(e?.type || e?.rawType || '');
    const msg = String(e?.message || 'Invoice creation failed');
    const isStripeAuth = type.toLowerCase().includes('authentication') || /invalid api key/i.test(msg);
    if (isStripeAuth) {
      res.status(500).json({
        error: 'stripe_auth_error',
        stripe: {
          source: debug.stripe_source,
          mode: debug.stripe_mode,
          has_user_secret_key: debug.has_user_secret_key,
          user_secret_last4: debug.user_secret_last4,
          user_secret_prefix: debug.user_secret_prefix,
          user_secret_length: debug.user_secret_length,
          platform_secret_last4: debug.platform_secret_last4,
          connected_account_present: debug.connected_account_present,
        },
      });
      return;
    }
    res.status(500).json({ error: msg || 'Invoice creation failed' });
  }
});

export default router;


