import express from 'express';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.post('/sendgrid/send', async (req, res) => {
  const { user_id, to, subject, html } = req.body;

  if (!user_id || !to || !subject || !html) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // 1. Get the user's SendGrid API key and default sender
    const { data, error } = await supabase
      .from('user_sendgrid_keys')
      .select('api_key, default_sender')
      .eq('user_id', user_id)
      .single();

    if (error || !data?.api_key) {
      console.error('SendGrid key lookup error:', error);
      res.status(400).json({ error: 'No SendGrid API key found for user' });
      return;
    }

    if (!data.default_sender) {
      res.status(400).json({ error: 'No default sender configured for user' });
      return;
    }

    // 2. Configure SendGrid
    sgMail.setApiKey(data.api_key);

    // 3. Prepare the email
    const trackingMessageId = crypto.randomUUID();
    const msg: any = {
      to,
      from: data.default_sender,
      subject,
      html,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      customArgs: {
        user_id,
        campaign_id: req.body.campaign_id || null,
        lead_id: req.body.lead_id || null,
        message_id: trackingMessageId
      },
      replyTo: `msg_${trackingMessageId}.u_${user_id}.c_${req.body.campaign_id || 'none'}@${process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com'}`
    };

    // 4. Send the email
    console.log('Sending email via SendGrid:', {
      to,
      from: data.default_sender,
      subject
    });

    const [response] = await sgMail.send(msg);
    console.log('SendGrid response:', response);

    // 5. Store the message in our database
    const { error: dbError } = await supabase
      .from('messages')
      .insert({
        user_id,
        to_email: to,
        subject,
        content: html,
        sg_message_id: response.headers['x-message-id'],
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Error storing message:', dbError);
    }

    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      message_id: response.headers['x-message-id']
    });

  } catch (err: any) {
    console.error('SendGrid send error:', err.response?.body || err);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: err.response?.body || err.message
    });
  }
});

export default router; 