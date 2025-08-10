import { supabaseAdmin } from '../services/supabase';

// Flip DIY pending commissions to locked after N days (default 14)
export async function lockMatureCommissions() {
  const days = Number(process.env.DIY_LOCK_DAYS || 14);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Find pending DIY_ONE_TIME commissions older than cutoff
  const { data: pending, error } = await supabaseAdmin
    .from('commissions')
    .select('id')
    .eq('type', 'DIY_ONE_TIME')
    .eq('status', 'pending')
    .lte('created_at', cutoff);
  if (error) throw new Error(error.message);

  const ids = (pending || []).map(r => r.id);
  if (!ids.length) return { locked: 0 };

  const { error: updErr } = await supabaseAdmin
    .from('commissions')
    .update({ status: 'locked', locked_at: new Date().toISOString() })
    .in('id', ids);
  if (updErr) throw new Error(updErr.message);

  return { locked: ids.length };
}


