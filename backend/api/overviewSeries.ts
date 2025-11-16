import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

// GET /api/analytics/overview-series?campaign_id=all|<uuid>&range=30d|90d|6m
export default async function overviewSeries(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    const rawCampaignId = String(req.query.campaign_id ?? 'all');
    const range = String(req.query.range ?? '30d');
    const campaignId = rawCampaignId === 'all' ? null : rawCampaignId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let daysBack = 30;
    if (range === '90d') daysBack = 90;
    if (range === '6m') daysBack = 182; // approx 6 months
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    since.setHours(0, 0, 0, 0);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      res.status(500).json({ error: 'Missing Supabase service configuration' });
      return;
    }
    const supabaseAdmin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    let query = supabaseAdmin
      .from('email_events')
      .select('event_timestamp, event_type, campaign_id')
      .gte('event_timestamp', since.toISOString())
      .in('event_type', ['sent', 'open', 'reply'] as any)
      .eq('user_id', userId as any);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    let events: any[] = [];
    const { data: firstData, error } = await query;
    events = firstData || [];
    // If campaign_id column doesn't exist or other column issue, retry without selecting/filtering campaign_id
    if (error && (error as any).code === '42703') {
      const { data: retryEvents, error: retryError } = await supabaseAdmin
        .from('email_events')
        .select('event_timestamp, event_type')
        .gte('event_timestamp', since.toISOString())
        .in('event_type', ['sent', 'open', 'reply'] as any)
        .eq('user_id', userId as any);
      if (retryError) {
        res.status(500).json({ error: retryError.message });
        return;
      }
      events = retryEvents || [];
    } else if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!events || events.length === 0) {
      res.json([]);
      return;
    }

    // Aggregate to ISO week buckets (Mon-Sun)
    const buckets: Record<string, { sent: number; open: number; reply: number }> = {};
    for (const ev of events) {
      const ts = ev && (ev as any).event_timestamp ? new Date((ev as any).event_timestamp) : null;
      const type = (ev as any).event_type;
      if (!ts || !type) continue;
      const wk = new Date(ts);
      const day = wk.getUTCDay();
      const diff = wk.getUTCDate() - (day || 7) + 1; // move to Monday
      wk.setUTCDate(diff);
      wk.setUTCHours(0, 0, 0, 0);
      const key = wk.toISOString().slice(0, 10);
      if (!buckets[key]) buckets[key] = { sent: 0, open: 0, reply: 0 };
      if (type === 'sent') buckets[key].sent += 1;
      else if (type === 'open') buckets[key].open += 1;
      else if (type === 'reply') buckets[key].reply += 1;
    }

    const series: Array<{ period: string; openRate: number; replyRate: number }> = [];
    const current = new Date(since);
    // snap to Monday
    {
      const d = current.getUTCDay();
      current.setUTCDate(current.getUTCDate() - (d || 7) + 1);
      current.setUTCHours(0, 0, 0, 0);
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    while (current <= today) {
      const key = current.toISOString().slice(0, 10);
      const b = buckets[key] || { sent: 0, open: 0, reply: 0 };
      const sent = b.sent || 0;
      const openRate = sent > 0 ? (b.open / sent) * 100 : 0;
      const replyRate = sent > 0 ? (b.reply / sent) * 100 : 0;
      const weekEnd = new Date(current);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const label = `${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      series.push({
        period: label,
        openRate: Math.round(openRate * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
      });
      current.setUTCDate(current.getUTCDate() + 7);
    }

    res.json(series);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'overview-series failed' });
  }
}


