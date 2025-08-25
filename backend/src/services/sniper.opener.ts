import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';

export async function processSniperOpenersBatch(targetId: string): Promise<{ sent: number; remaining_today: number }> {
  // Respect global enable toggle
  if (String(process.env.SNIPER_OPENER_ENABLE || 'false').toLowerCase() !== 'true') {
    return { sent: 0, remaining_today: 0 };
  }

  const dailyCap = Number(process.env.SNIPER_OPENER_DAILY_CAP || 20);

  // Count already sent today
  const { count } = await supabase
    .from('sniper_opener_sends')
    .select('id', { count: 'exact', head: true })
    .eq('target_id', targetId)
    .gte('sent_at', dayjs().startOf('day').toISOString());

  const remaining = Math.max(0, dailyCap - (count || 0));
  if (remaining <= 0) return { sent: 0, remaining_today: 0 };

  // For now, we only update counters; actual email send logic will be implemented in the next steps
  // Insert a placeholder log row to avoid unused worker
  await supabase.from('sniper_opener_sends').insert({ target_id: targetId, email: 'placeholder@pending.com', lead_id: null as any });

  return { sent: 1, remaining_today: remaining - 1 };
}


