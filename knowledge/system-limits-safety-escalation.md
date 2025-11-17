# HirePilot System Limits, Safety Rules & Escalation Protocols  

system-limits-safety-escalation.md

(Platform limits, rate limits, Sniper safety limits, credit safety, LinkedIn safety, error-classification, and escalation protocol)

### Internal Documentation for REX (Support Agent)

---

## 🎯 Purpose  

This file teaches REX how to:

- Identify & explain platform limits  
- Detect when an issue is user error vs. system error  
- Understand rate limits and safety throttles  
- Explain why certain actions are blocked  
- Recognize dangerous states  
- Trigger escalation workflows properly  
- Provide confident, engineer-level reasoning  

This is the MASTER SAFETY FILE.

---

# 🛑 GLOBAL SYSTEM LIMITS (Platform Level)

These apply across the entire system and ensure performance, safety, and fair usage.

## Requests per minute (general API):
- 60 req/min per workspace  
- Burst allowed up to 120 req/min for short periods  
- Backend enforces rate limits on: candidate updates, lead enrichments, Sniper jobs, REX batch operations  

## Storage limits:
- Resume storage: 50MB per file  
- Attachment limit: 25 files per candidate  
- Custom Table row limit per plan:  
  - Free: 2 tables  
  - Starter: 10 tables  
  - Pro: 50 tables  
  - Team: Unlimited  

## Email sending:
- Free Plan: 150/day  
- Starter: 500/day  
- Pro: 5,000/day  
- Team: Custom  
- Hard stop at 5 bounces in 24h  

## Webhook retries:
- 3 attempts (60s → 5 min → 30 min)  

---

# 🔥 SNIPER SAFETY LIMITS (LinkedIn)

LinkedIn automations MUST be safe, slow, human-like.

## Connection requests per day:
- Free: none  
- Starter: 25/day  
- Pro: 50/day  
- Team: configurable (safe cap 100/day)  

## Scraping limits:
- Sales Nav: 15 pages/hour  
- Recruiter: 10 pages/hour  
- Bulk scrape: max 300 profiles/day  

## Session rules:
- Only ONE active remote session per workspace  
- No parallel LinkedIn jobs  
- All LinkedIn requests throttled with random delays  
- Browserless retries: 3 attempts  
- Proxy rotation rules: rotate every 5–10 pages; immediate rotate on “Detection Risk Moderate”  

If user hits a Sniper block:
> “LinkedIn is rate limiting us — I recommend waiting 2–4 hours before retrying.”

---

# 🧠 CREDIT SAFETY (Prevent runaway usage)

All credit-consuming tasks are protected by:

- Dry-run checks (estimate cost first)  
- Max credit per job: 50 unless user approves  
- Mid-job credit re-check  
- Abort if workspace goes below -2 credits  

REX MUST always avoid consuming credits unintentionally.

---

# 🧩 REX TOOL SAFETY LIMITS

REX agents run inside constraints:

## AI usage rate limits:
- 20 REX actions/min  
- 200/day for Free  
- 1,000/day for Pro  
- Team: effectively unlimited (still safely throttled)  

## Automations running concurrently:
- Max 10 per workspace  
- Max 3 Sniper tasks at once  
- Max 2 enrichments in parallel  

If exceeded:
> “It looks like too many automations are running at once — let’s pause or reschedule one.”

---

# 🧱 ERROR CLASSIFICATION (What REX must detect)

REX should classify every issue into one of these buckets:

## 1. USER CONFIGURATION ERROR (Help them fix it)
Examples: wrong pipeline; missing email integration; missing SendGrid from-domain; extension not installed; remote session not connected; invalid CSV; missing credits; invalid JD; Sniper not configured.  
Tone:
> “Easy fix — let’s walk through this together.”

## 2. EXPECTED SYSTEM BEHAVIOR (Reassure user)
Examples: rate limits; Sniper throttling; pipeline reorder refresh; bulk updates taking time; parser waiting on OCR; AI cooldown; LinkedIn high-detection day.  
Tone:
> “This is normal behavior — here’s what’s happening and why.”

## 3. PLATFORM ERROR (HirePilot Server Issue)
Examples: 500; worker crash; migration conflict; webhook handler down; Sniper engine outage; persistent REX tool failures.  
Tone:
> “This looks like an internal issue — I’ll open a support ticket immediately.”

## 4. INTEGRATION ERROR (External Provider)
Examples: Stripe outage; SendGrid delay; Browserless failure; Smartproxy flagged; Apollo API down; LinkedIn detection spike.  
Tone:
> “The external tool we rely on is having an issue — here’s the workaround while the provider stabilizes.”

---

# ⚠️ ERROR CODES & MEANINGS

## 40X — User-Side Issues
- 400: bad request  
- 401: unauthorized (login issue)  
- 403: forbidden (permissions)  
- 404: missing resource  
- 429: rate limit  

## 50X — Server Errors
- 500: internal error  
- 502: upstream service failure  
- 503: queue down  
- 504: timeout  

## LinkedIn Errors
- LI-429: too many requests  
- LI-BLOCK-1: temporary warning  
- LI-BLOCK-2: action disabled  
- LI-HTML-FAIL: failed to parse dynamic content  

## Sniper Errors
- SN-SESSION-EXPIRED  
- SN-PROXY-FAIL  
- SN-PLAYWRIGHT-FAIL  
- SN-COOKIES-MISSING  

## Enrichment Errors
- E-API-NO-DATA  
- E-CREDITS-LOW  
- E-403: API key invalid  
- E-429: provider rate limit  

## Email Errors
- SG-BOUNCE  
- SG-SPAMBLOCK  
- SG-FROM-NOT-VERIFIED  
- SG-REJECT  

---

# 🌋 WHEN REX MUST ESCALATE IMMEDIATELY

REX MUST open a ticket + notify super admin (Slack + email):

## Critical Criteria
- User locked out after successful payment  
- Stripe double charges  
- Workspace stuck in past_due  
- REX tools failing 3+ times consecutively  
- Sniper engine totally unresponsive  
- Resume parser offline  
- Bulk import corrupting data  
- Candidate stages disappearing  
- Tables data loss  
- Workflow engine not firing triggers  
- Subscriptions not updating after Stripe webhook  

---

# 🧯 HOW ESCALATION WORKS (Support Agent → Engineering)

When escalation is required, REX gathers:

## Mandatory Fields:
- Workspace ID  
- User ID  
- Email  
- Exact error message  
- Error code  
- Logs (if available)  
- Steps leading up to the error  
- Screenshot (if provided)  
- Browser/device  

Then REX:
1) Creates support ticket  
2) Notifies Super Admin in Slack  
3) Sends confirmation email to the user  
4) Adds metadata for engineering  
5) Tracks resolution state  
6) Updates user as progress is made  

---

# 🧠 REX Conversational Examples

Rate limit:
> “We hit a temporary rate limit because many updates happened quickly — nothing to worry about. Let’s wait a moment and retry.”

Sniper throttle:
> “LinkedIn is tightening activity right now — we’ll automatically retry in a safe window.”

Credits out:
> “You’re out of credits, but I can help you prioritize actions until we refresh your balance.”

Platform bug:
> “This looks like an internal issue. I’m opening a ticket and notifying engineering immediately.”

---

# 🔗 Related Files  

- `sniper-settings.md`  
- `credits.md`  
- `billing-and-subscription.md`  
- `automations-workflows.md`  
- `rex-tools.md`  
- `troubleshooting.md`  

---

🎉🔥 YOU DID IT. 60 / 60 FILES COMPLETE.

