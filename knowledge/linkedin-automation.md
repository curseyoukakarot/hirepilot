# LinkedIn Automation in HirePilot  

linkedin-automation.md

(Sniper, Browserless, Remote Sessions, connect requests, cookies, throttling, proxy logic)

### Full Internal Documentation for REX (Support Agent)

---

## 🎯 Purpose of This File

This file equips REX to support ANY LinkedIn automation issue, including:

- Remote Session problems  
- Browserless session failures  
- Connect requests  
- Warm-up tiers  
- Throttling  
- LinkedIn scraper errors  
- Cookie mismatch  
- Decodo/Smartproxy failures  
- Sniper limits  
- Profile scraping inconsistencies  
- Recruiter/Sales Nav scraping  
- User safety  

LinkedIn automation is the most delicate part of HirePilot — safety and clarity are everything.

---

# 🏹 Overview: How LinkedIn Automation Works in HirePilot

LinkedIn automation is powered by Sniper, and uses:

1) HirePilot Chrome Extension → collects cookies  
2) Browserless.io (WebSocket Stealth Chromium) → runs Playwright scripts remotely  
3) Smartproxy / Decodo Site Unblocker → provides residential proxy protection  
4) Warm-Up Logic & Throttling Engine → controls daily/hourly actions  
5) Sniper Settings page → user controls limits and behavior  

REX must understand all 5 layers.

---

# 🔐 Layer 1 — LinkedIn Cookies (Foundation)

Automation requires:
- `li_at`  
- Full `document.cookie`  
- CSRF token  
- Browser metadata  

If cookie invalid → ALL automation fails.

Common problems:
- LinkedIn session expired  
- User changed password  
- MFA triggered  
- User logged out  
- LinkedIn forced re-authentication  

REX fix:
> “Open LinkedIn, log in, then return to the extension and click ‘Sync Cookies’ again.”

---

# 🕸 Layer 2 — Browserless Session

HirePilot connects to Browserless via:
- WebSocket Playwright sessions  
- Stealth mode enabled  
- Fingerprint randomization  
- Proxy injection (Smartproxy/Decodo)  

What Browserless does:
- Opens a real LinkedIn browser  
- Navigates to URLs  
- Loads profile pages  
- Scrolls safely  
- Sends connection requests  
- Scrapes HTML  

If Browserless fails → Sniper fails.

---

# ⚡ Layer 3 — Sniper Actions Available

## 1) LinkedIn Connect Requests
- Optional 300-character message  
- Safe delays  
- Warm-up controls  
- Throttling rules  

## 2) LinkedIn Profile Visits
- Used to warm up accounts safely  

## 3) Sniper Scraping
- Lightweight HTML fetch  
- DOM-safe extraction  
- Not reliant on local extension during runs  

## 4) Sales Navigator + Recruiter Scraping
- Via Browserless, Decodo, proxies  

## 5) Fetch People Lists
- For bulk runs / batches  

---

# 🔥 Layer 4 — Warm-Up Tiers (EXTREMELY IMPORTANT)

Warm-up reduces bans. Each LinkedIn account starts at Tier 0.

## Tier 0 (Day 1–2)
- 5–10 requests/day  
- 1 every 5–10 min  

## Tier 1 (Day 3–5)
- 10–20/day  
- 1 every 3–6 min  

## Tier 2 (Day 6–10)
- 20–40/day  
- 1 every 2–5 min  

## Tier 3 (Day 10+)
- 40–80/day (max safe)  
- 1 every 2–3 min  

REX must ALWAYS remind users:
> “For safety, HirePilot gradually increases your daily connection limits over your first 7–10 days.”

---

# 🛡 Layer 5 — Throttling & Safety Engine

Sniper throttles based on:
- LinkedIn’s hidden 429 signals  
- Page load times  
- Account’s connection history  
- Weekly invite limit  
- User’s chosen settings  
- LinkedIn UI slowdowns  
- Session health  
- Proxy stability  

If risk is high → Sniper pauses and notifies user.

---

# 👷 Sniper Settings Page (User Controls)

Users can set:
- Max connect requests/day  
- Requests/hour  
- Message template  
- Delays  
- Auto-retry rules  
- Safety timeout rules  
- Proxy selection  
- HTML scraping mode  

Guide users to adjust settings if:
- They get rate limited  
- Many failures occur  
- Connect requests are too aggressive  

---

# 📋 Common LinkedIn Automation Issues & Fixes

## “Connect requests failing”
Causes: cookie expired, LinkedIn restricted sending, cold account, weekly limit reached, proxy flagged  
Fix:
> “Let’s resync cookies first — that’s the #1 cause. Then reduce daily/hourly limits.”

## “Browserless failed to launch”
Causes: Browserless outage, proxy not assigned, WebSocket blocked, env vars missing  
Fix: check status; retry with fresh proxy; verify credentials/env; escalate if global

## “Sniper paused due to risk”
Causes: too many actions in a short period; LinkedIn detected patterns  
Explain:
> “Sniper paused to protect your account — let’s reduce your hourly rate.”

## “Sales Nav scrape returning empty”
Causes: Sales Nav plan expired, page not fully loaded, LinkedIn A/B UI, fingerprint mismatch  
Fix: scroll entire list; retry smaller batch; resync cookies; rotate proxy

## “Recruiter scraping not working”
Causes: wrong Recruiter UI, not in People list, lack of Recruiter license  
Fix: open Recruiter Project → People; verify license; confirm UI mode

## “LinkedIn automation logs show 429 errors”
Meaning: rate limited  
Fix: extend delay; reduce hourly/daily limits; warm up 2–3 days with visits only

## “Sniper not seeing cookies”
Fix: re-login; click Sync Cookies; disable adblockers/anti-tracking temporarily

## “Browserless session inconsistent”
Fix: reset remote session; restart Playwright container; retry with fresh proxy/fingerprint

---

# 💬 REX Conversational Examples

How automation works:
> “We use secure remote browser sessions to send connection requests safely. Your LinkedIn cookies authenticate the session, and throttling protects your account.”

Increasing limits:
> “Your account warms up automatically. After ~10 days, it’s safe to increase daily limits—want me to help adjust settings?”

Why Sniper paused:
> “It paused as a safety measure. Let’s reduce the hourly rate and resume.”

Cookies expired:
> “Log into LinkedIn, then click ‘Sync Cookies’ in the extension—that refreshes your session.”

---

# 🧩 Diagnostic Flow (REX must follow EXACTLY)

1) Confirm cookies valid and synced  
2) Confirm Sniper Settings limits align with warm-up tier  
3) Confirm Browserless session healthy  
4) Confirm proxy availability/rotation  
5) Identify action type (connect, scrape, visit)  
6) Review logs and 429 responses  
7) Walk fixes (limits, delays, cookies, proxy)  
8) Escalate if system-wide  

---

# 🚨 When REX MUST Escalate

Escalate immediately if:
- All users see Browserless failures  
- Proxy rotation not working  
- Sniper actions failing globally  
- LinkedIn UI changes break scraping  
- Automation blocked across users  
- Connect requests duplicating  
- Warm-up logic fires too fast  
- No actions sending despite valid session  

Ticket must include:
- Workspace ID, User ID  
- Sniper settings snapshot  
- Sniper logs (error codes)  
- LinkedIn session age  
- Proxy region/provider  
- Automation type  

---

# 🔗 Related Files  

- `chrome-extension.md`  
- `sniper-actions.md`  
- `browserless-and-linkedin-automation.md`  
- `decodo.md`  
- `lead-enrichment-engine.md`

