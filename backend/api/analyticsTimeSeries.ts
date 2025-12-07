import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { resolveAnalyticsScope } from '../lib/analyticsScope';

export default async function analyticsTimeSeries(req: Request, res: Response) {
  const { campaign_id = 'all', time_range = '30d' } = req.query;
  const viewerId = req.user?.id as string | undefined;

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
  const applyUserFilter = <T>(query: T & { eq: Function; in: Function }) => {
    if (!targetUserIds.length) {
      return query.in('user_id', ['00000000-0000-0000-0000-000000000000']);
    }
    if (targetUserIds.length === 1) {
      return query.eq('user_id', targetUserIds[0]);
    }
    return query.in('user_id', targetUserIds);
  };

  try {
    // Calculate date range and grouping
    const now = new Date();
    let startDate = new Date();
    let dateFormat = '';
    let interval = '';

    switch (time_range) {
      case '30d':
        startDate.setDate(now.getDate() - 30);
        dateFormat = 'YYYY-MM-DD';
        interval = 'day';
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        dateFormat = 'YYYY-"W"WW'; // Week format
        interval = 'week';
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        dateFormat = 'YYYY-MM';
        interval = 'month';
        break;
      default:
        startDate.setDate(now.getDate() - 30);
        dateFormat = 'YYYY-MM-DD';
        interval = 'day';
    }

    // Build base query
    let baseQuery = applyUserFilter(
      supabaseDb
        .from('email_events')
        .select(`
        event_type,
        event_timestamp,
        message_id,
        lead_id
      `)
        .gte('event_timestamp', startDate.toISOString())
        .order('event_timestamp', { ascending: true })
    );

    // Add campaign filter if not 'all'
    if (campaign_id !== 'all') {
      baseQuery = baseQuery.eq('campaign_id', campaign_id);
    }

    const { data: events, error } = await baseQuery;

    if (error) {
      console.error('[analyticsTimeSeries] Error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // Group events by time period
    const timeSeriesData = new Map();
    
    events.forEach(event => {
      const eventDate = new Date(event.event_timestamp);
      let periodKey = '';

      switch (interval) {
        case 'day':
          periodKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          const startOfWeek = new Date(eventDate);
          startOfWeek.setDate(eventDate.getDate() - eventDate.getDay());
          periodKey = startOfWeek.toISOString().split('T')[0];
          break;
        case 'month':
          periodKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!timeSeriesData.has(periodKey)) {
        timeSeriesData.set(periodKey, {
          period: periodKey,
          sent: new Set(),
          opens: new Set(),
          replies: new Set(),
          conversions: new Set(),
          sentCount: 0,
          opensCount: 0,
          repliesCount: 0,
          conversionsCount: 0,
          openRate: 0,
          replyRate: 0,
          conversionRate: 0
        });
      }

      const periodData = timeSeriesData.get(periodKey);

      switch (event.event_type) {
        case 'sent':
          periodData.sent.add(event.message_id);
          break;
        case 'open':
          periodData.opens.add(event.message_id);
          break;
        case 'reply':
          periodData.replies.add(event.message_id);
          break;
        case 'conversion':
          // For conversions, use lead_id as the unique identifier since message_id is generated
          if (!periodData.conversions) {
            periodData.conversions = new Set();
          }
          if (event.lead_id) {
            periodData.conversions.add(event.lead_id);
          }
          break;
        // Treat sequence step sends as 'sent' as well so they contribute to Leads Messaged
        case 'sequence_sent':
          periodData.sent.add(event.message_id || `${event.lead_id}-${event.event_timestamp}`);
          break;
      }
    });

    // Calculate metrics and convert to array
    const result = Array.from(timeSeriesData.values()).map(periodData => {
      periodData.sentCount = periodData.sent.size;
      periodData.opensCount = periodData.opens.size;
      periodData.repliesCount = periodData.replies.size;
      periodData.conversionsCount = periodData.conversions.size;
      periodData.openRate = periodData.sentCount > 0 ? (periodData.opensCount / periodData.sentCount) * 100 : 0;
      periodData.replyRate = periodData.sentCount > 0 ? (periodData.repliesCount / periodData.sentCount) * 100 : 0;
      periodData.conversionRate = periodData.sentCount > 0 ? (periodData.conversionsCount / periodData.sentCount) * 100 : 0;

      // Format period for display
      let displayPeriod = periodData.period;
      if (interval === 'day') {
        displayPeriod = new Date(periodData.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (interval === 'week') {
        displayPeriod = `Week of ${new Date(periodData.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else if (interval === 'month') {
        displayPeriod = new Date(periodData.period + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

                   return {
        period: displayPeriod,
        rawPeriod: periodData.period,
        sent: periodData.sentCount,
        opens: periodData.opensCount,
        replies: periodData.repliesCount,
        conversions: periodData.conversionsCount,
        openRate: Math.round(periodData.openRate * 10) / 10, // Round to 1 decimal
        replyRate: Math.round(periodData.replyRate * 10) / 10,
        conversionRate: Math.round(periodData.conversionRate * 10) / 10,
        interestedRate: 0, // Placeholder for now
        growth: 0 // Will be calculated below
      };
    }).sort((a, b) => a.rawPeriod.localeCompare(b.rawPeriod));

    // Calculate growth rates
    result.forEach((item, index) => {
      if (index > 0) {
        const prevItem = result[index - 1];
        const openRateGrowth = prevItem.openRate > 0 
          ? ((item.openRate - prevItem.openRate) / prevItem.openRate) * 100 
          : 0;
        item.growth = Math.round(openRateGrowth * 10) / 10;
      } else {
        item.growth = 0;
      }
    });

    res.json({
      timeRange: time_range,
      interval,
      data: result
    });

  } catch (error: any) {
    console.error('[analyticsTimeSeries] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch analytics time series' });
  }
} 