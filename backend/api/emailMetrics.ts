import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Get email metrics for a user
router.get('/email-metrics', async (req, res) => {
  const { user_id, time_range = '7d' } = req.query;

  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  try {
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (time_range) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Get all email events for the user in the time range
    const { data: events, error } = await supabase
      .from('email_events')
      .select('*')
      .eq('user_id', user_id)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Calculate metrics
    const metrics = {
      total_sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      dropped: 0,
      delivery_rate: 0,
      open_rate: 0,
      click_rate: 0,
      reply_rate: 0,
      recent_activity: [] as any[]
    };

    // Track unique message IDs to avoid double counting
    const processedMessages = new Set();
    const openedMessages = new Set();
    const clickedMessages = new Set();
    const repliedMessages = new Set();

    events.forEach(event => {
      const messageId = event.sg_message_id;
      
      // Only process each message once for sent/delivered/bounced/dropped
      if (!processedMessages.has(messageId)) {
        processedMessages.add(messageId);
        metrics.total_sent++;

        if (event.event_type === 'delivered') {
          metrics.delivered++;
        } else if (event.event_type === 'bounce') {
          metrics.bounced++;
        } else if (event.event_type === 'dropped') {
          metrics.dropped++;
        }
      }

      // Track opens
      if (event.event_type === 'open' && !openedMessages.has(messageId)) {
        openedMessages.add(messageId);
        metrics.opened++;
      }

      // Track clicks
      if (event.event_type === 'click' && !clickedMessages.has(messageId)) {
        clickedMessages.add(messageId);
        metrics.clicked++;
      }

      // Track replies (using SendGrid's inbound parse webhook)
      if (event.event_type === 'inbound' && !repliedMessages.has(messageId)) {
        repliedMessages.add(messageId);
        metrics.replied++;
      }

      // Add to recent activity (last 10 events)
      if (metrics.recent_activity.length < 10) {
        metrics.recent_activity.push({
          type: event.event_type,
          email: event.email,
          timestamp: event.timestamp,
          campaign_id: event.campaign_id,
          lead_id: event.lead_id
        });
      }
    });

    // Calculate rates
    if (metrics.total_sent > 0) {
      metrics.delivery_rate = (metrics.delivered / metrics.total_sent) * 100;
      metrics.open_rate = (metrics.opened / metrics.delivered) * 100;
      metrics.click_rate = (metrics.clicked / metrics.delivered) * 100;
      metrics.reply_rate = (metrics.replied / metrics.delivered) * 100;
    }

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching email metrics:', error);
    res.status(500).json({ error: 'Failed to fetch email metrics' });
    return;
  }
});

export default router; 