import { supabaseDb } from '../lib/supabase';
import { sendViaProvider } from '../services/providerEmail';

interface ScheduledMessage {
  id: number;
  user_id: string;
  lead_id: string;
  content: string;
  template_id: string | null;
  channel: string;
  scheduled_for: string;
  status: string;
}

export class MessageScheduler {
  private static instance: MessageScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  private constructor() {}

  public static getInstance(): MessageScheduler {
    if (!MessageScheduler.instance) {
      MessageScheduler.instance = new MessageScheduler();
    }
    return MessageScheduler.instance;
  }

  public start(): void {
    if (this.isRunning) {
      console.log('MessageScheduler is already running');
      return;
    }

    console.log('🚀 Starting MessageScheduler...');
    this.isRunning = true;
    
    // Check for messages to send every minute
    this.intervalId = setInterval(async () => {
      await this.processScheduledMessages();
    }, 60000); // 1 minute interval

    // Process immediately on start
    this.processScheduledMessages();
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 MessageScheduler stopped');
  }

  private async processScheduledMessages(): Promise<void> {
    try {
      // Get messages that are scheduled for now or earlier
      const { data: scheduledMessages, error } = await supabaseDb
        .from('scheduled_messages')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString())
        .limit(50); // Process up to 50 messages at a time

      if (error) {
        console.error('Error fetching scheduled messages:', error);
        return;
      }

      if (!scheduledMessages || scheduledMessages.length === 0) {
        return; // No messages to process
      }

      console.log(`📬 Processing ${scheduledMessages.length} scheduled messages`);

      // Process each message
      for (const message of scheduledMessages) {
        await this.sendScheduledMessage(message);
      }
    } catch (error) {
      console.error('Error in processScheduledMessages:', error);
    }
  }

  private async sendScheduledMessage(message: ScheduledMessage): Promise<void> {
    try {
      // Mark as sending
      await supabaseDb
        .from('scheduled_messages')
        .update({ status: 'sending' })
        .eq('id', message.id);

      // Get lead details
      const { data: lead, error: leadError } = await supabaseDb
        .from('leads')
        .select('*')
        .eq('id', message.lead_id)
        .single();

      if (leadError || !lead) {
        throw new Error(`Lead not found: ${message.lead_id}`);
      }

      // Get template details if template_id is provided
      let subject = 'Message from HirePilot';
      if (message.template_id) {
        const { data: template } = await supabaseDb
          .from('email_templates')
          .select('subject')
          .eq('id', message.template_id)
          .single();
        
        if (template?.subject) {
          subject = template.subject;
        }
      }

      // Use unified provider sender (supports sendgrid, gmail/google, outlook)
      const htmlBody = message.content.replace(/\n/g, '<br/>');
      const ok = await sendViaProvider(
        (message.channel as any),
        { ...lead }, // expects lead-like object with id, email, campaign_id
        htmlBody,
        message.user_id,
        subject
      );
      if (!ok) {
        throw new Error(`Provider send failed for channel ${message.channel}`);
      }

      // Mark as sent
      await supabaseDb
        .from('scheduled_messages')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', message.id);

      console.log(`✅ Sent scheduled message ${message.id} to ${lead.email}`);
    } catch (error) {
      console.error(`❌ Error sending scheduled message ${message.id}:`, error);
      
      // Mark as failed
      await supabaseDb
        .from('scheduled_messages')
        .update({ 
          status: 'failed', 
          error_message: (error as any)?.message || 'send_failed' 
        })
        .eq('id', message.id);
    }
  }
}

// Export singleton instance
export const messageScheduler = MessageScheduler.getInstance(); 