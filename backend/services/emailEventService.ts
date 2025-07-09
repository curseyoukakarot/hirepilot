import { supabaseDb } from '../lib/supabase';

export type EmailProvider = 'sendgrid' | 'gmail' | 'outlook' | 'system';
export type EmailEventType = 'sent' | 'delivered' | 'open' | 'click' | 'reply' | 'bounce' | 'conversion';

interface EmailEvent {
  user_id: string;
  campaign_id?: string;
  lead_id?: string;
  provider: EmailProvider;
  message_id: string;
  event_type: EmailEventType;
  event_timestamp?: Date;
  metadata?: Record<string, any>;
}

export class EmailEventService {
  /**
   * Store an email event in the database
   */
  static async storeEvent(event: EmailEvent): Promise<void> {
    const { error } = await supabaseDb
      .from('email_events')
      .insert({
        ...event,
        event_timestamp: event.event_timestamp || new Date(),
      });

    if (error) {
      console.error('Error storing email event:', error);
      throw error;
    }
  }

  /**
   * Store multiple email events in a batch
   */
  static async storeEvents(events: EmailEvent[]): Promise<void> {
    const { error } = await supabaseDb
      .from('email_events')
      .insert(
        events.map(event => ({
          ...event,
          event_timestamp: event.event_timestamp || new Date(),
        }))
      );

    if (error) {
      console.error('Error storing email events:', error);
      throw error;
    }
  }

  /**
   * Get email metrics for a user
   */
  static async getUserMetrics(userId: string, timeRange: '24h' | '7d' | '30d' = '7d'): Promise<any> {
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
    }

    const { data, error } = await supabaseDb
      .from('daily_email_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('day', startDate.toISOString())
      .order('day', { ascending: false });

    if (error) {
      console.error('Error fetching email metrics:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get campaign-specific metrics
   */
  static async getCampaignMetrics(campaignId: string): Promise<any> {
    const { data, error } = await supabaseDb
      .from('email_events')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('event_timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching campaign metrics:', error);
      throw error;
    }

    // Calculate metrics
    const metrics = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      delivery_rate: 0,
      open_rate: 0,
      click_rate: 0,
      reply_rate: 0,
    };

    const processedMessages = new Set();
    const openedMessages = new Set();
    const clickedMessages = new Set();
    const repliedMessages = new Set();

    data.forEach(event => {
      const messageId = event.message_id;
      
      if (!processedMessages.has(messageId)) {
        processedMessages.add(messageId);
        metrics.sent++;

        if (event.event_type === 'delivered') {
          metrics.delivered++;
        } else if (event.event_type === 'bounce') {
          metrics.bounced++;
        }
      }

      if (event.event_type === 'open' && !openedMessages.has(messageId)) {
        openedMessages.add(messageId);
        metrics.opened++;
      }

      if (event.event_type === 'click' && !clickedMessages.has(messageId)) {
        clickedMessages.add(messageId);
        metrics.clicked++;
      }

      if (event.event_type === 'reply' && !repliedMessages.has(messageId)) {
        repliedMessages.add(messageId);
        metrics.replied++;
      }
    });

    // Calculate rates
    if (metrics.sent > 0) {
      metrics.delivery_rate = (metrics.delivered / metrics.sent) * 100;
      metrics.open_rate = (metrics.opened / metrics.delivered) * 100;
      metrics.click_rate = (metrics.clicked / metrics.delivered) * 100;
      metrics.reply_rate = (metrics.replied / metrics.delivered) * 100;
    }

    return metrics;
  }

  /**
   * Get lead conversion metrics
   */
  static async getLeadConversionMetrics(campaignId: string): Promise<any> {
    const { data, error } = await supabaseDb
      .from('leads')
      .select('id, status')
      .eq('campaign_id', campaignId);

    if (error) {
      console.error('Error fetching lead conversion metrics:', error);
      throw error;
    }

    const totalLeads = data.length;
    const convertedLeads = data.filter(lead => lead.status === 'candidate').length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    return {
      total_leads: totalLeads,
      converted_leads: convertedLeads,
      conversion_rate: conversionRate
    };
  }
} 