# Manual Verification Guide: Reply Tracking System

## Prerequisites

1. **Environment Setup**
   ```bash
   export TEST_USER_ID="your-user-uuid"
   export TEST_EMAIL="candidate@gmail.com"
   export TEST_SENDER_EMAIL="alex@acme.com"
   export TEST_FORWARD_TO="alex.inbox@acme.com"
   export SENDGRID_API_KEY="your-sendgrid-key"
   export INBOUND_PARSE_DOMAIN="reply.thehirepilot.com"
   export FORWARD_FROM_EMAIL="replies@thehirepilot.com"
   ```

2. **Database Setup**
   ```bash
   # Run migrations
   cd supabase
   supabase db reset --linked
   # Or apply specific migrations:
   psql $DATABASE_URL -f migrations/20250821_add_email_identities_and_msg_link.sql
   psql $DATABASE_URL -f migrations/20250821_add_reply_tokens.sql
   ```

## Test 1: Automated Test Suite

```bash
cd backend
npm install
ts-node scripts/test-reply-tracking.ts
```

Expected output:
- ✅ Token generation working
- ✅ Identity created
- ✅ Message sent with metadata
- ✅ Reply processed and forwarded
- ✅ Legacy VERP fallback works

## Test 2: Manual Email Flow

### Step 1: Create Sender Identity

```sql
INSERT INTO email_identities (user_id, from_email, display_name, forward_to, is_default)
VALUES ('your-user-id', 'alex@acme.com', 'Alex Johnson', 'alex.inbox@acme.com', true);
```

### Step 2: Send Test Message

```bash
curl -X POST http://localhost:8080/api/sendgrid/send \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id",
    "to": "candidate@gmail.com",
    "subject": "Job Opportunity at Acme Corp",
    "html": "<p>Hi there! We have an exciting opportunity. Please reply if interested.</p>"
  }'
```

### Step 3: Verify Database State

```sql
-- Check message was stored with metadata
SELECT id, sender_identity_id, from_email, message_id_header, sg_message_id 
FROM messages 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC LIMIT 1;

-- Check reply token was created
SELECT token, message_id, user_id, campaign_id 
FROM reply_tokens 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC LIMIT 1;
```

### Step 4: Check Email Headers

**In Gmail/Outlook, view email source and verify:**

✅ **Reply-To**: `reply+X7fK9wQp@reply.thehirepilot.com` (short token)
✅ **From**: `alex@acme.com` or configured sender
✅ **Message-ID**: `<hex-string@thehirepilot.com>`

### Step 5: Reply from Email Client

Reply to the email from `candidate@gmail.com` with:
- Subject: "Re: Job Opportunity at Acme Corp"  
- Body: "Yes, I'm very interested! When can we talk?"

### Step 6: Verify Inbound Processing

```sql
-- Check reply was stored
SELECT * FROM email_replies 
WHERE user_id = 'your-user-id' 
ORDER BY reply_ts DESC LIMIT 1;

-- Check analytics event
SELECT * FROM email_events 
WHERE user_id = 'your-user-id' 
AND event_type = 'reply' 
ORDER BY created_at DESC LIMIT 1;
```

### Step 7: Verify Forwarding

**Check `alex.inbox@acme.com` inbox for:**

✅ **From**: `replies@thehirepilot.com`
✅ **Reply-To**: `candidate@gmail.com` (original sender)
✅ **Subject**: `[HirePilot Reply] Re: Job Opportunity at Acme Corp — candidate@gmail.com`
✅ **Headers**: 
   - `In-Reply-To: <original-message-id@thehirepilot.com>`
   - `References: <original-message-id@thehirepilot.com>`
   - `X-HirePilot-Forwarded: true`

### Step 8: Test Threading

Reply from `alex.inbox@acme.com` to the forwarded message:
- Gmail/Outlook should group it in the same conversation
- Reply should go directly to `candidate@gmail.com`

## Test 3: Legacy VERP Compatibility

### Send with Legacy Format

```bash
curl -X POST http://localhost:8080/api/sendgrid/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "to": "msg_test-legacy-123.u_your-user-id.c_none@reply.thehirepilot.com",
    "from": "candidate@gmail.com", 
    "subject": "Re: Legacy Test",
    "text": "Testing legacy VERP still works"
  }'
```

**Expected**: Reply processed successfully (fallback routing)

## Test 4: Safety Checks

### Loop Protection

```bash
curl -X POST http://localhost:8080/api/sendgrid/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "to": "reply+token123@reply.thehirepilot.com",
    "from": "test@reply.thehirepilot.com",
    "subject": "Loop Test",
    "text": "This should be blocked",
    "headers": "{\"X-HirePilot-Forwarded\": \"true\"}"
  }'
```

**Expected**: 204 response, no forwarding (loop detected)

### Invalid Token

```bash
curl -X POST http://localhost:8080/api/sendgrid/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "to": "reply+invalidtoken@reply.thehirepilot.com",
    "from": "candidate@gmail.com",
    "subject": "Invalid Token Test", 
    "text": "This should fail"
  }'
```

**Expected**: 400 error (invalid token)

## Test 5: Performance & Edge Cases

### Token Uniqueness

```bash
# Generate 1000 tokens and check for duplicates
node -e "
const { newReplyToken } = require('./lib/replyToken');
const tokens = new Set();
for(let i=0; i<1000; i++) {
  const t = newReplyToken();
  if(tokens.has(t)) throw new Error('Duplicate: ' + t);
  tokens.add(t);
}
console.log('✅ 1000 unique tokens generated');
"
```

### Large Reply Bodies

Send a reply with:
- 50KB text body
- Multiple attachments
- Unicode characters
- HTML with embedded images

**Expected**: All content preserved and forwarded correctly

## Troubleshooting

### Common Issues

1. **No reply token created**
   - Check `messages` table has the row
   - Verify foreign key constraints
   - Check for database errors in logs

2. **Forwarding not working**
   - Verify `SENDGRID_API_KEY` is set
   - Check `email_identities.forward_to` is correct
   - Look for SendGrid API errors in logs

3. **Threading broken**
   - Verify `message_id_header` is stored
   - Check `In-Reply-To` and `References` headers
   - Some email clients have different threading rules

4. **Legacy VERP failing**
   - Check regex patterns in `resolveRoutingFromAddress`
   - Verify fallback logic is reached
   - Test with various VERP formats

### Debug Commands

```bash
# Check recent messages
psql $DATABASE_URL -c "
SELECT m.id, m.to_email, m.from_email, m.message_id_header, rt.token
FROM messages m 
LEFT JOIN reply_tokens rt ON rt.message_id = m.id 
WHERE m.created_at > NOW() - INTERVAL '1 hour'
ORDER BY m.created_at DESC;
"

# Check recent replies  
psql $DATABASE_URL -c "
SELECT * FROM email_replies 
WHERE reply_ts > NOW() - INTERVAL '1 hour'
ORDER BY reply_ts DESC;
"

# Check analytics events
psql $DATABASE_URL -c "
SELECT event_type, COUNT(*) 
FROM email_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type;
"
```

## Success Criteria

- ✅ Short tokens generated and stored
- ✅ Messages linked to sender identities  
- ✅ Threading headers preserved
- ✅ Replies forwarded to correct inbox
- ✅ Legacy VERP still works
- ✅ Loop protection active
- ✅ Analytics tracking intact
- ✅ Email client threading improved
