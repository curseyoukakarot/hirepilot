# LinkedIn Integrations — Full Support Guide

linkedin.md

(LinkedIn, Sales Navigator, LinkedIn Recruiter, Permissions, Features, Limitations, Integrations)

## Purpose of This File

This file teaches REX how to:

- Explain all LinkedIn-related capabilities inside HirePilot  
- Understand differences between:
  - LinkedIn (free)
  - Sales Navigator
  - LinkedIn Recruiter  
- Guide users through connecting LinkedIn through the Chrome Extension  
- Understand what data is available at each subscription tier  
- Explain scraping differences  
- Understand Sniper automation on LinkedIn  
- Troubleshoot limitations, errors, and restrictions  
- Escalate platform-wide issues  

This is one of the most important files in the support system.

---

# 🌍 The 3 Types of LinkedIn Products (REX MUST KNOW)

LinkedIn has multiple products with different capabilities.
REX must always clarify which one the user is referring to.

## **1. LinkedIn (Standard / Free LinkedIn)**
Supports:
- Viewing profiles, basic search, limited filters  
- Sending connection requests  
- Profile scraping (limited fields), basic data extraction  

Limitations:
- Less detail, limited visibility, slower pagination, request caps  

## **2. LinkedIn Sales Navigator (SN)**
Premium add-on for prospecting.
Supports:
- Advanced search, saved leads/accounts, more visible profile fields  
- Seniority/industry, lead recommendations, extended network visibility  

Used by HirePilot for:
- Bulk scraping, deep profile data, Sniper sourcing  
Requires active SN subscription.

## **3. LinkedIn Recruiter (RPS / Recruiter Lite / Recruiter Pro)**
Recruiting suite.
Supports:
- Recruiter filters, projects/talent pools, ATS-driven fields, availability, preferences  
Used by HirePilot for:
- Recruiter scraping, bulk lists, Recruiter-only fields, Sniper (Recruiter mode)  
Requires active Recruiter license.

---

# 🔌 How HirePilot Connects to LinkedIn

HirePilot does not use the official LinkedIn API (too restricted). It uses:

## Chrome Extension
For cookie capture, single/bulk scraping, Recruiter & SN scraping.

## Remote Session
Stored LinkedIn cookies for Sniper, Browserless actions, background scraping, connection requests.

## Browserless.IO
Stealth automated browser for safe automation and profile loading.

## Decodo Site Unblocker
Protects sessions, avoids rate limits, enables safe scraping, rotates IPs.

REX MUST understand this architecture.

---

# 🧠 LinkedIn Actions Supported in HirePilot

## ✔ Scraping
- Single profile (LinkedIn, SN, Recruiter)  
- Bulk scraping (LinkedIn search, SN search, SN lists)  
- Recruiter scraping (projects, talent pools)  

## ✔ Automation (Sniper)
- Connection requests, auto-scroll, auto-pagination  
- Sales Navigator sourcing, Recruiter sourcing  

## ✔ Enrichment
Via configured providers (e.g., Apollo/Hunter/Skrapp/Proxycurl/Decodo) when enabled.

## ✔ Classification
Seniority, skills, job category on scraped profiles.

---

# 🧩 Data Availability Differences (VERY IMPORTANT)

REX must know what each product exposes:

## LinkedIn (free)
- Basic fields (name, headline, company), limited experience/education, restricted 2nd/3rd-degree visibility

## Sales Navigator
- Much more profile data, full job/experience history, seniority, industry, SN lead quality, saved status, tags, extended network visibility

## LinkedIn Recruiter
- Recruiter-only fields (availability, openness, ATS info, talent insights, preferences)
- Visible only with an active Recruiter license on the user account

REX should clarify tier-based visibility in answers.

---

# 🔐 LinkedIn Safety Rules (REX must enforce)

Connection limits (safe): 20–40/day; warm max ~70/day  
Scraping limits (safe): 150–250/day; advanced up to 400/day  
High-risk behaviors:
- Running during audits (1–7AM local), multi-device logins, >100 requests/day, >500 scrapes/day, repeated failed logins, mismatched IP/geo

REX must warn proactively and recommend Quiet Hours + Sniper throttles.

---

# 🛠 Troubleshooting LinkedIn Issues (REX scripts)

## “LinkedIn blocked my session”
Fix: Recapture cookies → Lower throttles → Pause 12–24h → Enable Quiet Hours

## “Sales Navigator scraping not working”
Check: SN subscription? pages loaded? remote session expired?

## “Recruiter scraping failing”
Check: Recruiter license? Recruiter UI open? recapture cookies

## “Connection requests not sending”
Check: daily/hourly limit reached? session expired? Sniper blocked?

## “Scraping missing fields”
Explain: Tier-based visibility (SN/Recruiter-only fields)

## “LinkedIn showing blank pages”
Likely: Browserless/Decodo blocked / rate-limited → Retry → Refresh session → Safe Mode

---

# 🚨 When REX Must Escalate a Support Ticket

Escalate if:
- Scraping broken across all users  
- SN/Recruiter HTML/selector changes break parsing  
- Browserless returning empty pages repeatedly  
- Decodo returning block codes consistently  
- Sniper requests failing globally  
- Extension cookie capture failing widely  

Include in ticket:
- Workspace ID, LinkedIn URL, scrape type (profile/search/SN/Recruiter)  
- Chrome extension version, Remote Session state  
- Browserless Job ID, Decodo response codes  
- Screenshots + logs  

---

# 👤 Related Files

- `chrome-extension.md`  
- `remote-session.md`  
- `sniper-actions.md`  
- `sniper-settings.md`  
- `linkedin-scraping.md`  
- `browserless.md`  
- `decodo.md`  
- `errors-and-troubleshooting.md`

