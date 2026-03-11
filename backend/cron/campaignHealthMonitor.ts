import { supabaseDb } from '../lib/supabase';

/**
 * Proactive campaign health monitor.
 * Runs inside the main cron loop. Checks running campaigns for:
 * - Reply rate drop (<2% with 30+ sends)
 * - Bounce rate spike (>10%)
 * - Campaign stall (no sends in 48h)
 * - Milestones (first reply, 10 replies)
 *
 * Uses thread_key dedup to avoid spamming the same alert within 7 days.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

interface CampaignMetrics {
  sent: number;
  replies: number;
  bounces: number;
  opens: number;
  lastSentAt: string | null;
  totalRepliesAllTime: number;
}

/**
 * Check if a notification with this thread_key was pushed in the last 7 days
 */
async function wasRecentlyNotified(threadKey: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const { data } = await supabaseDb
    .from('notifications')
    .select('id')
    .eq('thread_key', threadKey)
    .gte('created_at', cutoff)
    .limit(1);
  return (data?.length || 0) > 0;
}

/**
 * Get trailing 7-day email metrics for a campaign
 */
async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  // 7-day metrics
  const { data: events } = await supabaseDb
    .from('email_events')
    .select('event_type, created_at')
    .eq('campaign_id', campaignId)
    .gte('created_at', sevenDaysAgo);

  let sent = 0, replies = 0, bounces = 0, opens = 0;
  let lastSentAt: string | null = null;

  for (const e of (events || []) as any[]) {
    switch (e.event_type) {
      case 'sent':
        sent++;
        if (!lastSentAt || e.created_at > lastSentAt) lastSentAt = e.created_at;
        break;
      case 'reply': replies++; break;
      case 'bounce': bounces++; break;
      case 'open': opens++; break;
    }
  }

  // All-time reply count (for milestones)
  const { count: totalRepliesAllTime } = await supabaseDb
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('event_type', 'reply');

  return { sent, replies, bounces, opens, lastSentAt, totalRepliesAllTime: Number(totalRepliesAllTime || 0) };
}

/**
 * Main health monitoring function — called from cron scheduler
 */
export async function monitorCampaignHealth(): Promise<void> {
  // Fetch all running campaigns
  const { data: campaigns } = await supabaseDb
    .from('sourcing_campaigns')
    .select('id, title, created_by, status, created_at')
    .eq('status', 'running');

  if (!campaigns?.length) return;

  // Lazy-load notification templates
  const { SourcingNotifications } = await import('../src/lib/notifications');

  for (const campaign of campaigns as any[]) {
    try {
      const metrics = await getCampaignMetrics(campaign.id);
      const userId = campaign.created_by;
      if (!userId) continue;

      // ── Check 1: Reply rate drop ──
      if (metrics.sent >= 30) {
        const replyRate = (metrics.replies / metrics.sent) * 100;
        if (replyRate < 2) {
          const threadKey = `health:${campaign.id}:reply_rate_low`;
          if (!(await wasRecentlyNotified(threadKey))) {
            await SourcingNotifications.healthAlert({
              userId,
              campaignId: campaign.id,
              campaignTitle: campaign.title || 'Untitled',
              alertType: 'reply_rate_low',
              metric: `Reply rate: ${replyRate.toFixed(1)}% (${metrics.replies}/${metrics.sent} in 7 days)`,
              recommendation: 'Consider revising subject lines or email copy. Use A/B testing to compare alternatives.'
            });
          }
        }
      }

      // ── Check 2: Bounce rate spike ──
      if (metrics.sent >= 10) {
        const bounceRate = (metrics.bounces / metrics.sent) * 100;
        if (bounceRate > 10) {
          const threadKey = `health:${campaign.id}:bounce_spike`;
          if (!(await wasRecentlyNotified(threadKey))) {
            await SourcingNotifications.healthAlert({
              userId,
              campaignId: campaign.id,
              campaignTitle: campaign.title || 'Untitled',
              alertType: 'bounce_spike',
              metric: `Bounce rate: ${bounceRate.toFixed(1)}% (${metrics.bounces}/${metrics.sent} in 7 days)`,
              recommendation: 'Check lead data quality. Verify email addresses or pause and clean your list.'
            });
          }
        }
      }

      // ── Check 3: Stall detection ──
      {
        const campaignAge = Date.now() - new Date(campaign.created_at).getTime();
        const timeSinceLastSend = metrics.lastSentAt
          ? Date.now() - new Date(metrics.lastSentAt).getTime()
          : campaignAge;

        // Only alert if campaign is old enough (>48h) and has stalled
        if (campaignAge > FORTY_EIGHT_HOURS_MS && timeSinceLastSend > FORTY_EIGHT_HOURS_MS) {
          const threadKey = `health:${campaign.id}:stalled`;
          if (!(await wasRecentlyNotified(threadKey))) {
            const hoursStalled = Math.round(timeSinceLastSend / (60 * 60 * 1000));
            await SourcingNotifications.healthAlert({
              userId,
              campaignId: campaign.id,
              campaignTitle: campaign.title || 'Untitled',
              alertType: 'stalled',
              metric: `No emails sent in ${hoursStalled} hours`,
              recommendation: 'Check if leads are available and sequences are active. The campaign may need more leads.'
            });
          }
        }
      }

      // ── Check 4: Milestones ──
      if (metrics.totalRepliesAllTime === 1) {
        const threadKey = `milestone:${campaign.id}:first_reply`;
        if (!(await wasRecentlyNotified(threadKey))) {
          await SourcingNotifications.milestoneReached({
            userId,
            campaignId: campaign.id,
            campaignTitle: campaign.title || 'Untitled',
            milestone: 'first_reply',
            message: 'First reply received!'
          });
        }
      }

      if (metrics.totalRepliesAllTime >= 10) {
        const threadKey = `milestone:${campaign.id}:10_replies`;
        if (!(await wasRecentlyNotified(threadKey))) {
          // Check if we already sent a 10_replies milestone (all-time dedup, not just 7 days)
          const { data: existing } = await supabaseDb
            .from('notifications')
            .select('id')
            .eq('thread_key', threadKey)
            .limit(1);
          if (!existing?.length) {
            await SourcingNotifications.milestoneReached({
              userId,
              campaignId: campaign.id,
              campaignTitle: campaign.title || 'Untitled',
              milestone: '10_replies',
              message: '10 replies milestone reached!'
            });
          }
        }
      }

    } catch (err: any) {
      console.warn(`[healthMonitor] Error checking campaign ${campaign.id}:`, err?.message);
    }
  }
}
