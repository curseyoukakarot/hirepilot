# HirePilot Integrations  

integrations.md

(All integrations: email, Slack, Zapier, Make, Apollo, Stripe, Browserless, Decodo, Calendly, SendGrid, and more)

### Complete Internal Documentation for REX (Support Agent)

---

## 🎯 Purpose of This File

This file gives REX everything required to support integration-related issues, including:

- Email integrations (Gmail / Outlook)  
- Slack notifications  
- SendGrid  
- Zapier triggers  
- Make.com workflows  
- Apollo integration  
- Stripe billing  
- Browserless automation  
- Decodo (Site Unblocker)  
- Calendly  
- Webhook troubleshooting  
- OAuth errors  
- Account permission issues  
- Trigger failures  

Integrations are the backbone of HirePilot’s automation and communication ecosystem.

---

# 📮 EMAIL INTEGRATIONS (GMAIL + OUTLOOK)

HirePilot supports:
- Gmail OAuth  
- Outlook OAuth  

Used for:
- Sending campaigns  
- Logging replies  
- Threading messages  
- Connecting REX for messaging  

## Common Gmail issues
- Pop-up blocked by browser  
- Wrong Google account selected  
- Corporate admin blocks OAuth scopes  
- “App needs verification” interstitial  
- Token expired/invalid (needs reauth)  

REX fix:
> “Let’s do a quick reconnect. Make sure pop-ups are enabled in your browser.”

## Common Outlook issues
- Personal vs Business account mix-ups  
- Enterprise Conditional Access policies  
- Admin consent required for scopes  
- MFA interruptions  
- Invalid redirect URI  

REX fix:
> “Let’s confirm whether your Outlook account is personal or business. Microsoft handles OAuth differently per account type.”

---

# 📤 SENDGRID INTEGRATION

HirePilot uses its own SendGrid account (or workspace-specific if enabled).

Used for:
- Submissions to clients  
- Notifications  
- Some transactional email  
- Magic links (deployment-dependent)  

Important: SendGrid is NOT used for campaign sending.

Common SendGrid issues:
- Webhook signature not verified  
- SendGrid outage / API rate limits  
- Email dropped (spam classification, suppression)  
- Missing or outdated template ID  

REX fix:
> “I’ll check SendGrid event logs to see if the message was dropped, deferred, or delivered.”

---

# 🧊 SLACK INTEGRATION

Used for:
- New lead alerts  
- Lead replies / positive replies  
- Pipeline updates  
- Candidate movement  
- REX notifications  
- LinkedIn automation complete events  
- Error/escalation alerts  

Setup:
- Slack OAuth  
- Select channel(s)  
- Approve scopes: incoming-webhook, chat:write  
- Optional per-event routing  

Common issues:
- Webhook removed/deleted  
- Slack app removed from workspace  
- Wrong channel or missing permissions  
- Slack rate limiting  

REX note:
> “If the webhook is missing, Slack messages fail silently. Reconnect Slack in Settings.”

---

# ⚡ ZAPIER INTEGRATION (zap_events)

Triggers include (not exhaustive):
- lead_sourced, lead_converted  
- candidate_created, candidate_updated, candidate_hired  
- message_reply  
- pipeline_stage_updated  
- submission_sent  
- invoice_paid  

Used for:
- ATS automations, CRM syncing  
- Lead routing  
- Slack or PM updates  
- Billing flows  

Common issues:
- Zap trigger not firing / Zap OFF  
- Test event not sent  
- Zapier throttle reached  
- Webhook signature mismatch / key rotated  

REX flow:
1) Verify zap_events logs  
2) Send a test event  
3) Confirm Zap is ON  
4) Confirm API key unchanged  
5) Escalate if still not firing  

---

# ⚙️ MAKE.COM INTEGRATION

Used for:
- Browserless automations  
- LinkedIn flows  
- Candidate enrichment  
- Slack alerts  
- Calendly handoffs  
- Longer multi-step sequences  

Common issues:
- Scenario disabled or paused  
- Missing/expired module token  
- Quota exceeded  
- Webhook URL stale (after duplication)  

REX response:
> “If the scenario was duplicated or moved, refresh the webhook URL and resubscribe from HirePilot.”

---

# 🔎 APOLLO INTEGRATION

Used for:
- Sourcing/enrichment  
- Email discovery  
- Company data  
- Auto-populating lead drawers  

Requirements:
- Valid Apollo API key  
- Plan supports enrichment  
- Correct workspace routing  

Common issues:
- Invalid/wrong API key  
- 403 (plan lacks enrichment scope)  
- Apollo rate limits / no credits  
- Sparse data (no match)  

REX fix:
> “Your Apollo key looks valid, but the plan may not support enrichment. Check if you’re on a plan with enrichment credits.”

---

# 🛰️ DECODO (Site Unblocker / Proxy Integration)

Used for:
- Sales Navigator / Recruiter scraping  
- Rendering and returning raw HTML  
- Unblocking LinkedIn and similar sites  
- Replacing or augmenting lower proxy layers  

Common issues:
- Region-level blocks  
- Fingerprint rejection  
- Login page returned (not authenticated data)  
- HTTP 403/405/429 from Decodo  

REX fix:
> “Let’s switch the Sniper proxy region and retry. Some LinkedIn regions temporarily restrict traffic.”

---

# 🧩 BROWSERLESS INTEGRATION

Used for:
- LinkedIn automated actions  
- Connection requests  
- Recruiter/Sales Nav scraping  
- Playwright-based humanized browsing  

Common issues:
- Timeout / navigation hung  
- WebSocket disconnect  
- Script crash / version mismatch  
- Browserless incident/outage  

REX fix:
> “I’ll restart your remote session; Browserless sometimes needs a fresh Playwright container.”

---

# 💳 STRIPE SUBSCRIPTION INTEGRATION

Used for:
- Upgrades and trials  
- Invoicing  
- Credit usage billing  
- Seat management  
- Customer portal access  

Common issues:
- Card declined  
- Missing payment method  
- Subscription cancelled / paused  
- Trial expired  
- Stripe webhook errors  

REX fix:
> “I can send a secure Stripe billing portal link so you can update your card or plan.”

---

# 📅 CALENDLY INTEGRATION

Used for:
- Scheduling interviews  
- REX scheduling assistant  
- Booking client demos  

Common issues:
- Calendar not connected in Calendly  
- Availability hidden / event type private  
- Return webhook failing  

REX fix:
> “Make sure the event type is public and your calendar is connected. We can reconnect Calendly if needed.”

---

# 🤖 REX (AI Agent) Integration

REX integrates via:
- MCP Tools (internal endpoints)  
- DB lookups and signals  
- Zapier/Slack outputs  
- Remote sessions (Browserless)  
- Decodo fallback  

REX should check before acting:
- Plan and permissions  
- Credits available  
- Tool availability and scopes  
- Workspace integration states  

---

# 🧠 REX Troubleshooting Flow for ANY Integration

1) Identify category (email / slack / scraper / proxy / browserless / stripe)  
2) Identify symptom (webhook fail / missing token / OAuth fail / 500 / timeout)  
3) Ask context (“When did it last work?” “What changed?”)  
4) Verify connection in Settings  
5) Attempt reconnection (OAuth/key refresh)  
6) Check integration logs/events  
7) Provide fix or fallback workflow  
8) Escalate if platform-wide or persistent  

---

# 🚨 When REX MUST Escalate

Escalate if:
- OAuth flows down (Google/Microsoft)  
- Slack API outage  
- SendGrid webhooks failing globally  
- Browserless outage  
- Decodo outage  
- Stripe webhooks failing  
- Zapier triggers not firing across customers  
- Make scenarios timing out repeatedly  
- Apollo API outage  
- Data syncing incorrectly or corrupted  
- Webhook signature mismatches across workspaces  

Ticket must include:
- Workspace ID  
- Integration type  
- User ID  
- Action attempted  
- Logs (if available)  
- Timestamp  
- Screenshot  
- Related entity (lead, candidate, job REQ, etc.)  

---

# 🔗 Related Files  

- `email-delivery.md`  
- `slack-notifications.md`  
- `zapier.md`  
- `browserless-and-linkedin-automation.md`  
- `sniper-actions.md`  
- `chrome-extension.md`  
- `linkedin-automation.md`  

