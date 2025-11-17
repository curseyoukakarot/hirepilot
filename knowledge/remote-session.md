# Remote Session — Full Support Guide

remote-session.md

(LinkedIn Sessions, Cookies, Browserless, Decodo, Troubleshooting)

## Purpose of This File

This file teaches REX how to:

- Understand HirePilot's Remote Session system  
- Explain how LinkedIn cookies are used safely  
- Help users refresh or fix a broken session  
- Understand how Browserless.IO uses the session for automation  
- Understand how Decodo's Site Unblocker plays a role  
- Diagnose cookie expiration issues  
- Troubleshoot Sniper Actions  
- Troubleshoot LinkedIn scraping errors  
- Escalate session-related problems  

This file is CRITICAL for guiding users through LinkedIn automation & scraping.

---

# ⭐ What Is a Remote Session?

A Remote Session is a **secure, encrypted LinkedIn session** stored inside HirePilot.

The session allows the user to:

- Scrape LinkedIn profiles  
- Scrape Sales Navigator lists  
- Scrape LinkedIn Recruiter pages  
- Send LinkedIn connection requests  
- Run advanced Sniper automations  
- Let REX run background tasks on their behalf  

The Remote Session is powered by:

- **Cookies captured from the Chrome extension**  
- **Browserless.IO (LinkedIn-safe browser infrastructure)**  
- **Decodo Site Unblocker (proxy unblocking layer)**  

REX MUST be able to explain this conversationally.

---

# 🔑 What Cookies Do We Capture?

When the user clicks **Capture Cookies** in the Chrome Extension, we securely receive:

- `li_at` (primary session cookie)  
- `JSESSIONID`  
- `document.cookie` (full string)  
- Anti-bot & security tokens needed for LinkedIn automation  
- LinkedIn domain-specific cookies (login, authentication, tracking)  

REX MUST SAY:

> “We never capture your LinkedIn password — only session cookies you manually give permission for.”

---

# 🧠 Why Cookies Are Required

LinkedIn aggressively protects their platform.

Without a Remote Session, HirePilot cannot:

- Scrape Sales Navigator  
- Scrape LinkedIn Recruiter  
- Scrape Bulk Lists  
- Run Sniper  
- Take automated Browserless actions  
- Send connection requests  
- Pull advanced profile data  

REX must educate the user:

> “Your session powers all LinkedIn automation. If the session expires, everything connected to LinkedIn stops working.”

---

# 🌐 How Remote Sessions Work With Browserless

Browserless acts as:

- A **remote Chrome browser**  
- Running inside a protected infrastructure  
- With stealth mode  
- With fingerprint spoofing  
- With LinkedIn-specific safety optimizations  

When HirePilot triggers a LinkedIn workflow:

1. Browserless launches a headless Chrome  
2. Injects the user’s LinkedIn cookies  
3. Opens the correct LinkedIn page  
4. Performs the action (scrape, send request, scroll list)  
5. Returns structured HTML or JSON to HirePilot  

REX MUST KNOW:

- Browserless is safer than running Playwright from local servers  
- Browserless drastically reduces block risk  

---

# 🔥 How Remote Sessions Work With Decodo (Site Unblocker)

Decodo’s Site Unblocker adds:

- Residential proxy routing  
- Automatic CAPTCHA bypass  
- Rotation if LinkedIn blocks a request  
- Geo-routing  
- IP warming  
- Cookie-stickiness preservation  

HirePilot uses Decodo for:

- Sales Navigator scraping  
- LinkedIn Recruiter scraping  
- High-volume scraping  
- Sniper Actions that require more protection  

REX must know:

> “Browserless performs the actions, and Decodo protects the network layer to prevent LinkedIn from blocking the session.”

---

# 🧭 How Users Create a Remote Session (REX step-by-step)

REX must guide users conversationally:

1. Install the Chrome Extension  
2. Log into LinkedIn or Sales Navigator  
3. Open any LinkedIn page  
4. Click the HirePilot extension  
5. Click **Capture Cookies**  
6. Choose your workspace  
7. Wait for confirmation  
8. Session is now stored securely  

If user has multiple workspaces:

- They must select the correct one

---

# 🛠 How Remote Sessions Are Used in the App

Remote Sessions power:

- Sniper Actions  
- LinkedIn background scraping  
- Browserless workflows  
- Bulk scraping  
- Chrome Extension fallback scraping  
- Connecting REX > LinkedIn automation  
- LinkedIn Recruiter scraping  
- Connection request sending  
- Smart session reconnect  

---

# ⚠️ When a Remote Session Expires

LinkedIn sessions expire automatically every:

- 24 hours (typical)  
- 7 days (if account is trusted)  
- Faster if:
  - User logs out  
  - IP changes drastically  
  - LinkedIn flags suspicious behavior  
  - User resets password  

REX must tell user:

> “If anything LinkedIn-related suddenly stops working, refreshing your session is always the first thing to try.”

---

# 🔄 How to Refresh an Expired Session

Users must:

1. Log into LinkedIn manually  
2. Open the extension  
3. Click **Capture Cookies** again  

REX must walk users through this step-by-step.

---

# 🛑 Common Remote Session Errors

## ❌ Error: “Invalid Session”
Meaning:
- LinkedIn logged you out  
- Cookies expired  
- Session corrupted  
Fix:
- Recapture cookies  

## ❌ Error: “Browserless login failed”
Likely:
- Cookies incomplete  
- Missing critical tokens  
Fix:
- Recapture cookies on LinkedIn homepage  

## ❌ Error: “Session blocked by LinkedIn”
Meaning:
- LinkedIn suspects automation activity  
- Heavy scraping triggered soft-block  
Fix:
- Pause activity for 12–24 hours  
- Recapture cookies  
- Reduce scraping volume  
- Increase throttling in Sniper Settings  

## ❌ Error: “Decodo block detected”
Meaning:
- LinkedIn blocked the exit IP  
- Too many aggressive connections  
Fix:
- Retry automatically  
- Reroute proxy  
- If repeated → escalate  

## ❌ Error: “Remote session not found”
Meaning:
- No cookies captured yet  
- Wrong workspace selected  
Fix:
- Capture cookies again  

---

# 🔐 Safety, Risk, and Best Practices

REX MUST educate users:

- Use your **primary LinkedIn account**, not a burner  
- Warm-up accounts before heavy scraping  
- Keep Sniper throttles conservative  
- Capture cookies 1× per day  
- Avoid scraping > 300 profiles per day  
- Do not log in from multiple devices simultaneously  

REX must offer safe advice.

---

# 🧭 Troubleshooting Scripts For REX

### For expired sessions:
> “It looks like your LinkedIn session has expired. Let’s refresh it together. First, log into LinkedIn, then click the HirePilot extension and press Capture Cookies.”

### For Browserless failures:
> “I’m seeing a Browserless session error. This usually means LinkedIn blocked the cookie signature. Recapturing cookies will fix it.”

### For Decodo routing problems:
> “We’re using Decodo to protect your LinkedIn automation. It looks like LinkedIn blocked the proxy exit IP. I’ll retry the request using a different route.”

---

# 🚨 When REX Must Escalate a Support Ticket

Escalate if:

- Sessions fail across multiple users  
- Chrome Extension cannot capture cookies  
- Browserless returns repeated 500 errors  
- Decodo blocks every request  
- Scraping stops working platform-wide  
- Connection requests fail across workspaces  
- LinkedIn Recruiter scraping breaks globally  

Ticket must include:

- Workspace  
- LinkedIn URL involved  
- Browserless job ID  
- Decodo response code  
- Cookies present or missing  
- Error logs  
- User’s environment  
- Action attempted (scrape, connect, etc.)  

---

# 👤 Related Files

- `chrome-extension.md`  
- `sniper-settings.md`  
- `sniper-actions.md`  
- `linkedin.md`  
- `browserless.md`  
- `decodo.md`  
- `errors-and-troubleshooting.md`


