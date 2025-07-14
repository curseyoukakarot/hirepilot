import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// SendGrid sends events as an array
router.post('/sendgrid/webhook', async (req, res) => {
  const events = req.body;
  
  if (!Array.isArray(events)) {
    res.status(400).json({ error: 'Invalid webhook payload' });
    return;
  }

  try {
    // Process each event
    for (const event of events) {
      const {
        email,
        timestamp,
        event: eventType,
        sg_message_id,
        sg_event_id,
        custom_args = {}
      } = event;

      // Extract tracking data from custom_args
      const {
        user_id,
        campaign_id,
        lead_id
      } = custom_args;

      // Store the event in Supabase
      const { error } = await supabase
        .from('email_events')
        .insert({
          event_type: eventType,
          user_id,
          campaign_id,
          lead_id,
          message_id: sg_message_id || `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          provider: 'sendgrid',
          event_timestamp: new Date(timestamp * 1000).toISOString(),
          metadata: {
            email,
            sg_message_id,
            sg_event_id,
            event_source: 'sendgrid_webhook'
          }
        });

      if (error) {
        console.error('Error storing email event:', error);
      }

      // Update message status in messages table
      if (eventType === 'delivered' || eventType === 'bounce' || eventType === 'dropped') {
        const status = eventType === 'delivered' ? 'delivered' : 'failed';
        await supabase
          .from('messages')
          .update({ status })
          .eq('sg_message_id', sg_message_id);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router; 