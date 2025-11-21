import { Response } from 'express';
import { ApiRequest } from '../../types/api';
import { supabase as supabaseDb } from '../../lib/supabase';
import { CreditService } from '../../services/creditService';

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

    // Idempotency guard: if a debit for this action occurred very recently, no-op
    try {
      const oneMinuteAgoIso = new Date(Date.now() - 60_000).toISOString();
      const { data: recent } = await supabaseDb
        .from('credit_usage_log')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('type', 'debit')
        .eq('usage_type', 'api_usage')
        .eq('description', 'LinkedIn connection request')
        .gte('created_at', oneMinuteAgoIso)
        .limit(1);
      if (Array.isArray(recent) && recent.length > 0) {
        // Already charged very recently — return success without charging again
        return res.json({ ok: true, deduped: true });
      }
    } catch (e) {
      // Non-fatal; proceed without dedupe if check fails
      console.warn('[record-connect] dedupe check failed:', e);
    }

    const creditCost = 5;

    // Use centralized credit service so free users and team-sharing are handled
    const hasCredits = await CreditService.hasSufficientCredits(userId, creditCost);
    if (!hasCredits) {
      // Report available balance for better UX
      try {
        const bal = await CreditService.getCreditBalance(userId);
        return res.status(402).json({ error: 'Insufficient credits', required: creditCost, available: bal });
      } catch {
        return res.status(402).json({ error: 'Insufficient credits', required: creditCost });
      }
    }

    try {
      await CreditService.deductCredits(userId, creditCost, 'api_usage', 'LinkedIn connection request');
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to deduct credits' });
    }

    // Increment daily invite stats (stored procedure available in migrations)
    try {
      await supabaseDb.rpc('update_daily_invite_stats', { p_user_id: userId, p_increment_count: 1, p_was_successful: true });
    } catch (e) {
      // Non-fatal
      console.warn('[record-connect] update_daily_invite_stats failed:', e);
    }

    // Fetch today count and remaining after debit
    let todaysCount = 0;
    let remainingAfter = 0;
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

    try { remainingAfter = await CreditService.getCreditBalance(userId); } catch {}

    return res.json({ ok: true, credits_remaining: remainingAfter, today_count: todaysCount });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to record connect' });
  }
}


