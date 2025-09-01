import { Router } from 'express';
import { supabaseAdmin } from '../services/supabase';

const r = Router();

// List affiliates with metrics (earnings, tier, recent deal)
r.get('/', async (_req, res) => {
  try {
    const { data: affs, error: affErr } = await supabaseAdmin
      .from('affiliates')
      .select('id,user_id,referral_code,status,tier,created_at')
      .order('id', { ascending: false });
    if (affErr) return res.status(400).json({ error: affErr.message });
    const ids = (affs||[]).map(a=>a.id);
    // Earnings (lifetime)
    const earnings: Record<string, number> = {};
    for (const id of ids) {
      const { data, error } = await supabaseAdmin.rpc('sum_commissions_cents', { p_affiliate_id: id, p_status: 'paid' });
      earnings[id] = error ? 0 : (data?.sum ?? 0);
    }
    // Recent deal (last referral deal size)
    const recent: Record<string, number> = {};
    for (const id of ids) {
      const { data, error } = await supabaseAdmin
        .from('referrals')
        .select('deal_cents')
        .eq('affiliate_id', id)
        .order('first_attributed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      recent[id] = error ? 0 : (data?.deal_cents ?? 0);
    }
    res.json((affs||[]).map(a=>({ ...a, earnings_cents: earnings[a.id]||0, recent_deal_cents: recent[a.id]||0 })));
  } catch (e:any) { res.status(500).json({ error: e.message||'failed' }); }
});

// Create affiliate (by admin) without creating/deleting user account
r.post('/', async (req, res) => {
  try {
    const { user_id, referral_code, status, tier } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .upsert({ user_id, referral_code: referral_code || 'hp_'+user_id.slice(0,8), status: status || 'active', tier: tier || null }, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (e:any) { res.status(500).json({ error: e.message||'failed' }); }
});

// Update affiliate
r.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const patch: any = {};
    ['status','tier','referral_code'].forEach(k=>{ if (req.body?.[k] !== undefined) patch[k] = req.body[k]; });
    const { data, error } = await supabaseAdmin.from('affiliates').update(patch).eq('id', id).select('*').single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (e:any) { res.status(500).json({ error: e.message||'failed' }); }
});

// Delete affiliate (do NOT delete user account)
r.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('affiliates').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (e:any) { res.status(500).json({ error: e.message||'failed' }); }
});

// Reassign affiliate link (change referral_code)
r.post('/:id/reassign', async (req, res) => {
  try {
    const { id } = req.params;
    const { referral_code } = req.body || {};
    const code = referral_code || ('hp_'+Math.random().toString(36).slice(2,8));
    const { data, error } = await supabaseAdmin.from('affiliates').update({ referral_code: code }).eq('id', id).select('*').single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (e:any) { res.status(500).json({ error: e.message||'failed' }); }
});

export default r;


