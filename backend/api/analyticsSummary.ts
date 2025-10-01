import express from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import requireAuthUnified from '../middleware/requireAuthUnified';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const useUnified = String(process.env.ENABLE_SESSION_COOKIE_AUTH || 'false').toLowerCase() === 'true';
const requireAuthFlag = (useUnified ? (requireAuthUnified as any) : (requireAuth as any));

router.get('/analytics/summary', requireAuthFlag, async (req, res) => {
  try {
    const { user_id, campaign_id } = req.query as { user_id?: string; campaign_id?: string };
    if (!user_id) {
      res.status(400).json({ error: 'user_id required' });
      return;
    }

    const filters: any = { user_id };
    const replyFilters: any = { user_id };
    if (campaign_id) {
      filters.campaign_id = campaign_id;
      replyFilters.campaign_id = campaign_id;
    }

    const { data: events, error } = await supabase
      .from('email_events')
      .select('message_id, event_type')
      .match(filters);
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
    const { data: repliesData, error: rerr } = await supabase
      .from('email_replies')
      .select('message_id')
      .match(replyFilters);
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


