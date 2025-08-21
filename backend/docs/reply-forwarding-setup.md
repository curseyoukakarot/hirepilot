# Reply Forwarding Setup

## Environment Variables

Add these to your environment configuration:

```bash
# Reply Forwarding Configuration
FORWARD_FROM_EMAIL=replies@thehirepilot.com
FORWARD_FROM_NAME=HirePilot Replies

# System SendGrid API Key (for forwarding)
SENDGRID_API_KEY=your_system_sendgrid_api_key
```

## How It Works

1. **Candidate replies** to a HirePilot email
2. **SendGrid Inbound Parse** captures the reply at `msg_{messageId}.u_{userId}.c_{campaignId}@reply.thehirepilot.com`
3. **Reply is saved** to `email_replies` table and tracked in analytics
4. **Reply is forwarded** to the user's real inbox with:
   - **From:** `replies@thehirepilot.com`
   - **Reply-To:** `candidate@email.com` (so user replies go back to candidate)
   - **Subject:** `[HirePilot Reply] Original Subject — candidate@email.com`
   - **Body:** Original message + HirePilot metadata

## User Configuration

Users can control forwarding via the `user_reply_forwarding_prefs` table:

```sql
-- Enable/disable forwarding
UPDATE user_reply_forwarding_prefs 
SET enabled = true 
WHERE user_id = 'user-uuid';

-- Add CC recipients
UPDATE user_reply_forwarding_prefs 
SET cc_recipients = ARRAY['manager@company.com', 'team@company.com']
WHERE user_id = 'user-uuid';
```

## Loop Protection

- Checks for `X-HirePilot-Forwarded: true` header
- Filters out `@reply.thehirepilot.com` addresses from recipient lists
- Uses system SendGrid key to prevent user key conflicts

## Testing

```bash
# Test inbound parse with forwarding
curl -X POST https://api.thehirepilot.com/api/sendgrid/inbound \
  -F "to=msg_{messageId}.u_{userId}.c_none@reply.thehirepilot.com" \
  -F "from=candidate@email.com" \
  -F "subject=Re: Job Application" \
  -F "text=Thanks for reaching out! I'm interested."
```

Expected flow:
1. Reply saved to database ✅
2. Analytics updated ✅  
3. Email forwarded to user's inbox ✅
4. User can reply directly from their inbox ✅
