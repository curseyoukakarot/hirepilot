# Lead Enrichment Engine — Full Support Documentation

lead-enrichment-engine.md

(Apollo → Hunter → Skrapp → Decodo → Enhanced Enrichment)

## Purpose of This File

This file teaches REX how to:

- Understand ALL enrichment providers in HirePilot  
- Explain the enrichment order  
- Troubleshoot missing emails  
- Distinguish between standard and enhanced enrichment  
- Know when leads should be enriched automatically  
- Diagnose failures vs empty results  
- Know when credit is charged (and when it is not)  
- Communicate expected behavior to users  
- Escalate complex situations  

---

# ⭐ Overview of HirePilot’s Enrichment Engine

HirePilot uses a layered enrichment pipeline in this exact order (short-circuiting when data is found):

1) Decodo (HTML signals; optional)  
2) Hunter.io (user API key; optional; before Apollo)  
3) Skrapp.io (user API key; optional; before Apollo)  
4) Apollo (HirePilot global provider; default fallback)  
5) Enhanced Enrichment (+1 credit; separate user-triggered step)  

---

# ⚙️ Provider Roles & Order

## 1) Decodo (Smart Unblocker / HTML signals) — Optional
Used for company intelligence and page-derived signals:
- Company metadata, keywords, headcount, funding, tech stack, revenue signals  
Notes:
- Not used for person email; does not require user API keys  
- May run as part of enhanced workflows or enrichment heuristics  

## 2) Hunter.io — Optional (User Key)
- Runs BEFORE Apollo when a valid Hunter API key is connected  
- Goal: find a verified email  
- HirePilot credits: charge 1 credit only if an email is found (Hunter’s own billing is separate)  

## 3) Skrapp.io — Optional (User Key)
- Runs BEFORE Apollo when a valid Skrapp API key is connected  
- Goal: find a personal/professional email  
- HirePilot credits: charge 1 credit only if an email is found (Skrapp billing is separate)  

## 4) Apollo — Default Fallback
- Always runs when Hunter/Skrapp are not present or return no email  
- Goal: find a verified email and basic person/company mapping  
- HirePilot credits: charge 1 credit only if Apollo finds an email  

## 5) Enhanced Enrichment (+1 credit; Separate)
- User-triggered upgrade (or automated in specific flows)  
- Returns deeper company intel:
  - Revenue, headcount trends, funding stage/amount, tech stack, industry keywords, competitors, SEO signals  
- Credits: +1 HirePilot credit only on successful retrieval of new enhanced data  

---

# 🤖 Automatic vs Manual Enrichment

## Automatic enrichment (standard) occurs when:
- A new lead is added (scraper/Sniper/import/manual)  
- A lead is scraped via Sales Navigator or Recruiter flows  
- A candidate is created from a lead (depending on org settings)  
- REX runs “Qualify Lead” workflows  

## Manual enrichment:
- User clicks “Enrich Lead”  
- User clicks “Enhanced Enrichment (+1 credit)”  
- Sniper job triggers post-scrape enrichment by user choice  
- REX triggers targeted qualification/enrichment steps on request  

---

# 💳 Credit Charging Rules (VERY IMPORTANT)

Credits are consumed ONLY when:
- Email is found (by Hunter, Skrapp, or Apollo) → 1 credit  
- Enhanced Enrichment returns new enhanced data → +1 credit  
- LinkedIn connection requests (automation) → 10 credits each  

Credits are NOT consumed when:
- No email is found by any provider  
- Enhanced Enrichment returns no new data  
- A manual or automatic enrichment attempt fails or returns empty  
- Viewing or editing enriched data  

Provider fees:
- Hunter/Skrapp: the user’s provider account may incur charges; HirePilot charges credits only if an email is found.  

---

# 🗺️ Data Mapping (What Goes Where)

## Person fields:
- Full name, title, email(s), phone (if available), LinkedIn URL, company, location, keywords  

## Company (enhanced) fields:
- Website, size/headcount, revenue estimate, funding info, industry, keywords, technologies, competitors, trends  

---

# 🔁 Exact Enrichment Logic (Pseudocode)

```text
if user.hasHunterKey:
  hunter = findEmailWithHunter(lead)
  if hunter.emailFound:
    charge(1)
    saveEmail(hunter.email)
    STOP

if user.hasSkrappKey:
  skrapp = findEmailWithSkrapp(lead)
  if skrapp.emailFound:
    charge(1)
    saveEmail(skrapp.email)
    STOP

apollo = findEmailWithApollo(lead)
if apollo.emailFound:
  charge(1)
  saveEmail(apollo.email)
  STOP

// no email found
charge(0)
```

Enhanced Enrichment (optional; separate):
```text
enhanced = fetchEnhancedCompanyData(lead.company)
if enhanced.hasAnyNewData:
  charge(+1)
  saveEnhanced(enhanced)
else:
  charge(0)
```

---

# ⚠️ Common Enrichment Problems & Fixes

## “Lead has no email”
Possible causes:
- Apollo/Hunter/Skrapp could not verify, privacy settings, job change, small company coverage gaps  
REX script:
> “Sometimes there’s no verified email available. We can adjust the company domain or try enhanced enrichment for more signals—want me to help?”

## “Incorrect company returned”
Causes: stealth startups, multiple experiences, domain mismatch  
Fix: update company field → re-run enrichment

## “Enrichment blank even after email found”
Explanation: provider returned email only (no additional metadata) or personal email not tied to company  

## “Enhanced enrichment failed”
Causes: new company, no public data, proxy returned empty HTML  
Fix: retry; consider SN scrape refresh; confirm domain; try again later

## “Why did enrichment cost 2 credits?”
Scenario: 1 credit for email + 1 credit for enhanced enrichment (user-triggered or automated)  

## “Why did enrichment not cost ANY credits?”
No email found; enhanced returned no new data; or provider failure—no charge  

---

# 🧭 Troubleshooting Flow (For Support Agent)

1) Clarify target: are we enriching a person email or company intel?  
2) Check enrichment logs (which provider ran; results; timestamps)  
3) Determine failure type: “no match”, “email not found”, “company data empty”, “proxy error”  
4) Identify provider:  
   - Hunter/Skrapp → user API keys/rate limits  
   - Apollo → global provider uptime/coverage  
   - Decodo → proxy/HTML retrieval issues  
5) Provide targeted fix:  
   - Update company domain & retry  
   - Try enhanced enrichment for deeper signals  
   - Re-run after SN refresh; ensure correct LinkedIn URL  
6) Escalate if global:  
   - Apollo outage; Decodo failures sustained; enhanced failing for all; batch enrichment stuck  

---

# 💬 REX Conversational Scripts

No results:
> “None of our providers had verified info—normal for some profiles. Want me to try enhanced enrichment or adjust the company domain first?”

Credits confusion:
> “We only charge credits when we successfully find an email or when enhanced company insights are returned. No email or no new insights means no charge.”

Enhanced prompt:
> “Enhanced enrichment can reveal revenue, funding, competitors and tech stack. Want me to run it (+1 credit only if we find something)?”

---

# 🚨 When REX Must Escalate

Escalate immediately when:
- Apollo enrichment failing 100% for multiple users  
- Hunter/Skrapp requests not firing (key valid)  
- Enhanced enrichment returning all blanks across workspaces  
- Decodo proxy errors > 3 minutes repeatedly  
- Batch enrichment stuck in queue  
- Lead drawer enrichment not running  
- Sniper → enrichment pipeline errors  

Ticket should include:
- Workspace ID, Lead ID, Provider used (Hunter/Skrapp/Apollo/Decodo), Error, LinkedIn URL, Company domain, Enrichment mode (standard/enhanced), Timestamp(s)

---

# 🔗 Related Files

- `sniper-actions.md`  
- `decodo.md`  
- `linkedin-scraping.md`  
- `browserless-and-linkedin-automation.md`  
- `candidate-management.md`  
- `email-delivery.md`

