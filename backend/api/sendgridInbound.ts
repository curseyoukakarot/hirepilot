import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const upload = multer();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function extractTokenAddress(toValue: string | undefined) {
  if (!toValue) return null;
  // to may include multiple addresses separated by commas
  const first = toValue.split(',')[0].trim();
  const match = first.match(/msg_([0-9a-fA-F-]{36})\.u_([0-9a-fA-F-]{36})\.c_([0-9a-fA-F-]+|none)@/);
  if (!match) return null;
  const campaignId = match[3] === 'none' ? null : match[3];
  return { messageId: match[1], userId: match[2], campaignId };
}

function basicAuthOk(req: express.Request): boolean {
  const basic = process.env.INBOUND_PARSE_BASIC_AUTH || '';
  if (!basic) return true; // not configured
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Basic ')) return false;
  const token = header.slice('Basic '.length);
  return token === Buffer.from(basic).toString('base64');
}

router.post('/sendgrid/inbound', upload.any(), async (req, res) => {
  console.log('📬 SendGrid Inbound Parse HIT:', { 
    to: req.body.to, 
    from: req.body.from, 
    subject: req.body.subject 
  });
  try {
    if (!basicAuthOk(req)) {
      res.status(401).send('unauthorized');
      return;
    }

    const to = (req.body.to as string) || '';
    const from = (req.body.from as string) || '';
    const subject = (req.body.subject as string) || '';
    const text = (req.body.text as string) || '';
    const html = (req.body.html as string) || '';

    const token = extractTokenAddress(to);
    if (!token) {
      res.status(400).send('invalid to token');
      return;
    }

    const { messageId, userId, campaignId } = token;

    // Optional lookup of lead by message id from messages table
    let lead_id: string | null = null;
    try {
      const { data: msgRow } = await supabase
        .from('messages')
        .select('lead_id')
        .eq('id', messageId)
        .maybeSingle();
      lead_id = msgRow?.lead_id ?? null;
    } catch {}

    await supabase.from('email_replies').insert({
      user_id: userId,
      campaign_id: campaignId,
      lead_id,
      message_id: messageId,
      from_email: from,
      subject,
      text_body: text,
      html_body: html,
      raw: req.body
    });

    // Also store an event into email_events for convenience
    await supabase.from('email_events').insert({
      user_id: userId,
      campaign_id: campaignId,
      lead_id,
      provider: 'sendgrid',
      message_id: messageId,
      event_type: 'reply',
      event_timestamp: new Date().toISOString(),
      metadata: { from, subject }
    });

    res.status(204).end();
  } catch (err) {
    console.error('[sendgrid/inbound] error:', err);
    res.status(500).send('internal error');
  }
});

export default router;


