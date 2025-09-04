import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// SendGrid sends events as an array
// Legacy unsecured webhook (kept for backward compatibility). Prefer /api/sendgrid/events with signature verification.
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
      let {
        user_id,
        campaign_id,
        lead_id
      } = custom_args as any;

      // Attempt attribution fallback from our messages table
      // Prefer lookup by sg_message_id; fallback to SMTP Message-ID header if present
      const smtpId: string | undefined = (event['smtp-id'] || event['smtp_id']) as any;
      const resolvedMessageId = sg_message_id || smtpId || null;
      if ((!user_id || !campaign_id || !lead_id) && (sg_message_id || smtpId)) {
        try {
          const ors: string[] = [];
          if (sg_message_id) ors.push(`sg_message_id.eq.${sg_message_id}`);
          if (smtpId) ors.push(`message_id_header.eq.${smtpId}`);
          if (ors.length) {
            const { data: msg } = await supabase
              .from('messages')
              .select('user_id,campaign_id,lead_id')
              .or(ors.join(','))
              .limit(1)
              .maybeSingle();
            if (msg) {
              user_id = user_id || (msg as any).user_id || null;
              campaign_id = campaign_id || (msg as any).campaign_id || null;
              lead_id = lead_id || (msg as any).lead_id || null;
            }
          }
        } catch (e) {
          // best-effort only
        }
      }

      if (!user_id) {
        console.warn(`⚠️ SendGrid event missing user_id: ${sg_message_id}`);
      }

      // Store the event in Supabase (idempotency handled on analytics layer; legacy route keeps inserts)
      const { error } = await supabase
        .from('email_events')
        .insert({
          event_type: eventType,
          user_id,
          campaign_id,
          lead_id,
          message_id: resolvedMessageId || `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sg_message_id,
          provider: 'sendgrid',
          event_timestamp: new Date(timestamp * 1000).toISOString(),
          metadata: {
            email,
            sg_message_id,
            sg_event_id,
            smtp_id: smtpId,
            event_source: 'sendgrid_webhook'
          }
        });

      if (error) {
        console.error('❌ Error storing SendGrid email event:', error);
      } else {
        console.log(`✅ Stored SendGrid ${eventType} event for ${email}`);
      }

      // Update message status/flags in messages table
      if (eventType === 'delivered' || eventType === 'bounce' || eventType === 'dropped') {
        const status = eventType === 'delivered' ? 'delivered' : 'failed';
        const { error: updateError } = await supabase
          .from('messages')
          .update({ status })
          .or([
            sg_message_id ? `sg_message_id.eq.${sg_message_id}` : '',
            resolvedMessageId ? `message_id_header.eq.${resolvedMessageId}` : ''
          ].filter(Boolean).join(','));
        if (updateError) console.error('❌ Error updating message status:', updateError);

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

      if (eventType === 'open') {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ opened: true })
          .or([
            sg_message_id ? `sg_message_id.eq.${sg_message_id}` : '',
            resolvedMessageId ? `message_id_header.eq.${resolvedMessageId}` : ''
          ].filter(Boolean).join(','));
        if (updateError) console.error('❌ Error updating message opened flag:', updateError);
      }

      if (eventType === 'click') {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ clicked: true })
          .or([
            sg_message_id ? `sg_message_id.eq.${sg_message_id}` : '',
            resolvedMessageId ? `message_id_header.eq.${resolvedMessageId}` : ''
          ].filter(Boolean).join(','));
        if (updateError) console.error('❌ Error updating message clicked flag:', updateError);
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