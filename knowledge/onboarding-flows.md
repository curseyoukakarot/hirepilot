# Onboarding Flows in HirePilot  

onboarding-flows.md

(Setup steps, wizard logic, integrations, first milestones, troubleshooting onboarding issues)

### Complete Support Documentation for REX (Support Agent)

---

## 🎯 Purpose of This File  

This file equips REX to:

- Guide new users through initial setup  
- Recognize onboarding stage & user progress  
- Explain integrations (email, chrome extension, sniper, REX)  
- Identify missing steps causing errors  
- Encourage users to reach the first milestone (“Send first campaign” or “Submit first candidate”)  
- Troubleshoot onboarding roadblocks  
- Understand free plan vs paid plan onboarding differences  
- Trigger fallback steps if something fails  

Onboarding is the single highest-leverage part of the product.

---

# 🧭 The Onboarding Journey (Overview)

Every new user goes through 6 milestones:

1) Create account  
2) Complete basic settings  
3) Set up email integration (Gmail / Outlook)  
4) Install Chrome extension  
5) Run first sniper scrape OR add first lead  
6) Send first campaign OR create first Job REQ  

If a user reaches milestone 6, they almost always become active long-term.

---

# 🧱 The Onboarding Wizard (Step-by-Step Logic)

When a user signs in for the first time, they see the Onboarding Wizard.

## Step 1 — Profile Info
- Name, company name, recruiting focus  
- Optional: upload logo  

REX troubleshooting:
> “If onboarding stalls here, it's usually browser autofill or an ad blocker. Refresh and complete each field manually.”

## Step 2 — Email Integration (Gmail or Outlook)
Choices: Gmail OAuth or Outlook OAuth  
Common failures: pop-up blocked, OAuth redirect issue, wrong account type, corporate admin block  

REX response:
> “Check if your browser is blocking pop-ups — that’s the #1 reason email connection fails.”

## Step 3 — Install HirePilot Chrome Extension
Purpose: scraping, LinkedIn → Lead creation, Sales Navigator/Recruiter scraping, cookie sync (for automation)  
Common issues: non-Chrome browser, extension disabled, incognito restrictions, corporate policies  

## Step 4 — Add Your First Leads
Options: manual add, CSV import, Chrome extension (LinkedIn), Apollo (if connected), Sniper bulk enrichment  

REX nudge:
> “Let’s add your first leads — once they’re in, everything else makes more sense.”

## Step 5 — Create First Campaign
Ensure: email integration connected, leads have emails, credits available, messaging passes safety checks  
Select: template, cadence, audience  

## Step 6 — Create First Job REQ (ATS Path)
If user is ATS-focused: create REQ → add candidates → submit to client  

REX tip:
> “Focusing on hiring? Let’s set up your first Job REQ to activate the ATS side.”

---

# 🧩 Understanding Onboarding States

States:
- not_started  
- in_progress  
- skipped_step  
- integration_pending  
- completed  

Signals:
- Email integration connected, extension installed, leads count > 0, campaign exists, REQ exists, first message sent  

REX prompts:
> “Looks like you haven’t connected your email yet — want me to walk you through it?”  
> “I see you already created your first campaign. Want help sending it?”

---

# 🚧 Common Onboarding Issues & Fixes

## “My email won't connect”
Causes: pop-up blocked, wrong login type, corporate OAuth block, adblocker  
Fix: enable pop-ups, try another browser/incognito, remove stale connection and reconnect

## “I installed the extension but it doesn’t show”
Causes: Safari/Firefox, disabled extension, corporate restrictions  
Fix: use Chrome/Brave, enable extension, request admin allow-list

## “My dashboard is empty”
Cause: no leads/candidates yet  
Fix:
> “Let's add your first leads — your dashboard will come alive instantly.”

## “I can’t send a campaign”
Causes: no email integration, no credits, no template, leads missing emails  
Fix: connect integration, add credits/upgrade, enrich or add emails, save message template

## “I can’t create a Job REQ”
Causes: plan restriction, missing mandatory fields, pipeline init error  
Fix: complete required fields; reset/initialize pipeline state; confirm plan

---

# 🧠 REX Conversational Examples

First login:
> “Welcome to HirePilot! Want me to help you get fully set up? It only takes a few minutes.”

Stuck in wizard:
> “Tell me which step you’re on — I’ll walk you through it.”

Email integration clarity:
> “This lets HirePilot send campaigns and track replies. It’s required for outreach.”

Extension prompt:
> “The extension lets you scrape LinkedIn in one click. Want the install link?”

No leads added:
> “Everything starts with data. Let’s add your first few leads — it takes 15 seconds.”

ATS-first users:
> “Let’s create your first Job REQ and add a candidate — I’ll guide you.”

---

# 🛠️ Advanced Onboarding Logic

REX should detect plan, credits, user type (recruiter/agency/owner), and primary workflow (ATS vs Outreach), then tailor guidance.

Examples:
- Staffing agency → prioritize Job REQs  
- Sourcer → prioritize campaigns  
- Business owner → prioritize deals  

---

# 🚨 When REX MUST Escalate

Escalate immediately if:
- Email OAuth failing broadly  
- Chrome extension fails to load across users  
- Onboarding wizard looped/stuck  
- Job REQ creation cannot save  
- Pipeline cannot initialize  
- Leads cannot import  
- Campaign creation errors repeatedly  
- Trial activation broken  
- Subscription plan not applying  

Ticket must include:
- User ID, Workspace ID, failing step, browser/device, console errors (if any), screenshots

---

# 🔗 Related Files  

- `email-integration.md`  
- `campaigns.md`  
- `sniper.md`  
- `job-reqs.md`  
- `chrome-extension.md`  
- `authentication.md`  

