import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// SendGrid sends events as an array
router.post('/sendgrid/webhook', async (req, res) => {
  console.log('📧 SendGrid webhook received:', JSON.stringify(req.body, null, 2));
  
  const events = req.body;
  
  if (!Array.isArray(events)) {
    console.error('❌ SendGrid webhook: Invalid payload - not an array');
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

      console.log(`📧 Processing SendGrid event: ${eventType} for ${email} (msg: ${sg_message_id})`);

      // Extract tracking data from custom_args
      const {
        user_id,
        campaign_id,
        lead_id
      } = custom_args;

      if (!user_id) {
        console.warn(`⚠️ SendGrid event missing user_id: ${sg_message_id}`);
      }

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
        console.error('❌ Error storing SendGrid email event:', error);
      } else {
        console.log(`✅ Stored SendGrid ${eventType} event for ${email}`);
      }

      // Update message status in messages table
      if (eventType === 'delivered' || eventType === 'bounce' || eventType === 'dropped') {
        const status = eventType === 'delivered' ? 'delivered' : 'failed';
        const { error: updateError } = await supabase
          .from('messages')
          .update({ status })
          .eq('sg_message_id', sg_message_id);
        
        if (updateError) {
          console.error('❌ Error updating message status:', updateError);
        }

        // If bounced/dropped, mark related enrollments as bounced and skip pending runs
        if (eventType === 'bounce' || eventType === 'dropped') {
          try {
            if (lead_id) {
              const { data: enrollments } = await supabase
                .from('sequence_enrollments')
                .select('id,status')
                .eq('lead_id', lead_id)
                .in('status', ['active','paused']);
              const ids = (enrollments || []).map((e: any) => e.id);
              if (ids.length) {
                await supabase
                  .from('sequence_enrollments')
                  .update({ status: 'bounced', updated_at: new Date().toISOString() })
                  .in('id', ids);
                await supabase
                  .from('sequence_step_runs')
                  .update({ status: 'skipped', updated_at: new Date().toISOString() })
                  .in('enrollment_id', ids)
                  .eq('status','pending');
              }
            }
          } catch (err) {
            console.error('❌ Error marking enrollment bounced:', err);
          }
        }
      }
    }

    console.log(`✅ Processed ${events.length} SendGrid webhook events successfully`);
    res.status(200).json({ success: true, processed: events.length });
    
  } catch (error) {
    console.error('❌ SendGrid webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router; 