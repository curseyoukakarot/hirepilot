import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { resolveAnalyticsScope } from '../lib/analyticsScope';

// GET /api/analytics/overview-series?campaign_id=all|<uuid>&range=30d|90d|6m
export default async function overviewSeries(req: Request, res: Response) {
  try {
    const rawCampaignId = String(req.query.campaign_id ?? 'all');
    const range = String(req.query.range ?? '30d');
    const campaignId = rawCampaignId === 'all' ? null : rawCampaignId;
    const viewerId = (req as any)?.user?.id as string | undefined;

    if (!viewerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const scope = await resolveAnalyticsScope(viewerId);
    if (!scope.allowed) {
      const code = 'code' in scope ? scope.code : 'analytics_denied';
      const status = code === 'analytics_sharing_disabled' ? 403 : 401;
      res.status(status).json({ error: code });
      return;
    }

    let daysBack = 30;
    if (range === '90d') daysBack = 90;
    if (range === '6m') daysBack = 182; // approx 6 months
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    since.setHours(0, 0, 0, 0);

    const targetUserIds = scope.targetUserIds && scope.targetUserIds.length ? scope.targetUserIds : [viewerId];
    const applyUserFilter = <T>(query: T & { eq: Function; in: Function }) => {
      if (!targetUserIds.length) {
        return query.in('user_id', ['00000000-0000-0000-0000-000000000000']);
      }
      if (targetUserIds.length === 1) {
        return query.eq('user_id', targetUserIds[0]);
      }
      return query.in('user_id', targetUserIds);
    };

    let query = applyUserFilter(
      supabaseDb
        .from('email_events')
        .select('event_timestamp, event_type, campaign_id, message_id')
        .gte('event_timestamp', since.toISOString())
        .in('event_type', ['sent', 'open', 'reply'] as any)
    );

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: events, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!events || events.length === 0) {
      res.json([]);
      return;
    }

    // Aggregate to ISO week buckets (Mon-Sun)
    type Bucket = {
      sent: number;
      open: number;
      reply: number;
      sentMessages: Set<string>;
      openMessages: Set<string>;
    };
    const buckets: Record<string, Bucket> = {};
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
      if (!buckets[key]) {
        buckets[key] = { sent: 0, open: 0, reply: 0, sentMessages: new Set(), openMessages: new Set() };
      }
      const bucket = buckets[key];
      const msgId = (ev as any).message_id ? String((ev as any).message_id) : undefined;
      if (type === 'sent') {
        bucket.sent += 1;
        if (msgId) bucket.sentMessages.add(msgId);
      } else if (type === 'open') {
        bucket.open += 1;
        if (msgId) bucket.openMessages.add(msgId);
      } else if (type === 'reply') {
        bucket.reply += 1;
      }
    }

    const series: Array<{ period: string; openRate: number; openRateUnique: number; openRateTotal: number; replyRate: number }> = [];
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
      const b = buckets[key] || { sent: 0, open: 0, reply: 0, sentMessages: new Set(), openMessages: new Set() };
      const sentBase = b.sentMessages?.size ? b.sentMessages.size : b.sent || 0;
      const openTotal = sentBase > 0 ? (b.open / sentBase) * 100 : 0;
      const openUniqueCount = b.openMessages?.size ? b.openMessages.size : Math.min(b.open, sentBase);
      const openUnique = sentBase > 0 ? (openUniqueCount / sentBase) * 100 : 0;
      const replyRate = sentBase > 0 ? (b.reply / sentBase) * 100 : 0;
      const weekEnd = new Date(current);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const label = `${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      series.push({
        period: label,
        openRate: Math.round(openUnique * 10) / 10, // backwards compat
        openRateUnique: Math.round(openUnique * 10) / 10,
        openRateTotal: Math.round(openTotal * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
      });
      current.setUTCDate(current.getUTCDate() + 7);
    }

    res.json(series);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'overview-series failed' });
  }
}


