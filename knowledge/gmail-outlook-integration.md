# Gmail & Outlook Email Integrations

gmail-outlook-integration.md

(Email Connection, OAuth, Sending Limits, Errors, Deliverability & Troubleshooting)

## Who this is for
Users connecting Gmail or Outlook to send campaigns, troubleshoot disconnections, or resolve deliverability issues.

REX uses this file to:
- Walk users through connecting Gmail/Outlook
- Troubleshoot OAuth failures
- Explain sending limits
- Handle disconnections & refresh tokens
- Ensure safe deliverability behavior
- Trigger ticket creation for deep email issues

---

# 📧 Why You Need an Email Integration

To send campaigns through HirePilot, users must connect:

- **Gmail (Google Workspace / @gmail.com)**  
**or**
- **Outlook (Microsoft 365 / Outlook.com / Hotmail)**

HirePilot sends email directly from *your* inbox to ensure:
- Higher deliverability  
- Personal sender identity  
- Better reply detection  
- Seamless thread tracking  
- Compliance with Gmail/Outlook sending rules  

**Sending email through HirePilot uses zero credits.**

---

# Gmail & Outlook Integration — Complete Support Guide

## Purpose of This File

This guide teaches REX how to:

- Help users connect Gmail or Outlook to HirePilot  
- Explain how OAuth works in simple terms  
- Fix provider connection issues  
- Understand scoped permissions  
- Handle disconnections  
- Diagnose threading issues  
- Detect throttling or rate limits  
- Provide step-by-step troubleshooting  
- Escalate severe connection errors  

This file is CRITICAL for the Support Agent.

---

# 📧 Supported Email Providers

- **Gmail (Google Workspace or personal Gmail)**  
- **Outlook (Microsoft 365, Office365, Outlook.com)**  
- **Custom SMTP (coming soon)**  
- **HirePilot Mail (SendGrid)**  

---

# 🔐 How OAuth Works (Explain Simply)

When a user connects Gmail or Outlook:

1. They click “Connect Email”  
2. Google/Microsoft show a permission screen  
3. User approves  
4. OAuth token is returned to HirePilot  
5. HirePilot stores it securely and uses it to:
   - Send messages  
   - Thread replies  
   - Read metadata (NOT full inbox)  
   - Detect replies  
   - Reduce spam  
   - Improve deliverability tracking  

REX script to explain:

> “HirePilot never stores your password. You sign in directly with Google or Microsoft and they give us a secure token that lets us send and receive messages on your behalf.”

---

# 📥 What HirePilot Can Access

HirePilot only receives:

- Thread metadata  
- Message IDs  
- Basic header info  
- Body of messages sent by/through HirePilot  
- Replies to campaigns  

HirePilot CANNOT:

- View your full inbox  
- Access unrelated messages  
- Read personal emails  
- See attachments from outside campaigns  

REX should reassure privacy-complete clarity.

---

# 🧭 How to Connect Gmail (Step-by-Step)

### Step 1  
Go to:  
**Settings → Email Integration**

### Step 2  
Click:  
**Connect Gmail**

### Step 3  
Choose correct Google account.

### Step 4  
Approve permissions:
- Send email  
- Read metadata of emails sent through HirePilot  
- Manage mailboxes related to the thread  

### Step 5  
HirePilot confirms connection:
- Status: Connected  
- Provider: Gmail  
- Daily send limit visible  

---

# 🧭 How to Connect Outlook (Step-by-Step)

### Step 1  
Open:  
**Settings → Email Integration**

### Step 2  
Click:  
**Connect Outlook**

### Step 3  
Microsoft login appears  

### Step 4  
Approve:
- Send mail as user  
- Read mail metadata  
- Access mailbox settings  

### Step 5  
Connection confirmed  

---

# ⚠️ Common User Mistakes (REX must watch for these)

- Trying to connect workplace Gmail with private Google account  
- Login popup blocked by browser  
- Using Incognito mode  
- Not logged into correct Microsoft tenant  
- Admin policy blocking OAuth apps  
- Incorrect Outlook license (needing Business/Enterprise)  
- Google Workspace admin blocking external apps  

---

# 🧨 Email Sending Differences (Gmail vs Outlook)

## Gmail
- Threading is very reliable  
- Rate limits are lower (100–500/day depending on reputation)  
- Fast OAuth refresh cycles  
- Strong spam detection  
- Requires warm-up  

## Outlook (Microsoft)
- More aggressive throttling  
- Slower webhooks  
- Occasionally fails silently  
- Uses Graph for metadata  
- Threading sometimes breaks with aliases  

REX must teach users how each behaves.

---

# 🔄 Reconnect Flow (REX must guide)

REX should suggest reconnecting if:
- Reply detection stops  
- Send fails with 401/403  
- Threading breaks  
- OAuth token expired  

Steps:
1. Go to Settings → Email Integration  
2. Click “Disconnect”  
3. Refresh page  
4. Click “Connect Gmail/Outlook” again  
5. Approve permissions  

---

# 🔎 Common OAuth Errors (REX scripts)

## ❌ Error: “Authentication failed”
Cause: token expired  
Fix: reconnect email

## ❌ Error: 403 Forbidden (Gmail)
Cause:
- App not allowed by Workspace admin  
- Permission scopes blocked  
REX should guide user:
- Ask admin to allow external OAuth apps  
- Provide admin instructions  

## ❌ Error: “Send quota exceeded”
Cause: daily limit reached  
Outlook often returns: 429 Too Many Requests  
Fix:
- Reduce sends  
- Adjust sending window  
- Increase wait times  
- Slow domain warm-up  

## ❌ Error: “Provider temporarily unavailable”
Microsoft servers sometimes rate-limit heavily.  
Fix:
- Wait 30–60 minutes  
- Switch to HirePilot Mail temporarily  

---

# 🧠 Threading Logic (Extremely Important)

HirePilot threads messages by:
- Message-ID  
- In-Reply-To headers  
- Gmail Conversation-ID  
- Outlook InternetMessageId  

Threading breaks when:
- User uses an alias address  
- Recipient replies from a different email  
- Subject line changed significantly  
- Provider strips headers  
- Outlook servers modify threading metadata  

REX must explain in simple terms:
> “Threading relies on provider metadata. If the reply comes from a different email or the subject changes, Gmail/Outlook sometimes break the thread.”

---

# 🛠️ Troubleshooting Guide (REX MUST USE)

## Issue: “Emails not sending”
Check:
- Is provider connected?  
- Did user hit send limit?  
- Any OAuth errors in logs?  
- Campaign paused?  

## Issue: “Replies not showing in HirePilot”
Ask:
- “Did the prospect reply from a different email?”  
- “Is the original message threaded in Gmail/Outlook?”  
- “Is email connection still active?”  

## Issue: “Connection button spinning forever”
Likely:
- Popup blocked  
- Browser extension interference  
Fix:
- Allow popups  
- Try new tab  

## Issue: “Outlook keeps disconnecting”
Cause:
- Token expiration  
- Microsoft throttling  
- Admin restrictions  
Fix:
- Reconnect  
- Verify permissions  
- Use a licensed Business account  

---

# 🔐 Security & Data Handling

REX must reinforce:
- OAuth tokens encrypted at rest  
- Tokens stored securely, not exposed in frontend  
- Tokens refreshed automatically  
- HirePilot does NOT read user inbox outside campaign threads  

---

# 🚨 When REX Must Escalate a Ticket

Escalate if:
- Gmail/Outlook consistently returning 403 for all users  
- Metadata API failing  
- Multiple users reporting “replies missing”  
- OAuth refresh tokens failing  
- Provider webhooks not delivering metadata  
- Microsoft Graph rate limits > 6 hours  
- Gmail returns “Suspicious app behavior” errors  
- Send logs missing entirely  
- Tokens failing to decrypt  

Ticket includes:
- User  
- Workspace  
- Provider  
- Campaign ID  
- Last successful message ID  
- Error logs  
- OAuth details (sanitized)  

---

# 👤 Related Files

- `sendgrid-events.md`  
- `deliverability.md`  
- `campaign-wizard.md`  
- `classification.md`  
- `errors-and-troubleshooting.md`

# 🔐 OAuth Connection Flow (Step-by-Step)

REX should walk users through conversationally.

### **1. Go to Settings**
Sidebar → **Settings** → **Email Integration**

### **2. Choose Provider**
- Connect **Gmail**  
- Connect **Outlook**

### **3. Approve Access**
User sees an OAuth window that requests:
- Send email  
- Read email headers  
- Monitor mailbox for replies  
- Access inbox metadata  

HirePilot does **NOT**:  
- Read email content  
- Access other folders  
- Touch unrelated messages  

### **4. Connection Success**
User sees:
- Connected provider  
- Email address  
- Daily limit estimation  

---

# 💡 Email Connection Best Practices

REX should encourage:
- Use a company domain, not personal @gmail.com  
- Set up SPF, DKIM, DMARC  
- Warm up new domains  
- Avoid sending 300+ emails/day from a cold domain  
- Pause campaigns when traveling or using VPNs  

---

# 📊 Daily Sending Limits

HirePilot **protects** user accounts with built-in safety rules.

### **Recommended Limits**
- **Gmail:** 150–200/day  
- **Outlook:** 150–200/day  
- **New domains:** Start with 30–50/day  

### **Automatic Slowdown**
REX slows down sending when:
- Bounce rate spikes  
- Lots of replies come in  
- SPF/DKIM issues detected  
- Provider returns “throttled” headers  
- Inbox receives “Too many requests” errors  

REX explains this proactively:
> “To keep your account safe, I’ve slowed your sending temporarily. You can increase again once reputation stabilizes.”

---

# 🔄 How Reply Detection Works

HirePilot uses:
- Gmail/Outlook webhooks  
- IMAP-like metadata checks  
- SendGrid delivery events  

Replies are processed by:
- Thread detection  
- Classification model  
- Lead/Candidate conversion logic  
- Workflow triggers  

Issues with reply detection usually mean:
- OAuth expired  
- Inbox disconnected  
- Provider blocked metadata  
- SendGrid event webhook error  

---

# 🔥 Common Issues & REX Troubleshooting Scripts

### **1. “My emails stopped sending.”**
REX should ask:
- “Do you see a reconnect email banner?”  
- “Have you recently changed your Google/Microsoft password?”  
- “Have you hit today’s sending limit?”  
- “Is the campaign in ‘Paused’ state?”  
- “Is your timezone correct in settings?”  

---

### **2. “My email disconnected.”**
This happens if:
- User changed password  
- Provider revoked tokens for security  
- Token expired after 7 days (Microsoft)  
- Suspicious login from new device  
- Too many IMAP connections  

Fix:
> “Click ‘Reconnect Email’ inside Settings → Email.”  

---

### **3. “Replies aren’t being detected.”**
Check:
- Email connected?  
- SendGrid event webhook firing?  
- Did reply come from another alias?  
- Did reply include no quoted content?  

REX can say:
> “Sometimes replies come from a secondary address or mobile alias. I’ll help you locate it manually.”

---

### **4. “Messages show as sent but not delivered.”**
Possible:
- SPF/DKIM not set  
- Inbox flagged for spam  
- User sending too fast  
- New domain reputation low  
- Recipient server blocking  

Ask:
> “When was this domain created?”  
> “Do you have access to domain DNS?”  

---

### **5. “Outlook won’t connect.”**
Causes:
- Work accounts with strict policies  
- Disabled SMTP  
- Authentication blockers  
- Conditional access policies  

Fix:
> “Your Microsoft admin may need to enable ‘SMTP AUTH’ or OAuth app access.”

---

# 🧰 SPF / DKIM / DMARC (Deliverability Essentials)

REX should give this explanation:
> “These DNS settings tell Gmail and Outlook that HirePilot is allowed to send email on your behalf. Without them, your email may land in spam or get rate-limited.”

HirePilot provides:
- DNS records for SPF  
- DNS records for DKIM  
- DMARC helper  

REX should walk users through:

```text
1. Open your domain host (GoDaddy, Namecheap, Cloudflare)
2. Go to DNS settings
3. Add the SPF record we provide
4. Add DKIM keys
5. Add the recommended DMARC policy
```

If the user gets confused:

“If you want, I can generate the exact DNS instructions based on your provider.”

⸻

🧪 Troubleshooting Email Connection Errors

Error: “400 — invalid_scope”

Cause:
	•	User didn’t accept a required permission

Fix:
	•	Retry OAuth and click “Allow All.”

Error: “403 — access_denied”

Cause:
	•	Google Workspace admin blocked app

Fix:
	•	Admin must allow external OAuth apps

Error: “429 — too many requests”

Cause:
	•	Gmail/Outlook throttling

Fix:
	•	REX slows sending automatically

Error: “500 — internal error”

Cause:
	•	Provider outage
	•	HirePilot API hiccup

Fix:
	•	Retry within 5–10 min
	•	REX should create a ticket if persistent

⸻

🛠️ Disconnecting or Reconnecting an Account

Disconnect

Settings → Email → Disconnect

This will:
	•	Pause campaigns
	•	Stop replies
	•	Silence workflow triggers

Reconnect

Just redo OAuth.

All sequences resume automatically once reconnected.

⸻

🚨 When REX Should Escalate a Ticket

REX must create a ticket if:
	•	Gmail/Outlook repeatedly fails OAuth
	•	Replies fail for > 2 hours
	•	Users receive 4xx/5xx errors during send
	•	DNS validation not recognized
	•	SPF/DKIM cannot be verified
	•	SendGrid webhook crashes
	•	Provider blocks API calls
	•	Email events are not logging
	•	Campaigns stuck in “Sending…”

Ticket must include:
	•	User ID
	•	Workspace ID
	•	Provider (Gmail/Outlook)
	•	Campaign ID (if relevant)
	•	Error codes
	•	Steps attempted
	•	Browser + device
	•	Full timestamp

Slack + email alert must be sent to Super Admin immediately.

⸻

👤 Related Files
	•	campaigns.md
	•	sendgrid-events.md
	•	deliverability.md
	•	workflows-automation.md
	•	leads.md
	•	candidates.md

---


