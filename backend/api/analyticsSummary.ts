import express from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import requireAuthUnified from '../middleware/requireAuthUnified';
import { createClient } from '@supabase/supabase-js';
import { resolveAnalyticsScope } from '../lib/analyticsScope';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const useUnified = String(process.env.ENABLE_SESSION_COOKIE_AUTH || 'false').toLowerCase() === 'true';
const requireAuthFlag = (useUnified ? (requireAuthUnified as any) : (requireAuth as any));

router.get('/analytics/summary', requireAuthFlag, async (req, res) => {
  try {
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

    const targetUserIds = scope.targetUserIds && scope.targetUserIds.length ? scope.targetUserIds : [viewerId];
    const { campaign_id } = req.query as { campaign_id?: string };

    const applyUserFilter = <T>(query: T & { eq: Function; in: Function }) => {
      if (!targetUserIds.length) {
        return query.in('user_id', ['00000000-0000-0000-0000-000000000000']);
      }
      if (targetUserIds.length === 1) {
        return query.eq('user_id', targetUserIds[0]);
      }
      return query.in('user_id', targetUserIds);
    };

    let eventsQuery = applyUserFilter(
      supabase
        .from('email_events')
        .select('message_id, event_type')
    );
    if (campaign_id) eventsQuery = eventsQuery.eq('campaign_id', campaign_id);

    const { data: events, error } = await eventsQuery;
    if (error) throw error;

    const delivered = new Set<string>();
    const opens = new Set<string>();
    const replies = new Set<string>();

    for (const ev of events || []) {
      if (ev.event_type === 'delivered') delivered.add(ev.message_id);
      if (ev.event_type === 'open') opens.add(ev.message_id);
      if (ev.event_type === 'reply') replies.add(ev.message_id);
    }

    // Also check email_replies table for additional reply data
    let repliesQuery = applyUserFilter(
      supabase.from('email_replies').select('message_id')
    );
    if (campaign_id) repliesQuery = repliesQuery.eq('campaign_id', campaign_id);
    const { data: repliesData, error: rerr } = await repliesQuery;
    if (rerr) throw rerr;

    // Add replies from email_replies table
    for (const r of repliesData || []) {
      if (r.message_id) replies.add(r.message_id);
    }

    const deliveredCount = delivered.size;
    const uniqueOpens = [...opens].filter(mid => delivered.has(mid)).length;
    const repliedCount = replies.size;

    const open_rate = deliveredCount ? uniqueOpens / deliveredCount : 0;
    const reply_rate = deliveredCount ? repliedCount / deliveredCount : 0;

    res.json({
      delivered: deliveredCount,
      unique_opens: uniqueOpens,
      replies: repliedCount,
      open_rate,
      reply_rate
    });
  } catch (err) {
    console.error('[analytics/summary] error:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

export default router;


