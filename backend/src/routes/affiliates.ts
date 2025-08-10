import { Router } from 'express';
import { supabaseAdmin } from '../services/supabase';
import { ensureConnectAccount, connectOnboardingLink } from '../services/stripe';

const r = Router();

// Generate or fetch affiliate profile
r.post('/register', async (req, res) => {
  const userId = (req as any).user.id;
  const code = 'hp_' + userId.slice(0, 8);
  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .upsert({ user_id: userId, referral_code: code }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

r.get('/link', async (req, res) => {
  const userId = (req as any).user.id;
  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .select('referral_code')
    .eq('user_id', userId)
    .single();
  if (error) return res.status(404).json({ error: 'No affiliate' });
  const url = `${process.env.APP_BASE_URL}/?ref=${data.referral_code}`;
  res.json({ code: data.referral_code, url });
});

r.post('/connect/onboarding', async (req, res) => {
  const userId = (req as any).user.id;
  const { data, error } = await supabaseAdmin.from('affiliates').select('*').eq('user_id', userId).single();
  if (error || !data) return res.status(404).json({ error: 'No affiliate' });

  const acctId = await ensureConnectAccount(userId, data.stripe_connect_id ?? undefined);
  if (!data.stripe_connect_id) {
    await supabaseAdmin.from('affiliates').update({ stripe_connect_id: acctId }).eq('id', data.id);
  }
  const link = await connectOnboardingLink(acctId);
  res.json({ url: link.url });
});

// Overview stats
r.get('/overview', async (req, res) => {
  const userId = (req as any).user.id;
  const { data: aff } = await supabaseAdmin.from('affiliates').select('id,tier').eq('user_id', userId).single();
  if (!aff) return res.status(404).json({ error: 'No affiliate' });

  const [{ data: lifetime }, { data: month }, { data: next }] = await Promise.all([
    supabaseAdmin.rpc('sum_commissions_cents', { p_affiliate_id: aff.id, p_status: 'paid' }),
    supabaseAdmin.rpc('sum_commissions_cents_month', { p_affiliate_id: aff.id }),
    supabaseAdmin.rpc('next_payout_cents', { p_affiliate_id: aff.id }),
  ]);
  res.json({
    tier: aff.tier,
    lifetime_cents: lifetime?.sum ?? 0,
    this_month_cents: month?.sum ?? 0,
    next_payout_cents: next?.sum ?? 0,
  });
});

// Lists
r.get('/referrals', async (req, res) => {
  const userId = (req as any).user.id;
  const { data: aff } = await supabaseAdmin.from('affiliates').select('id').eq('user_id', userId).single();
  if (!aff) return res.status(404).json({ error: 'No affiliate' });
  const { data, error } = await supabaseAdmin.from('referrals').select('*').eq('affiliate_id', aff.id).order('first_attributed_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

r.get('/commissions', async (req, res) => {
  const userId = (req as any).user.id;
  const { data: aff } = await supabaseAdmin.from('affiliates').select('id').eq('user_id', userId).single();
  const { data, error } = await supabaseAdmin.from('commissions').select('*').eq('affiliate_id', aff!.id).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

r.get('/payouts', async (req, res) => {
  const userId = (req as any).user.id;
  const { data: aff } = await supabaseAdmin.from('affiliates').select('id').eq('user_id', userId).single();
  const { data, error } = await supabaseAdmin.from('payouts').select('*').eq('affiliate_id', aff!.id).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default r;


