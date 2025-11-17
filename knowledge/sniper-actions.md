# Sniper Background Actions — Full Support Documentation

sniper-actions.md

## Purpose of This File

This file teaches REX how to:
- Understand Sniper (HirePilot’s background job engine)  
- Explain Sales Navigator scraping, Bulk scraping, Recruiter scraping  
- Detect rate limits, failures, and session issues  
- Guide users when Sniper returns partial or zero results  
- Help users prepare clean searches before scraping  
- Provide step-by-step advice to reduce errors  
- Escalate job failures correctly  

---

# ⭐ What Is Sniper?

Sniper is HirePilot’s high-speed background scraping and enrichment engine used to:
- Pull lead lists from Sales Navigator  
- Scrape multiple profiles (bulk or single)  
- Enrich scraped leads  
- Convert to Leads/Candidates  
- Feed campaigns and pipelines  
- Hand off to REX for qualification/enrichment  

Dependencies: Browserless, Decodo, Chrome Extension (for session), deduplication, rate-limit & warm-up logic.

---

# 🧠 Sniper Workflow Overview

1) User selects a Sniper action  
   - SN search results, saved SN list, Recruiter project (optional), single profile, bulk profiles  
2) Job submitted to backend  
   - Includes session ID/cookies, search URL, max count, user + workspace IDs  
3) Backend validates  
   - Fresh cookies/session? daily/weekly limits? warm-up OK? → else abort  
4) Browserless executes  
   - Open page, scroll/paginate, extract HTML, parse DOM, simulate human behavior  
5) Backend parses results  
   - Deduplicate, map to Lead/Candidate fields, optional enrichment, store results  
6) Final delivery  
   - Sniper Results list; Leads table; Candidate drawer (if auto-convert); optional REX workflow queue

---

# 📦 What Sniper Scrapes From Sales Navigator

Data points:
- Name, title, company, location, about  
- Experience and education history  
- Skills/highlights/industry  
- Profile URL + search metadata  

Not scraped by default: email/phone (handled by enrichment providers).

---

# 🔍 Enrichment Integration

After scraping, Sniper can trigger:
- Auto-Enrichment (Apollo/Decodo/Hunter/Skrapp where keys are present)  
- Enhanced Enrichment (+1 credit) when configured  
- REX qualification and nurturing  
- Campaign binding when specified

---

# 🎛 Job Status States

- Queued → waiting for Browserless  
- Running → script in flight  
- Completed → results saved  
- Partial Success → some profiles processed; causes: rate limits/timeouts/UI drift  
- Failed → aborted (invalid session/Browserless error/timeouts/429 storm/UI change)  
- Rate Limited → LinkedIn throttled activity; wait 12–24h and resume

---

# ⚠️ Why Sniper Returns Zero Results (Top Causes)

1) Empty or invalid Sales Navigator search  
2) LinkedIn not loading; cookies expired; logged out  
3) “See more results” gating; page not fully scrolled  
4) UI change; rate limiting; Recruiter license missing; wrong URL  

REX script:
> “Let’s verify you’re on a valid Sales Navigator search/list page and refresh your LinkedIn session if needed.”

---

# 🚦 Safety Rules (Warm-Up & Limits)

Sniper enforces:
- Max ~40–60 actions/day; weekly caps; randomized delays  
- Cursor/viewport/scroll simulation; skip on blocked profiles  
- Auto-pause on limits → job marked “Rate Limited”  

REX script:
> “LinkedIn rate-limited activity. Let’s pause 12–24 hours and resume safely with smaller batches.”

---

# 🧰 Troubleshooting (Support Flow)

## “No profiles found”
Causes: wrong URL, invalid SN page, expired cookies, page not fully loaded  
Fix: Open SN search manually → scroll to bottom → refresh cookies → retry  

## “Job stuck at queued”
Causes: heavy load; too many concurrent jobs; Browserless backlog  
Fix: Retry later; if multi-user → escalate  

## “Partial results”
Causes: blocks, slow loads, timeouts  
Fix: Check limits; rerun with smaller max; ensure fresh session  

## “Failed – Invalid session”
Fix: Recapture cookies via extension; ensure LinkedIn logged in  

## “Cannot parse HTML”
Causes: LinkedIn UI drift or incomplete HTML  
Fix: Retry; escalate to engineering if repeated

---

# 💬 REX Scripts

Wrong page:
> “This isn’t a valid SN search/list. I’ll help you navigate to the right view.”

Rate-limited:
> “LinkedIn slowed automation. Let’s pause 12–24h and resume with lighter pacing.”

Session expired:
> “Your LinkedIn session expired — please recapture cookies via the HirePilot extension.”

Incomplete results:
> “We got a portion of the list. Let’s rerun with a smaller batch to avoid throttling.”

---

# 🚨 When to Escalate

Escalate if:
- System-wide Sniper failures  
- Browserless 5xx across users  
- Decodo proxy down  
- Major LinkedIn UI change  
- Recruiter scrape not loading for many  
- Jobs stuck queued >10 minutes consistently  
- Script errors recurring across users  

Ticket must include:
- Sniper Job ID, Workspace ID, User ID  
- Session timestamp, scraped URL, job logs  
- Recruiter license usage, response/error samples  
- Current throttles and batch size  

---

# 👤 Related Files

- `browserless-and-linkedin-automation.md`  
- `decodo.md`  
- `chrome-extension.md`  
- `linkedin-scraping.md`  
- `sniper-settings.md`  
- `browserless.md`  
- `errors-and-troubleshooting.md`


