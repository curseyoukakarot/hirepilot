# SendGrid Inbound Parse Setup for Sourcing Campaigns

This guide explains how to configure SendGrid Inbound Parse to handle email replies for sourcing campaigns.

## 🔧 SendGrid Configuration

### 1. Enable Inbound Parse

1. Log into your SendGrid account
2. Go to **Settings** → **Inbound Parse**
3. Click **Add Host & URL**

### 2. Configure Inbound Parse Settings

**Host:** `campaigns.yourdomain.com` (or subdomain of your choice)
**URL:** `https://api.yourdomain.com/api/webhooks/sendgrid/sourcing/inbound`

**Settings:**
- ✅ **POST the raw, full MIME message** (recommended for attachments)
- ✅ **POST the parsed data** (for easier processing)
- ✅ **Send raw** (optional, for debugging)

### 3. DNS Configuration

Add a MX record for your subdomain:

```
Type: MX
Name: campaigns (or your chosen subdomain)
Value: mx.sendgrid.net
Priority: 10
```

## 📧 Email Header Tracking

The system uses custom headers to track campaign and lead associations:

```
X-Campaign-Id: uuid-of-sourcing-campaign
X-Lead-Id: uuid-of-lead-record
```

These headers are automatically added when sending emails through the sourcing system.

## 🤖 AI Reply Classification

Incoming replies are automatically classified using GPT-4o-mini:

### Classification Labels:
- **positive**: Interested, wants to learn more
- **neutral**: Neutral response, needs follow-up
- **negative**: Not interested, rejection
- **oos**: Out-of-scope, unrelated content
- **auto**: Out-of-office, auto-reply messages

### Suggested Actions:
- **reply**: Send follow-up email
- **book**: Try to book a meeting/call
- **disqualify**: Remove from campaign
- **hold**: Wait before next action

## 📊 Database Storage

Replies are stored in the `sourcing_replies` table:

```sql
CREATE TABLE sourcing_replies (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES sourcing_campaigns(id),
  lead_id UUID REFERENCES sourcing_leads(id),
  direction TEXT, -- 'inbound' | 'outbound'
  subject TEXT,
  body TEXT,
  email_from TEXT,
  email_to TEXT,
  received_at TIMESTAMPTZ,
  classified_as TEXT, -- 'positive' | 'neutral' | 'negative' | 'oos' | 'auto'
  next_action TEXT    -- 'reply' | 'book' | 'disqualify' | 'hold'
);
```

## 🔔 Notifications

When replies are received, notifications are sent via:

### Slack Integration:
- Rich message with classification and suggested action
- Action buttons to view reply and campaign
- Configurable per user in settings

### Email Notifications:
- HTML email with reply details
- Direct links to admin interface
- Respects user notification preferences

## 🧪 Testing

Test the webhook with the provided script:

```bash
npm run test:sendgrid-inbound
```

This sends mock payloads to test:
- Positive replies
- Negative replies  
- Auto-replies
- Missing headers

## 🔍 Debugging

### Check Webhook Logs

Monitor the server logs for incoming webhooks:

```bash
tail -f logs/server.log | grep "SendGrid inbound"
```

### Verify Headers

Ensure outbound emails include the tracking headers:

```javascript
const headers = {
  'X-Campaign-Id': campaignId,
  'X-Lead-Id': leadId
};
```

### Test Classification

The AI classification can be tested independently:

```typescript
import { classifyReply } from '../src/routes/sendgridInbound';

const result = await classifyReply("Thanks for reaching out! I'm interested.");
console.log(result); // { label: 'positive', next_action: 'book' }
```

## 🚨 Troubleshooting

### Common Issues:

1. **Webhook not receiving data**
   - Check DNS MX record configuration
   - Verify SendGrid inbound parse URL
   - Ensure server is accessible from SendGrid

2. **Missing campaign/lead IDs**
   - Verify headers are included in outbound emails
   - Check header case sensitivity
   - Implement fallback parsing logic

3. **Classification errors**
   - Check OpenAI API key configuration
   - Monitor API rate limits
   - Review classification prompt

4. **Notification failures**
   - Verify user notification settings
   - Check Slack webhook URLs
   - Confirm email sender configuration

## 📈 Monitoring

Key metrics to monitor:

- Reply processing success rate
- Classification accuracy
- Notification delivery rate
- Response time for webhook processing

## 🔐 Security

- Webhook endpoint validates SendGrid signatures (recommended)
- Headers are sanitized before database storage
- User permissions checked for notification delivery
- Email content is safely parsed and stored
