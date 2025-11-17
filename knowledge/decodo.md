# Decodo — Full Support Guide

decodo.md

(Proxy Unblocking, Routing Logic, LinkedIn Safety, Error Handling, Troubleshooting)

## Purpose of This File

This file teaches REX how to:

- Understand Decodo Site Unblocker (the proxy system protecting LinkedIn automation)  
- Explain why LinkedIn blocks requests  
- Understand how Decodo integrates with Browserless  
- Troubleshoot scraping/automation failures caused by network blocks  
- Recommend safe retry strategies  
- Identify high-risk usage patterns  
- Know when a Decodo-level issue is happening  
- Escalate major failures correctly  

Decodo is a CRITICAL part of HirePilot's LinkedIn automation stack.

---

# ⭐ What Is Decodo?

Decodo is a **proxy unblocking and anti-detection network** used by HirePilot to:

- Safely route LinkedIn requests  
- Avoid LinkedIn detection  
- Rotate IPs  
- Handle region-based restrictions  
- Add an extra anonymization layer  
- Reduce rate limits  
- Improve scraping reliability  
- Protect user sessions  

Decodo is **not a browser** — it works underneath Browserless to prevent network-level blocks.

Think of it as:

> “The shield that protects Browserless from LinkedIn’s detection systems.”

---

# 🔥 Why LinkedIn Needs a Proxy Layer

LinkedIn aggressively monitors:

- IP patterns  
- Traffic signatures  
- Connection volume  
- Repeated scraping  
- Unusual automation fingerprints  
- Geographic mismatches  

If they detect suspicious patterns, they issue:

- Temporary blocks  
- CAPTCHA pages  
- 999 errors  
- 429 rate limits  
- Empty HTML pages  
- Soft bans that last 6–48 hours  

Decodo helps prevent these.

---

# 🧩 How Decodo Integrates Into HirePilot

When HirePilot performs LinkedIn actions:

1. Browserless launches a stealth Chrome session  
2. Decodo routes the network traffic  
   - Residential IP  
   - Geo-matched region  
   - Randomized routing  
3. Decodo monitors:  
   - Block attempts  
   - Rate limits  
   - Page response signatures  
4. If LinkedIn blocks the request:  
   - Decodo switches routing  
   - Sniper enters safe mode  
   - Retry logic kicks in  

Decodo ensures:

- Higher successful scrape rates  
- Lower block rates  
- More stable bulk actions  
- More consistent automation  

---

# ⚙️ Decodo Safety Features

### 1) Residential Proxy Routing
Prevents datacenter IP blocks and automated detection flags.

### 2) IP Rotation
Used only when necessary (excessive rotation raises risk).

### 3) Sticky Sessions
Preserves continuity so the same user appears consistent.

### 4) Automatic Unblocking
If LinkedIn blocks a route, Decodo selects a new IP and Browserless retries; Sniper updates job status.

### 5) Rate Limit Detection
Detects 999/429 and signals HirePilot to slow down.

### 6) Risk Scoring
Suspicious traffic triggers throttling, Quiet Hours, and warm-up logic.

---

# 🧠 When HirePilot Uses Decodo

Decodo is used for:

- Sales Navigator scraping (high-value pages)  
- LinkedIn Recruiter scraping (most protected)  
- Bulk scraping (100–1,000 profiles)  
- Sniper Actions (connect, scroll, navigate)  
- Heavy automation tasks (weekly sourcing, ongoing extraction)  

Note: Extension-based scraping uses the user's local IP (Decodo not used).

---

# 🛑 Decodo Cannot Do These Things

Decodo CANNOT:

- Overcome expired LinkedIn cookies  
- Fake LinkedIn subscription levels  
- Access Recruiter without user license  
- Scrape LinkedIn if user is logged out  
- Bypass hard account blocks  
- Prevent all soft blocks  
- Avoid bans if Sniper is set too aggressively  

REX must emphasize:
> “Decodo protects your session, but you still need a valid LinkedIn account and cookies.”

---

# 🛠 Troubleshooting Decodo Errors (REX scripts)

## ❌ Error: “Decodo Block Detected”
Meaning: LinkedIn blocked the current proxy route  
Fix: Retry automatically → Recapture cookies if repeated → Reduce scraping intensity → Increase delays

## ❌ Error: “Decodo Timed Out”
Causes: LinkedIn not responding, route saturated, regional mismatch  
Fix: Retry → Switch to recommended location

## ❌ Error: “LinkedIn Returned Blank Page”
Reason: Hard rate limit, proxy block, fingerprint flagged  
Fix: Activate Safe Mode → Reduce volume → Pause 12–24 hrs → Recapture cookies

## ❌ Error: “Proxy Failed Authentication”
Meaning: Temporary auth issue  
Fix: Retry; if repeated → escalate

## ❌ Error: “Too Many Redirects”
Reason: LinkedIn detecting unusual patterns  
Fix: Reset session → Recapture cookies

## ❌ Error: “Unable to Load LinkedIn”
Check: Did Browserless fail first? Did Decodo route fail? Is LinkedIn down?

---

# 🕵️ REX Guided Diagnostics

### When scraping fails:
> “It looks like LinkedIn blocked your current route. I’ll retry using a different protected route through Decodo.”

### When connection requests fail:
> “Decodo is reporting a rate limit. Let’s slow down your Sniper settings so your account stays safe.”

### When session errors occur:
> “Your LinkedIn session may have expired. Let’s refresh your cookies through the Chrome Extension.”

---

# 🛡 Recommended Practices (REX safety guidance)

- Always enable Quiet Hours  
- Keep daily scrapes below 300–400  
- Keep daily connection requests below 70  
- Avoid running multiple Sniper jobs simultaneously  
- Reduce volume on rate limits  
- Refresh cookies daily  
- Keep Safe Mode on for Recruiter scraping  
- Avoid logging into LinkedIn from multiple locations  

---

# 🚨 When REX Must Escalate to Support

Escalate when:

- Decodo blocked for multiple users  
- Decodo routing broken across regions  
- LinkedIn HTML changes break parsing  
- Browserless fails across many users  
- Recruiter pages not loading system-wide  
- Sales Navigator returns blank HTML globally  
- Decodo authentication expired  
- Proxy footprint detected by LinkedIn  
- Users repeatedly fail despite conservative settings  

Ticket must include:

- Workspace ID  
- Decodo response codes  
- Browserless Job ID  
- LinkedIn URL involved  
- Error type  
- Session status  
- Sniper throttles  
- HTML or screenshot (if available)  

---

# 👤 Related Files

- `browserless.md`  
- `remote-session.md`  
- `sniper-actions.md`  
- `sniper-settings.md`  
- `linkedin-scraping.md`  
- `chrome-extension.md`  
- `errors-and-troubleshooting.md`


