const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { EventWebhook } = require('@sendgrid/eventwebhook');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Minimal, self-contained handler for SendGrid webhook
router.post(
  '/webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  async (req, res) => {
    const sig = (req.headers['x-twilio-email-event-webhook-signature'] ?? '').toString().trim();
    const ts  = (req.headers['x-twilio-email-event-webhook-timestamp'] ?? '').toString().trim();

    if (!sig || !ts) {
      console.warn('🛑  missing headers');
      return res.status(400).send('missing headers');
    }

    const ew = new EventWebhook();
    const pubKey = process.env.SENDGRID_WEBHOOK_PUB_KEY ? process.env.SENDGRID_WEBHOOK_PUB_KEY.trim() : '';
    const ecPubKey = ew.convertPublicKeyToECDSA(pubKey);

    // Debug: log buffer status
    console.log('Buffer.isBuffer(req.body):', Buffer.isBuffer(req.body), 'Length:', req.body.length);

    const ok = ew.verifySignature(ecPubKey, req.body, sig, ts);
    if (!ok) {
      console.warn('🛑  signature mismatch');
      return res.status(400).send('signature mismatch');
    }

    // optional replay-attack guard (5-minute window)
    if (Math.abs(Date.now()/1000 - Number(ts)) > 300) {
      console.warn('🛑  stale timestamp');
      return res.status(400).send('stale timestamp');
    }

    // ✅ verified – process events here
    const events = JSON.parse(req.body.toString('utf8'));
    console.log('Verified webhook events:', events);

    for (const event of Array.isArray(events) ? events : [events]) {
      const {
        email,
        timestamp,
        event: eventType,
        sg_message_id,
        ip,
        useragent
      } = event;

      // Extract campaign_id and lead_id from custom tracking data
      const customArgs = event.custom_args || {};
      const { campaign_id, lead_id, user_id } = customArgs;

      // Insert tracking event into database
      const { error } = await supabase
        .from('email_tracking_events')
        .insert({
          user_id,
          campaign_id,
          lead_id,
          email_id: sg_message_id,
          event_type: eventType,
          event_timestamp: new Date(timestamp * 1000),
          ip_address: ip,
          user_agent: useragent
        });

      if (error) {
        console.error('Error inserting tracking event:', error);
      } else {
        console.log('Successfully inserted tracking event');
      }
    }

    res.status(200).end();
  }
);

module.exports = router; 