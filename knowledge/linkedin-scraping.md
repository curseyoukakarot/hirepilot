# LinkedIn Scraping — Full Support Guide

linkedin-scraping.md

(Profile scraping, search scraping, recruiter scraping, data mapping, troubleshooting)

## Purpose of This File

This file teaches REX how to:

- Explain how LinkedIn scraping works inside HirePilot  
- Guide users through Single Profile and Bulk Scraping  
- Help users understand data fields collected  
- Understand differences between:
  - LinkedIn (free)
  - LinkedIn Sales Navigator
  - LinkedIn Recruiter  
- Assist with Chrome Extension scraping vs Remote Session scraping  
- Troubleshoot scraping issues  
- Identify LinkedIn blocks, throttles, and UI changes  
- Know when to escalate scraping failures  

This is critical for users who rely on HirePilot for sourcing.

---

# ⭐ What Is LinkedIn Scraping?

LinkedIn scraping allows users to:

- Extract profile details  
- Save leads or candidates to HirePilot  
- Trigger enrichment  
- Build prospect lists  
- Power the Campaign Wizard  
- Use Sniper Actions  

HirePilot supports scraping for:

- **Free LinkedIn (standard profiles & search results)**
- **Sales Navigator**
- **LinkedIn Recruiter** (requires user license)  

Scraping can be done via:

- **Chrome Extension** (client-side)  
- **Remote Session + Browserless + Decodo** (server-side)  

REX must help users choose the right method.

---

# 🧭 Scraping Methods

HirePilot provides two scraping pathways:

## 1. **Chrome Extension Scraping (Client-Side)**  
User initiates via Chrome Extension:
- Single profile  
- Bulk scraping from search results  
- SN list scraping  
- Recruiter list scraping  

Advantages:
- Most stable  
- Less likely to be blocked  
- Immediate feedback  
- Stronger context on page  

Used for:
- Fast single profile grabs  
- Small–medium lists (up to 200)  

## 2. **Remote Session Scraping (Server-Side)**

Used for:
- Sales Nav heavy scraping  
- Recruiter scraping  
- Sniper Actions  
- LinkedIn background automation  
- Large volume scraping  

Powered by:
- Browserless.IO  
- Decodo proxy routing  
- User’s LinkedIn cookies  

More powerful but more sensitive to:
- Cookie expiration  
- LinkedIn rate limits  
- UI changes  

REX must know this distinction deeply.

---

# 🗂 What Data Does HirePilot Scrape?

HirePilot extracts:

### Profile Basics
- First name, Last name, Full name  
- Headline, Current title, Current company, Location  

### Experience
- Past roles, Dates, Companies, Titles  

### Education
- Degrees, Institutions, Timeframes  

### Skills
- Top skills, Supporting skills, Endorsements (if visible)  

### URLs
- LinkedIn URL, Sales Navigator URL, Recruiter URL (if available)  

### Sales Navigator Metadata
- Lead quality, Tags, Saved lead status, Seniority, Function  

### Recruiter-Only Fields
Only for Recruiter license holders:
- ATS tags, Activity scores, Availability, Candidate preferences  

---

# 🧩 Scraping Modes

HirePilot supports three primary scraping modes.

## 1) Single Profile Scraping
User opens a profile (LinkedIn, SN, or Recruiter) and clicks:
**“Scrape Single Profile”**

Extension extracts:
- Profile data, SN/Recruiter info, Experience, Education  
Backend then:
- Creates Lead or Candidate, or adds to Table

## 2) Bulk Scraping (Search Results)
Supported on:
- LinkedIn Search, Sales Navigator Search, LinkedIn Recruiter Search  

User must:
- Scroll to load all results, then click Bulk Scrape  

HirePilot:
- Extracts visible results, paginates hidden results, sends to backend  
- Enrichment may run automatically  

## 3) List/Project Scraping
For:
- SN Saved Leads/Accounts, Recruiter Projects/Talent Pools  

Extension extracts:
- Large volumes (1,000+) with pagination

---

# 🛠️ Troubleshooting Scraping Issues (REX scripts)

## ❌ “Scraping only captured a few profiles”
Possible:
- User didn’t scroll / infinite scroll not loaded  
- LinkedIn rate-limited  
- Extension permissions blocked  
Fix:
- Scroll to bottom, refresh page, capture smaller batches  

## ❌ “Scrape button not showing”
Possible:
- Wrong page type, extension off, unsupported browser  
Fix:
- Enable extension, refresh LinkedIn, reinstall as last resort  

## ❌ “Sales Navigator Bulk Scrape stuck”
Possible:
- SN pagination blocking, LinkedIn soft block, Remote Session expired  
Fix:
- Recapture cookies, slow down, break into smaller segments  

## ❌ “Recruiter scrape not working”
Possible:
- User lacks LinkedIn Recruiter, UI changed, access denied  
Fix:
- Confirm license, refresh Recruiter tab, recapture cookies  

## ❌ “Scraping worked yesterday but not today”
Likely:
- Session expired  
Fix:
- Recapture cookies  

## ❌ “Some fields missing”
LinkedIn restricts data:
- SN-only fields require SN  
- Recruiter-only fields require Recruiter  
REX message:
> “LinkedIn restricts some data based on your subscription tier.”

---

# 🔐 Safety Rules for Scraping

REX must remind users:
- Keep volumes moderate (100–300/day)  
- Enable Quiet Hours  
- Reduce scraping during LinkedIn UI changes  
- Avoid scraping from multiple devices at once  
- Use Sniper Settings throttles  

---

# 🧠 LinkedIn Rate Limits — REX Knowledge

Blocking likely when:
- >300–500 profiles/day, fast scrolling, many paginations, multiple sessions  

LinkedIn signals:
- 999 errors, empty HTML, endless spinners  
REX should interpret and advise safer settings.

---

# 🧭 Conversational Guidance Examples

### Choosing method:
> “For a large Sales Navigator list, Remote Session is more stable. For smaller lists, the extension is quicker.”

### Helping scrape:
> “Scroll to the bottom of the results, then click the extension and select Bulk Scrape.”

### Recruiter reminder:
> “Recruiter-mode scraping requires an active Recruiter subscription on your LinkedIn account.”

---

# 🚨 When REX Must Escalate

Escalate if:
- Scraping fails for ALL users  
- System-wide scraping failures within an hour  
- LinkedIn/SN/Recruiter UI changed and parsers break  
- Browserless receiving blank pages  
- Decodo blocked across routes  
- Extension POSTs failing system-wide  

Include in ticket:
- LinkedIn page URL, Workspace ID, Extension version, Browser version  
- Scrape type (profile/search/SN/Recruiter), Method (extension or remote)  
- User steps, Error logs, HTML snippet if available  

---

# 👤 Related Files

- `chrome-extension.md`  
- `remote-session.md`  
- `sniper-actions.md`  
- `sniper-settings.md`  
- `decodo.md`  
- `browserless.md`  
- `linkedin.md`  
- `errors-and-troubleshooting.md`


