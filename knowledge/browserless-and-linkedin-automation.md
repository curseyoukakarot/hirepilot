# Browserless + LinkedIn Automation Engine

browserless-and-linkedin-automation.md

## Full Support Documentation for REX (Support Agent)

---

## Purpose of This File

This file teaches REX how to:
- Understand HirePilot’s LinkedIn automation system  
- Explain Browserless, cookies, and remote sessions  
- Guide users through setting up LinkedIn automation  
- Diagnose session failures  
- Troubleshoot scraping, connection requests, and warm‑up behavior  
- Understand retries, fallbacks, and Proxy/CDN behavior  
- Protect users from LinkedIn bans  
- Identify when to escalate system-level issues  

---

# ⭐ Overview of HirePilot’s LinkedIn Automation Layer

HirePilot’s LinkedIn features are powered by:

1) **Browserless.io**  
   - Cloud headless Chrome; stealth mode; human-like execution; anti-bot fingerprinting  
   - Executes vetted scripts delivered from the HirePilot backend  

2) **User Cookies (from Chrome Extension)**  
   - Full `document.cookie` including `li_at`, `JSESSIONID` and related tokens  
   - Signed + encrypted in backend; used to authenticate headless sessions  

3) **n8n Orchestration (where enabled)**  
   - Triggers Browserless jobs; runs workflows; handles retries/delays/warm-up; logs & Slack notify  

4) **HirePilot Backend API**  
   - Stores session metadata; runs safety checks; builds job payloads; writes audit logs  

5) **Decodo Site Unblocker (when scraping live HTML)**  
   - Residential proxy/routing + anti-detection for Sales Navigator / Recruiter pages  

---

# 🧠 What Browserless Actually Does

Browserless runs prewritten automation scripts that:
- Visit LinkedIn or Sales Navigator pages  
- Click “Connect” and optionally add a note (≤300 chars)  
- Scroll, paginate, and wait random delays to simulate human behavior  
- Extract HTML/content for parsing (SN/Recruiter)  
- Handle minor UI drift with resilient selectors  

Built-in behavior:
- Human-like mouse movements and randomized delays  
- Stealth/fingerprint evasion + viewport/cursor activity  
- Exponential backoff retries; safe timeouts  

---

# 🔐 LinkedIn Session Authentication

Session inputs:
- Encrypted cookie string; user-agent; session timestamp; fingerprint metadata  
Storage: Encrypted at rest; rotated on recapture  

Invalidation signals:
- LinkedIn 403/429; forced login; suspicious-activity interstitial; CAPTCHA  
Result:
- Browserless job aborts; Sniper enters Safe Mode; user must recapture cookies via the Chrome Extension  

TL;DR for REX:
> “Open LinkedIn, ensure you’re logged in, then click the HirePilot extension → Capture Cookies. That refreshes the session Browserless uses.”

---

# 🎯 Browserless-Powered Tasks in HirePilot

1) Sales Navigator — Single Profile Scrape  
   - Collect: name, title, company, location, experience, education, highlights, recommendations, contact signals  

2) Sales Navigator — Bulk Scrape  
   - Scrape list/search pages for Sniper and sourcing flows; paginates and extracts structured data  

3) LinkedIn — Connection Requests  
   - Sends requests with optional note; honors daily/weekly caps; humanized delays; retries on soft failures  

4) LinkedIn Recruiter Scrape (with license)  
   - Candidate list/profile extraction; panel details; project/talent-pool scanning  

---

# 🚦 Warm-Up Logic & Safety Rules

System-enforced guardrails:
- Daily connection cap: 10–40 (new) → up to ~60 (trusted)  
- Weekly cap: ~100–150  
- Delay: 5–30s between sends (randomized)  
- Humanization: scrolls, cursor moves, occasional off-page navigation  
- Auto-pause on limits: 429/999/CAPTCHA → mark job “Rate Limited” → recommend 12–24h cooldown  

Best-practice guidance for REX:
> “Keep daily requests ≤40 while warming up; avoid >300–400 scrapes/day; enable Quiet Hours 1–7am local.”

---

# ⚠️ Common Automation Errors (Quick Meanings + Fixes)

1) “Session Invalid”  
   - Cause: expired cookies, logout, new device prompt  
   - Fix: Recapture cookies via extension (LinkedIn must be logged in)

2) 403 Forbidden  
   - Cause: LinkedIn temp block  
   - Fix: Wait 12–24h; lower volumes; keep Safe Mode on

3) 429 Too Many Requests / 999  
   - Cause: Rate limiting  
   - Fix: Auto-pause; resume after cooldown; reduce pacing

4) Script Timeout / Page Not Loaded  
   - Cause: Slow page; proxy blip; selector drift  
   - Fix: Retry job; confirm session age; if recurring, escalate

5) “Couldn’t find Connect button”  
   - Cause: Already connected; restricted; UI change  
   - Fix: Skip profile → continue job

6) Browserless Auth Error  
   - Cause: Invalid API key or service outage  
   - Fix: Escalate (likely system-wide)

---

# 🛠️ REX Troubleshooting Flow (Top-Level)

Step 1 — Identify automation type (connect, SN scrape, Recruiter scrape)  
Step 2 — Pinpoint failure axis (session, script, proxy, Browserless, block/rate limit)  
Step 3 — Apply quick fix (recapture cookies, wait 24h, reduce volume, rerun)  
Step 4 — Determine scope (account-specific vs multiple users)  
Step 5 — Retry with Safe Mode and lower throttles  
Step 6 — Escalate when systemic (see below)  

Checklists:
- “Has this worked before?”  
- “Did you reset LinkedIn password or log out?”  
- “Do manual requests still work?”  
- “Are multiple users hitting the same error?”  

---

# 🧰 Retry & Fallback Strategy

- Soft failures (timeouts/429/element missing): retry up to 3 with exponential backoff  
- Switch Decodo routing for scraping-related blocks; keep stickiness where possible  
- On repeated 403/999: enter cooldown (12–24h) and notify user  
- On session invalid: block queue for that user until cookies refreshed  

---

# 🛡 How HirePilot Protects LinkedIn Accounts

- Conservative defaults and warm-up modes  
- Randomized human-like interactions  
- Quiet Hours (recommended 1–7am)  
- Decodo residential routing for high-risk pages  
- Session encryption + scoping  
- Auto-throttle on blocks; job pausing with clear status  

Message for users:
> “We optimize for safety over speed. Staying within limits dramatically reduces the chance of LinkedIn flags.”

---

# 💬 REX Conversational Scripts

Cookie expired:  
> “Your LinkedIn session expired — let’s refresh. Log in to LinkedIn, then click the HirePilot extension → Capture Cookies.”

Rate-limited:  
> “LinkedIn temporarily slowed things down. Let’s pause for ~24h and resume with lighter pacing.”

Sales Nav scrape failed:  
> “The page didn’t load in time. I’ll retry the job and ensure your session is fresh.”

Recruiter scrape reminder:  
> “Recruiter scraping requires your own Recruiter license and an active LinkedIn session. I can help confirm both.”

---

# 🚨 When to Escalate Immediately

Escalate if:
- Browserless returning 5xx for multiple users  
- Decodo network down / routes failing globally  
- n8n orchestration/node errors halting flows  
- Script injection errors across users  
- Chrome extension cookie capture broken  
- Major LinkedIn UI changes break selectors  
- Sniper jobs freezing or deadlocking  
- Broad “invalid session” despite recent cookie capture  

Include in ticket:
- Workspace ID, LinkedIn user/email (if provided)  
- Browserless job ID, n8n workflow ID, script name/version  
- Error text/stack, cookie timestamp, target URL(s)  
- Whether Decodo routing was active; retries attempted; current throttles  

---

# 🔗 Related Files

- `browserless.md`  
- `decodo.md`  
- `remote-session.md`  
- `chrome-extension.md`  
- `sniper-actions.md`  
- `sniper-settings.md`  
- `linkedin-scraping.md`  
- `errors-and-troubleshooting.md`

