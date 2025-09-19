import { Response } from 'express';
import { ApiRequest } from '../../types/api';
import { supabase as supabaseDb } from '../../lib/supabase';

/**
 * POST /api/linkedin/record-connect
 * Deducts 5 credits and increments today's LinkedIn invite stats.
 */
export default async function recordConnect(req: ApiRequest, res: Response) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const creditCost = 5;

    // Read current credits
    const { data: userCredits, error: readErr } = await supabaseDb
      .from('user_credits')
      .select('used_credits, remaining_credits')
      .eq('user_id', userId)
      .single();
    if (readErr) return res.status(500).json({ error: readErr.message });

    const remaining = Number(userCredits?.remaining_credits || 0);
    if (remaining < creditCost) {
      return res.status(402).json({ error: 'Insufficient credits', required: creditCost, available: remaining });
    }

    // Deduct credits
    const { error: deductErr } = await supabaseDb
      .from('user_credits')
      .update({
        used_credits: Number(userCredits?.used_credits || 0) + creditCost,
        remaining_credits: remaining - creditCost,
        last_updated: new Date().toISOString()
      })
      .eq('user_id', userId);
    if (deductErr) return res.status(500).json({ error: deductErr.message || 'Failed to deduct credits' });

    // Log credit usage so it appears in Recent Usage
    try {
      await supabaseDb
        .from('credit_usage_log')
        .insert({
          user_id: userId,
          amount: -creditCost,
          type: 'debit',
          usage_type: 'api_usage',
          description: 'LinkedIn connection request'
        });
    } catch (logErr) {
      // Non-fatal
      console.warn('[record-connect] credit usage log failed:', logErr);
    }

    // Increment daily invite stats (stored procedure available in migrations)
    try {
      await supabaseDb.rpc('update_daily_invite_stats', { p_user_id: userId, p_increment_count: 1, p_was_successful: true });
    } catch (e) {
      // Non-fatal
      console.warn('[record-connect] update_daily_invite_stats failed:', e);
    }

    // Fetch today count
    let todaysCount = 0;
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const { data } = await supabaseDb
        .from('linkedin_invite_stats')
        .select('count')
        .eq('user_id', userId)
        .eq('stat_date', today.toISOString().slice(0,10))
        .maybeSingle();
      todaysCount = Number((data as any)?.count || 0);
    } catch {}

    return res.json({ ok: true, credits_remaining: remaining - creditCost, today_count: todaysCount });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to record connect' });
  }
}


