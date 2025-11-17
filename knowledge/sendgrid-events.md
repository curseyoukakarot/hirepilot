# SendGrid Events & Webhooks

sendgrid-events.md

(Delivery Events, Webhooks, Signing, Bounce Logic, Reply Handling & Troubleshooting)

## Who this is for
Users troubleshooting email deliverability, reply tracking, bounce errors, or message inconsistencies.

REX uses this file to:
- Understand how email events enter HirePilot
- Explain what each event means
- Diagnose missing or inaccurate tracking
- Help reconnect or fix issues with the event webhook
- Determine when to escalate a ticket

---

# 📨 What Are SendGrid Events?

Whenever HirePilot sends an email through Gmail/Outlook, **SendGrid still tracks deliverability events** behind the scenes.

These events include:
- Processed  
- Delivered  
- Dropped  
- Deferred  
- Bounced  
- Spam Report  
- Unsubscribe  
- Open  
- Click  

HirePilot uses these events for:
- Analytics  
- Reply classification support  
- Sending throttles  
- Bounce detection  
- Lead scoring  
- Deliverability insights  

---

# 🔄 How Email Events Flow Into HirePilot

This is what REX must understand:

1. User’s email sends a message (via Gmail/Outlook OAuth)  
2. SendGrid silently wraps the message with a tracking pixel  
3. When something happens (open, click, bounce), SendGrid triggers a webhook  
4. HirePilot receives the JSON payload  
5. HirePilot:  
   - Updates message record  
   - Updates campaign metrics  
   - Updates lead activity  
   - Marks bounces  
   - Begins reply heuristics  
   - May slow sending (for safety)  

---

# 📡 The Event Webhook Endpoint

HirePilot exposes:

/api/sendgrid/events-verified
  
Legacy/alternate paths we may keep enabled for compatibility:
  
/api/sendgrid/events  
/api/sendgrid/webhook

This endpoint:
- Validates security signature (if enabled)
- Accepts batched events
- Saves or updates message events
- Updates lead/campaign analytics
- Triggers bounce/complaint logic

If signature verification disabled:
- Endpoint still processes events, but with lower security

---

# 🧬 How HirePilot Maps Metadata

When HirePilot sends an email through the pipeline, we attach metadata that will be echoed back on every webhook event:

```json
{
  "custom_args": {
    "workspace_id": "ws_123",
    "user_id": "user_456",
    "campaign_id": "cmp_789",
    "lead_id": "lead_abc",
    "message_id": "msg_def"
  }
}
```

REX explanation for users:

> “Every SendGrid event carries `custom_args` so HirePilot knows exactly which message, lead, and campaign the event belongs to. That’s how analytics, timelines, and auto-stop rules stay accurate.”

---

# 🔐 Signature Verification (Optional but Recommended)

REX should explain:

> “Signature verification ensures the event payload truly came from SendGrid. Without it, the webhook still works, but it’s less secure.”

HirePilot supports:
- Global verification key (default)
- Per-user SendGrid verification keys (future upgrade)

If the signature is missing or invalid:
- Endpoint skips verification
- Logs event anyway  
- (Recommended: enable verification for accuracy)

---

# 📊 Understanding Each SendGrid Event Type

### **Processed**
Email queued for sending.  
Useful for confirming delivery attempt.

### **Delivered**
Recipient’s server accepted the email.  
Most reliable signal for reach.

### **Dropped**
Recipient blocked the message.  
Common causes:
- Spam filters  
- Low domain reputation  
- Duplicate content  

### **Deferred**
Server said: “Try again later.”  
Often due to:
- Temporary throttling  
- Greylisting  

### **Bounced**
Recipient rejected the email permanently.  
HirePilot automatically:
- Marks lead as “Invalid Email”  
- Removes them from campaigns  
- Adjusts sending throttles  

### **Spamreport**
User marked the email as spam.  
HirePilot automatically:
- Stops all future messages  
- Flags the lead  
- Warns user about domain reputation  

### **Open**
Triggered by the tracking pixel.  
Not 100% accurate due to privacy.

### **Click**
Still reliable — indicates engagement.

---

# 📊 How Events Feed Into Analytics

REX must know:
- Open → increases open rate
- Click → increases CTR
- Bounce → increases bounce rate
- Spam → flags campaign and reputation
- Delivered → counts toward daily send + delivery rate
- Dropped/Deferred → logged for diagnostics, may slow sending

These roll up to:
- Campaign detail analytics
- Workspace dashboards
- Per-lead and per-message timelines
- Deliverability/reputation monitors

---

# 🔁 Sequence Progression Rules

A sequence step will advance only when ALL are true:
- We have a Delivered (or at least Processed with no failure) for the prior step
- No Bounce/Dropped/Spam for that message
- No positive reply detected (via Gmail/Outlook + classifier)
- No Out-of-Office holding flag
- The configured wait interval has elapsed inside the sending window

If any condition fails, the sequence for that lead pauses or stops based on safety rules.

---

# 🧠 How Events Affect Campaigns

REX should explain:
- High bounce rate = automatic slowdown  
- Spam reports = block future sends + alert user  
- No “Delivered” events = possible DNS issue  
- No “Open” events = likely Apple Mail Privacy  
- No webhook activity = SendGrid misconfiguration  

---

# 🔍 When SendGrid Issues Affect Reply Detection

Replies rely primarily on Gmail/Outlook, but SendGrid events support this by:
- Validating deliverability  
- Confirming send success  
- Detecting bounce → (no reply possible)

If SendGrid webhook fails:
- Reply classification might misalign  
- Messages may appear “stuck”  
- Campaign logs may freeze  

---

# 🧪 Troubleshooting SendGrid Event Issues

### **1. “Events aren’t showing in my campaign.”**
Possible:
- Webhook URL incorrect  
- Verification key mismatch  
- Authentication error  
- Endpoint unreachable  
- SendGrid trial mode limits  

REX should ask:
> “Did you recently change your SendGrid account or API key?”

---

### **2. “Bounces aren’t being logged.”**
Likely:
- SendGrid trial  
- Webhook not configured  
- DNS misconfigured  
- Email blocked upstream  

---

### **3. “Opens & clicks aren’t showing.”**
Possible:
- Apple Mail Privacy  
- Open tracking disabled  
- Click tracking disabled  
- Tracking domain misconfigured  

---

### **4. “Messages show as stuck in ‘Processing.’”**
Suggest:
- Test SendGrid webhook manually  
- Check for 4xx/5xx event failures  
- Look for rate limits  

---

### Additional targeted checks REX should use

#### “Opens aren’t showing”
- Images blocked by recipient
- Apple Mail Privacy Protection (MPP)
- Tracking disabled on campaign
- Event delivery delay (wait a few minutes)

Ask: “When was the message sent? Opens can take a few minutes to update.”

#### “Clicks not showing”
- Link formatting/encoding incorrect
- Client removed tracking redirect
- Click tracking disabled or custom domain misconfigured

#### “My email never showed Delivered”
- SPF/DKIM missing or invalid
- Domain reputation low; recipient deferred or dropped
- O365 throttling; check Deferred/Dropped events

#### “Bounces too high”
- Low-quality list; verify with enrichment/verification
- Old/role-based addresses
- Sudden cold volume increase; reduce volume and warm up

#### “Spam complaint received”
Calm script:
> “Your message was marked as spam. This is serious, but fixable. I’ll pause sends, help adjust messaging, and resume gradually to protect your domain.”

---

# 🛠️ How to Test SendGrid Webhook (For Support Agent)

REX can walk the user through:

curl -X POST  
https://app.thehirepilot.com/api/sendgrid/events-verified  
-H “Content-Type: application/json”  
-d ‘[ { “event”: “delivered”, “email”: “test@example.com” } ]’

If the endpoint returns **200**, webhook is working.

---

# 🛡️ Deliverability Tips REX Should Give

- Warm up new domains  
- Send from a company domain, not personal Gmail  
- Avoid large attachments  
- Keep sending under 200/day  
- Use clean email lists  
- Avoid spammy words in subject lines  
- Set SPF, DKIM, DMARC correctly  
- Keep bounce rate under 5%  

---

# 🚨 When REX Should Escalate a Ticket

Escalate if:
- Webhook unreachable  
- SendGrid dashboard shows failures  
- Events not arriving for > 1 hour  
- Reply tracking appears broken  
- Bounces not updating  
- Campaign analytics frozen  
- Signature verification errors looping  
- 4xx/5xx repeatedly returned  
- User downgraded SendGrid plan unexpectedly  

Ticket must include:
- User ID  
- Workspace ID  
- Campaign ID  
- Affected Message IDs (if available)
- Sample event payload  
- Webhook URL  
- SendGrid account type  
- Timestamp  
- Any related 4xx/5xx logs from the webhook receiver

Slack + email alert to Super Admin immediately.

---

# 👤 Related Files
- `gmail-outlook-integration.md`  
- `deliverability.md`  
- `campaigns.md`  
- `leads.md`  
- `message-classification.md`  


