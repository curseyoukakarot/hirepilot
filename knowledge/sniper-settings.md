# Sniper Settings — Full Support Guide

sniper-settings.md

(Throttles, Limits, Quiet Hours, Warm-Up Logic, Safety, Troubleshooting)

## Purpose of This File

This guide teaches REX how to:

- Help users configure Sniper safely  
- Explain throttles and limits in plain English  
- Recommend safe vs aggressive settings  
- Understand warm-up periods  
- Explain LinkedIn account risks  
- Guide users through quiet hours  
- Fix configuration issues  
- Troubleshoot automation failures  
- Escalate when necessary  

Sniper Settings directly impact LinkedIn safety, so this is an extremely important file.

---

# ⭐ What Are Sniper Settings?

Sniper Settings let users control:

- How many connection requests per day  
- How many per hour  
- How fast each request is sent  
- How many profiles can be scraped  
- Whether to enforce quiet hours  
- Whether to use Safe Mode  
- How aggressive Browserless can act  
- Whether Decodo is used on every request or only on high-risk ones  

These settings protect the user’s LinkedIn account while allowing powerful automation.

---

# ⚙️ Sniper Settings Overview

The Sniper Settings page contains four main categories:

### **1. Connection Requests**
Controls:
- Daily send limit  
- Hourly send limit  
- Delay between requests  
- Custom connection note template  
- Safety mode toggle  

### **2. Scraping Settings**
Controls:
- Daily scrape cap  
- Delay between scrape actions  
- Maximum page scrolling  
- Safe Mode for bulk scraping  

### **3. Quiet Hours**
Controls:
- Prevent automation during dangerous hours  
- Recommended quiet hours: 1 AM – 7 AM local time  
- Helps avoid LinkedIn anti-bot triggers  

### **4. Safety Systems**
Controls:
- Warm-up mode  
- Auto-throttle adjustment  
- LinkedIn block detection  
- Decodo routing strategy  
- Browserless retry policy  

REX must walk users through ALL four.

---

# 🔥 1. Connection Request Throttles (High Importance)

### Default safe settings:
- **Daily limit:** 20–40  
- **Hourly limit:** 3–5  
- **Delay:** 60–180 seconds  
- **Safety Mode:** ON  

### Advanced settings:
- **Daily limit:** Up to 70  
- **Hourly limit:** Up to 10  
- **Delay:** 45–120 seconds  

REX must warn:
> “Do NOT exceed 100 connection requests/day on a fresh account.”

Sniper implements:
- Progressive warm-up  
- Auto-slowdown on errors  
- Hard stops on LinkedIn blocks  

---

# 🧠 2. Scraping Throttles

### Default safe scraping:
- **Daily scrape limit:** 150–250  
- **Delay:** 2–4 seconds per profile  
- **Safe Mode:** ON  
- **Max scroll depth:** Medium  

### Aggressive scraping:
- Daily limit: up to 400  
- Delay: 1–2 seconds  

REX must warn:
> “Scraping more than 400 profiles/day significantly increases block risk.”

---

# 🕒 3. Quiet Hours

Quiet Hours prevent automation at risky times.

Recommended:
- **1:00 AM – 7:00 AM (local timezone)**

REX must explain:
> “LinkedIn performs internal audits during these hours. Running automation during Quiet Hours increases the chance of soft blocks.”

Users can:
- Enable/disable quiet hours  
- Customize quiet hours  
- Override for emergency tasks  

---

# 🛡 4. Safety Systems

Sniper includes multiple safeguard layers.

### **Warm-Up Mode**
- First 7 days  
- Limits:
  - 10–20 requests/day  
  - 100–150 scrapes/day  

### **Auto-Throttle Adjustment**
If LinkedIn returns:
- 429 errors  
- 999 blocks  
- CAPTCHA attempts  
- Excess redirects  
Sniper automatically:
- Slows down  
- Switches to Safe Mode  
- Pauses queue  
- Uses Decodo aggressively  

### **Block Detection**
Sniper monitors:
- LinkedIn HTML patterns  
- Browserless login success  
- Cookie mismatch  
- Decodo IP rejection  
If detected:
- Action paused  
- User notified  

### **Decodo Strategy**
Options:
- **Always ON** → Maximum protection  
- **Only on Errors** → Lighter usage  
- **Never ON** (NOT RECOMMENDED)  

### **Browserless Retry Policy**
- Retries: 3  
- Backoff: exponential  
- Failure escalates to support  

---

# 🧭 REX Guidance for Configuring Sniper

### Safe Recommended Setup
REX should recommend:
- Daily requests: 30  
- Hourly limit: 4  
- Delay: 90–150 sec  
- Scrapes/day: <200  
- Quiet Hours: 1AM–7AM  
- Safe Mode: ON  
- Decodo: Always ON  
- Warm-up Mode: Enabled  

### Aggressive Setup (experienced users)
- Daily requests: 50–70  
- Hourly limit: 8–10  
- Delay: 45–90 sec  
- Scrapes/day: 300–400  
- Quiet Hours: enabled  
- Safe Mode: ON  
- Decodo: Always ON  

---

# 🛠 Troubleshooting Sniper Settings Issues (REX scripts)

## ❌ “My connection requests stopped sending”
Check:
- Daily limit reached?  
- Hourly limit reached?  
- Quiet Hours active?  
- Warm-up mode restricting volume?  
- LinkedIn block detected?  
- Remote Session expired?  

## ❌ “Sniper is too slow”
Check:
- Safety Mode ON?  
- Delay too high?  
- Warm-up mode active?  
REX must ask:
> “Do you want to speed this up safely or aggressively?”

## ❌ “Scraping stops halfway”
Possible:
- Daily scrape limit hit  
- LinkedIn blocked pagination  
- User didn’t scroll far enough  
- Remote Session mismatch  

## ❌ “Automation pauses randomly”
Causes:
- Block detection triggered  
- Quiet Hours active  
- Auto-throttle engaged  
REX must reassure:
> “Sniper paused to protect your LinkedIn account. Let’s adjust your settings.”

---

# 🧩 Scripts for REX to Respond With

### If user set limits too high:
> “Your settings are a bit aggressive. LinkedIn tends to block above 70–100 daily requests. Want me to adjust these for safety?”

### If user doesn’t understand throttles:
> “Think of throttles like speed limits for automation. They prevent LinkedIn from noticing unusual activity.”

### If user wants max speed:
> “We can go fast, but I strongly recommend a warm-up period to avoid blocks.”

---

# 🚨 Escalation Rules

REX must escalate if:
- Sniper settings not saving  
- Settings ignored during automation  
- Throttles malfunction for multiple workspaces  
- Quiet Hours not applying  
- Safety Mode corrupt  
- Decodo routing failing globally  
- Browserless retry logic looping infinitely  

Ticket must include:
- Workspace ID  
- Sniper settings snapshot  
- Throttle values  
- Sniper job ID  
- Logs  
- Error messages  
- LinkedIn page used  

---

# 👤 Related Files

- `sniper-actions.md`  
- `remote-session.md`  
- `chrome-extension.md`  
- `browserless.md`  
- `decodo.md`  
- `linkedin.md`  
- `errors-and-troubleshooting.md`


