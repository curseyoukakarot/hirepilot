# HirePilot Chrome Extension  

chrome-extension.md

(Installation, usage, scraping logic, LinkedIn modes, cookies, troubleshooting)

### Complete Support Documentation for REX (Support Agent)

---

## 🎯 Purpose of This File  

This file equips REX to:

- Walk users through installing & enabling the extension  
- Diagnose scraping issues  
- Explain Sales Navigator scraping  
- Explain LinkedIn Recruiter scraping (new)  
- Manage cookie syncing  
- Understand safety & throttling  
- Identify extension errors  
- Help users fix blocked permissions  
- Resolve “extension not working” problems  
- Handle Browserless / Puppet / Smartproxy interactions  

This is one of the most important modules in HirePilot.

---

# 🧩 What the Extension Does (High-Level)

The HirePilot Chrome Extension provides:

## 1) One-click lead creation from:
- LinkedIn profiles  
- LinkedIn Recruiter  
- Sales Navigator  

## 2) Bulk scraping from:
- Sales Navigator lists  
- Recruiter search results  
- LinkedIn search pages  
- People lists  

## 3) Cookie Sync
Required for:
- LinkedIn automation  
- Sniper Remote Sessions  
- Browserless / Playwright-based LinkedIn actions  

## 4) Sniper Integration
Allows:
- Enrichment  
- LinkedIn navigation  
- Connection request sending  
- Session warm-up  

---

# 🖥️ Installation Steps (What User Must Do)

REX must guide users like this:

## Step 1 — Use a Chromium Browser  
Supported: Chrome, Brave, Arc, Edge  
Not supported: Safari, Firefox  

## Step 2 — Install Extension
User clicks install link from the Chrome Web Store.  
Common issues:
- Corporate device policies  
- “Extension blocked by admin”  
- Managed device restrictions  

REX fix:
> “This error usually appears on corporate or school-managed devices. You may need to ask your IT admin to allow this extension.”

## Step 3 — Enable Permissions  
Must allow (as prompted by Chrome when required):
- “Run on all LinkedIn pages”  
- “Allow access to file URLs” (optional for parsing)  
- “Allow in incognito” (optional)  

---

# 🔍 Scraping Modes

The extension supports three primary locations:

## 1) Standard LinkedIn Profile Scrape
Scrapes: name, title, company, location, LinkedIn URL, experience, skills (if visible).  
Adds the lead into HirePilot instantly.  
Common issues: LinkedIn DOM changes, not logged in, translator/overlay plugins interfering.

## 2) Sales Navigator Scrape
Supports single-profile and bulk list scraping with optional enrichment via Sniper.  
Data pulled: about, highlights, job history, ICP fit, lead recommendations.  
Common issues: expired plan, 429 rate limits, page not fully loaded.

## 3) LinkedIn Recruiter Scrape (NEW)
Supports Recruiter search result lists, profile pages, and Projects → People lists.  
Requirements: active LinkedIn Recruiter license; standard (non-legacy) UI.  
Common issues: plan mismatch, UI redesign, insufficient permissions.  
REX tip:
> “Make sure you're logged into LinkedIn Recruiter and viewing candidates inside a project or a search list.”

---

# 🍪 Cookie Syncing

EXTREMELY important for Sniper & LinkedIn automation.

Extension collects (locally, then passes securely to backend when user consents/initiates):
- `li_at`  
- Full `document.cookie` string (relevant LinkedIn cookies)  
- CSRF tokens  
- Additional identifiers for: Browserless sessions, automation, connect requests, Sniper scraping  

If cookies fail:
- Automation will not work  
- LinkedIn tasks will fail  
- Sniper cannot operate  

Common reasons:
- Not logged into LinkedIn  
- Session expired / MFA required  
- Third-party cookies blocked  
- Extension permission not granted  

Fix:
> “Log out of LinkedIn, log back in, then click ‘Sync Cookies’ inside the extension. Ensure cookies are enabled in your browser.”

---

# 🧠 Safety Throttling (Built-In)

Throttles to avoid LinkedIn bans:
- Delay between scrapes  
- Delay between profiles viewed  
- Limits on bulk scraping batch sizes  
- Limits on connect requests (controlled via Sniper Settings)  
- Anti-pattern detection (fingerprinting avoidance)  

REX MUST always reinforce:
> “LinkedIn is very strict. That’s why HirePilot spaces out actions safely.”

---

# ⚠️ Common Issues & How to Fix Them

## “Extension button isn’t showing”
Causes: wrong browser, extension disabled, unsupported page, URL not a profile (missing `/in/`) or valid Recruiter/SN structure.  
Fix: pin the extension; confirm you’re on LinkedIn/Sales Nav/Recruiter; avoid PDF viewers/embedded pages.

## “Scrape failed”
Causes: LinkedIn DOM updated, not logged in, 429 rate-limited, JS execution blocked.  
Fix: refresh; scroll to load more; retry after 5–15 minutes; logout/login.

## “Bulk scrape doesn’t collect all profiles”
Reasons: infinite scroll not triggered, partial content, complex filters, Recruiter truncation.  
Fix: scroll slowly; wait 3–5 seconds; ensure list fully loaded before scraping.

## “Extension can’t sync cookies”
Causes: expired session, blocked cookies, missing permissions.  
Fix: login again; enable cookies in browser; restart browser; re-run cookie sync.

## “LinkedIn automation not working”
Causes: cookie mismatch, throttling limits, temporary LinkedIn restriction.  
Fix: resync cookies; ensure Remote Session connected; reduce limits in Sniper Settings.

## “Sales Navigator bulk scraping stops midway”
Fix: slow scroll; ensure network stability; try smaller batch; reduce CPU/memory usage; avoid other heavy tabs.

---

# 🧠 REX Conversational Examples

Getting started:
> “Open a LinkedIn profile. You’ll see the HirePilot button on the page—click it to send this lead into HirePilot.”

Bulk scraping:
> “On Sales Navigator, scroll the entire list to load all rows, then click ‘Scrape List’.”

Recruiter scraping:
> “If you have LinkedIn Recruiter, you can scrape search results or project lists similar to Sales Navigator.”

Cookies:
> “Cookies keep your LinkedIn session active so HirePilot can automate tasks safely. Want me to guide you through syncing them?”

---

# 🧪 REX Diagnostic Flow for Extension Issues

1) Confirm browser is Chromium  
2) Confirm extension installed & enabled (`chrome://extensions`)  
3) Confirm LinkedIn is loaded & user logged in  
4) Confirm page type (Profile, Sales Nav, Recruiter)  
5) Confirm scroll/DOM fully loaded  
6) Confirm cookie sync status  
7) Reproduce steps with the user  
8) Identify error category (scrape / visibility / cookie / mode)  
9) Provide targeted fix or escalate  

---

# 🧱 Integration With Sniper

Extension supports Sniper by:
- Collecting cookies  
- Passing HTML/snapshots to backend  
- Triggering enrichment  
- Feeding profile URLs  
- Enabling remote sessions (Browserless)  

Sniper tasks depending on extension:
- Sales Navigator scraping  
- LinkedIn Recruiter scraping  
- Bulk connection requests (respecting throttles)  
- Remote session linkage  
- Warm-up logic  

---

# 🚨 When REX MUST Escalate

Escalate immediately if:
- Extension not loading across users  
- Scraping fails globally (profiles/lists)  
- LinkedIn DOM changes break scraping  
- Cookies failing for all users  
- Chrome update breaks the extension  
- Sales Nav UI redesign breaks bulk scraping  
- Recruiter UI redesign breaks scraping  
- Browserless integration not receiving cookies  
- LinkedIn automation rejected by Browserless  

Ticket must include:
- Browser version, extension version  
- LinkedIn URL used  
- Workspace ID  
- Scrape attempt type (profile/list/recruiter)  
- Console/network errors (if any)  
- Cookie sync status  

---

# 🔗 Related Files  

- `sniper-actions.md`  
- `browserless-and-linkedin-automation.md`  
- `decodo.md`  
- `lead-enrichment-engine.md`  
- `client-portal.md`  
# Chrome Extension — Full Support Guide

chrome-extension.md

(Installation, Cookie Capture, LinkedIn Scraping, Sales Navigator Bulk Scraping, Recruiter Mode, Troubleshooting)

## Purpose of this File
This guide teaches REX how to:
- Explain how the extension works
- Walk users through installation step-by-step
- Help troubleshoot common issues
- Handle LinkedIn, Sales Navigator & Recruiter scraping flows
- Sync cookies for Agent Mode & Remote Session
- Provide personalized debugging steps
- Identify issues with permissions, network, proxies, and account types

This is one of the MOST IMPORTANT support files.

---

# 🧩 What the Extension Does

The HirePilot Chrome Extension is used for:

### **1. LinkedIn Profile Scraping**
- Single profile scraping  
- Bulk scraping (search results pages)  
- Extracts: Name, title, location, experience, education, about section, keywords  

### **2. Sales Navigator Scraping**
- Single profile scraping  
- Bulk scraping (Sales Nav results)  
- Extracts: Work history, experience depth, seniority, keywords, links  

### **3. LinkedIn Recruiter Scraping (NEW)**
- Single + bulk profile scraping  
- Candidate/project lists  
- Deep structured experience data  
Requirements:
- Active LinkedIn Recruiter license on the user account  
- Logged into Recruiter (`https://www.linkedin.com/talent/`)  
- Extension cookie capture completed  
Captured:
- Core profile fields, seniority, keywords, education/experience  
- Recruiter-only fields visible to the user  

### **4. Cookie Capture (Session Sync)**
- Captures user cookies (`li_at`, `JSESSIONID`, and full `document.cookie`)  
- Needed for:
  - REX Sniper Agent  
  - Remote LinkedIn Session  
  - Automated Connection Requests  
  - Sales Navigator scraping through Decodo / Browserless  

### **5. Debug Mode**
- Shows logs  
- Shows DOM changes  
- Shows scraping progress  

---

# 🧠 How It Works Behind the Scenes
- Extension injects a content script into LinkedIn or Sales Navigator pages  
- DOM scraper extracts fields  
- Script sanitizes HTML and payload  
- Sends structured JSON to HirePilot backend  
- Backend stores profile → enriches → shows inside Lead Drawer  

When scraping in bulk, extension:
- Scrolls automatically  
- Captures ~10–20 profiles per page  
- Clicks “Next” to continue through pages  
- Shows progress bar  

---

# 🧭 Installation Guide (REX must walk users through these steps)

When users say:“I don’t know how to install the extension,” REX replies with these exact steps:

### **Step 1 — Open Chrome Web Store**
Link:  
`https://chrome.google.com/webstore/detail/hirepilot-cookie-helper/...`

### **Step 2 — Click “Add to Chrome”**  
Then confirm with “Add extension.”

### **Step 3 — Pin the Extension**
Tell them to:
- Click the puzzle piece icon  
- Click the pin next to **HirePilot Cookie Helper**  

### **Step 4 — Log Into LinkedIn First**
The extension only works when:
- User is logged in  
- LinkedIn tab is open  

### **Step 5 — Log Into HirePilot**
We must identify who is scraping.

### **Step 6 — Click the Extension Icon**
User sees:
- Status: Connected / Not Connected  
- Buttons:
  - “Start LinkedIn Scrape”
  - “Start Sales Navigator Scrape”
  - “Capture Cookies”
  - “Debug View”

### Granting Permissions (if prompted)
- Click “Allow” when Chrome asks for access on `linkedin.com` and `*.linkedin.com`  
- If blocked, open `chrome://extensions` → HirePilot → Site access → “On specific sites” → add:
  - `https://www.linkedin.com/*`
  - `https://*.linkedin.com/*`
- Optionally enable “Allow in incognito” for testing

---

# 🧪 Scraping Instructions (REX should walk users through these based on what they are doing)

## **🔹 A. Single LinkedIn Profile Scrape**
Tell user:
1. Open the LinkedIn profile  
2. Click the HirePilot extension  
3. Click “Scrape Profile”  
4. Wait for confirmation: “Profile synced to HirePilot”  
5. Lead appears in **Leads** → “Scraped via Extension”

---

## **🔹 B. Bulk LinkedIn Scrape**
Tell user:
1. Go to a LinkedIn search page  
2. Apply your filters  
3. Open the extension  
4. Click “Bulk Scrape”  
5. Leave the window open  
6. Do NOT switch tabs  
7. Watch progress bar  
8. Profiles will automatically appear in HirePilot  

---

## **🔹 C. Single Sales Navigator Scrape**
1. Open Sales Navigator profile  
2. Extension → “Scrape SalesNav Profile”  
3. Data sent to HirePilot  

---

## **🔹 D. Bulk Sales Navigator Scrape**
⚠️ Works the same as above, but must be on Sales Navigator search results.

---

## **🔹 E. Capture Cookies (IMPORTANT for Sniper, Remote Sessions, Browserless)**
1. Open extension  
2. Click **“Capture Cookies”**  
3. Confirm access  
4. Cookies stored securely in HirePilot  
5. REX will confirm:
   - “Your LinkedIn cookies are now synced.”

Used for:
- Decodo Sales Navigator scraping  
- Browserless LinkedIn session  
- n8n workflows  
- Sniper settings  

---

# 🌐 How Data Flows From Chrome → HirePilot
1. User clicks Scrape or Bulk Scrape  
2. Extension collects data  
3. Extension bundles secure JSON  
4. Extension POSTs to HirePilot API endpoints, e.g.:
   - `/api/scrape/linkedin`
   - `/api/scrape/salesnav`
   - `/api/scrape/recruiter`
5. Backend identifies workspace, creates Lead/Candidate, runs enrichment, and applies tags like:
   - `scraped_linkedin`, `scraped_sales_nav`, `scraped_recruiter`
6. Optional Sniper Actions run asynchronously
7. Records appear in Leads/Candidates and can be assigned to REQs

---

# 🆘 Troubleshooting (REX must use these scripts)

## **Problem: “No active LinkedIn session”**
Possible:
- Not logged in / session expired
- Page not fully loaded before clicking extension
- Cookies expired
Fix:
- Log into LinkedIn again → refresh → Capture Cookies

## **Problem: Extension isn’t scraping**
Ask the user:
- “Are you logged into LinkedIn?”
- “Are you on the correct page?”
- “Are you using Sales Navigator scraping on a normal LinkedIn page?”

Fixes:
- Refresh page  
- Disable ad blockers  
- Reload extension  
- Update Chrome  

---

## **Problem: Sales Navigator scrape fails**
Ask:
- “Are you logged into Sales Navigator?”  
- “Does your subscription include Sales Navigator Team or Core?”

---

## **Problem: Cookies not being captured**
Common reasons:
- User not logged into LinkedIn  
- LinkedIn tab not refreshed  
- Chrome blocked third-party cookies  
- User logged into LinkedIn via Incognito  

Fix:
- Ask user to log in again  
- Refresh LinkedIn  
- Click “Capture Cookies”  

---

## **Problem: Scraper doesn’t scroll**
Reasons:
- LinkedIn changed DOM  
- Extension permission blocked  
- React virtualization changed  
- Need user to reduce filters  

REX should guide the user to:
- Reload page  
- Try again  
- Enable debug mode  

---

## **Problem: Bulk scrape stops early**
Often:
- LinkedIn rate limits  
- Too many scrolls too fast  
- Browser slowed down  

REX should reassure:
> “This is normal. LinkedIn throttles scroll events after several pages. Try again with narrower filters.”

---

## **Problem: Bulk scrape only scraped ~10 profiles**
Cause:
- Infinite scroll not loaded, or pagination not advanced
Fix:
- Scroll through more results or click “Next” before starting

---

## **Problem: Recruiter scraping not working**
Cause:
- No Recruiter license, or not on Recruiter UI
Fix:
- Confirm license → visit `linkedin.com/talent` → capture cookies again

---

## **Problem: Nothing appears in HirePilot**
Possible backend issues:
- Payload rejected  
- Incorrect token  
- User logged out of HirePilot  
- Extension outdated  

REX should escalate a support ticket if:
- 400+ errors  
- 500+ errors  
- Repeated failures  

---

## **Problem: Chrome blocked permissions**
Fix:
- `chrome://extensions` → HirePilot → Site access → allow on LinkedIn domains  
- If using Incognito, toggle “Allow in incognito”

---

# 🔒 How HirePilot Stores Data
REX must reassure users:
- Cookies encrypted at rest  
- Scraped data stored in Leads table  
- Only workspace owners and assigned users can view data  
- No third-party sharing  

---

# 🚨 When REX Should Escalate to Engineering
Ticket needed when:
- Scraper crashes repeatedly on valid pages  
- Cookies fail to save  
- Content script injection fails  
- Extension cannot detect LinkedIn DOM  
- GitHub extension build mismatch  
- Browserless sessions broken  
- Decodo proxy failures  
- LinkedIn anti-bot detection patterns appear (red flags)  
 - Sales Navigator pagination fails across many users  
 - Recruiter scraping fails across many users  

Slack alert format:
- User  
- Workspace  
- LinkedIn page being scraped  
- Extension version  
- Error logs  
- Browser info  
 - Page URL(s) and screenshot(s)  
 - Console logs (if provided)  
 - Example scraped payload snippet (if possible)  

---

# 👤 Related Files
- `linkedin-remote-session.md`  
- `linkedin-decodo.md`  
- `agent-mode.md`  
- `sniper-settings.md`  
- `leads.md`  
- `enrichment-providers.md`  
- `errors-and-troubleshooting.md`

