# Candidate Management — Full Support Guide

candidate-management.md

(Candidate creation, enrichment, merging, submissions, troubleshooting)

## Purpose of This File

This file teaches REX how to:

- Understand how candidates enter HirePilot  
- Explain how candidates attach to Job REQs  
- Identify duplicates  
- Understand enrichment paths  
- Explain submissions & feedback  
- Diagnose candidate visibility issues  
- Fix missing data  
- Understand REX/automation interactions  
- Escalate major data integrity issues  

Candidates represent the **core output** of recruiting workflows, so support accuracy here is critical.

---

# ⭐ Where Candidates Come From

Candidates enter HirePilot through 6 main sources:

### ✔ 1. LinkedIn — Chrome Extension
- Single profile scraping  
- Bulk list scraping  
- Recruiter scraping (if user has Recruiter)  
- Auto-attaches HTML + parsed data

### ✔ 2. Sales Navigator Scraper (Sniper)
- Bulk scraping  
- Adds dozens–hundreds of candidates  
- Enriched with parsed HTML  
- Sends to pipeline if REQ selected

### ✔ 3. Apollo Integration
- Users import leads as candidates  
- Auto-populates work history, title, company

### ✔ 4. CSV Import
- Users upload external spreadsheets  
- Mapped into candidate fields

### ✔ 5. Manual Entry
- Hand-entered by Admin or Recruiter  
- Typically used for referrals

### ✔ 6. Submissions from Deals or Clients
- When converting contacts into candidates

Once added, candidates become part of:
- The database, Search, Job pipelines, Submissions, Analytics

---

# 🔄 Candidate Profile Structure

Each candidate includes:

### Primary Fields
- Full name, Email(s), Phone, Location, Title, Company, LinkedIn URL, Source

### Enrichment Fields
- Work history, Experience bullet points, Skills, LinkedIn bio, Education, Keywords, Tech stack (if parsed)

### HirePilot Metadata
- Created by, Source type (Scraper / Apollo / CSV / Manual)  
- Assigned job REQ, Assigned recruiter, Pipeline stage  
- Submission history, Notes, Files

---

# 🧩 Candidate Enrichment Logic

HirePilot uses a **multi-layer enrichment chain**, depending on what's available.

Order of enrichment:
1. Decodo HTML parsing  
2. Browserless DOM extraction  
3. Apollo enrichment  
4. Hunter.io / Skrapp (if user keys added)  
5. Manual recruiter edits  

REX must know:
- Enrichment is automatic  
- Users can enhance/override data  
- Email enrichment uses credits  
- Enhanced enrichment may be credit-gated (if configured)  

---

# 🔗 How Candidates Attach to Job REQs

Happens in three ways:

### ✔ Automatically
- Extension: choose a Job REQ  
- Sniper: bulk scrape → auto-assign  
- REX: autosearch → assign by instruction

### ✔ From candidate profile
Recruiter clicks: “Add to Job REQ”

### ✔ From Job REQ pipeline
Recruiter: “Add candidate manually” or “Search & attach from database”

Candidates can appear in multiple REQs.

---

# 📤 Candidate Submissions to Clients

Recruiters submit candidates for review.

Submission includes:
- Candidate profile, Short pitch, Notes, Resume, Attachments, Status (submitted → viewed → approved/rejected)

Guest Collaborators can:
- Approve, Reject, Comment, Request more candidates

Every submission is logged.

---

# 🔁 Duplicate Candidate Logic

Detected by:
- Email match, LinkedIn URL match, Name+company (fallback)

When detected:
- Auto-merge OR prompt manual merge

Merged profiles retain:
- Notes, Files, REQs, Submissions, Enrichment, Pipeline history

If merge logic fails:
> REX must escalate.

---

# 🛠 Troubleshooting Candidate Issues

## ❌ Candidate not showing in Job REQ
Causes: Wrong REQ, wrong recruiter role, active filter, different REQ  
Fix: Clear filters → Check assignment → Confirm permissions

## ❌ Candidate missing enrichment
Causes: Incomplete HTML, Decodo blocked, Browserless blank  
Fix: Re-scrape → Refresh cookies → Reduce throttles

## ❌ Candidate pipeline stage won’t move
Causes: UI rendering issue, invalid stage state  
Fix: Refresh → Drag again → Escalate if persistent

## ❌ Candidate appears twice
Causes: CSV + scraper, Apollo + scraper  
Fix: Use “Merge Candidates” → Escalate if blocked

## ❌ Guest sees candidates they shouldn’t
CRITICAL  
Fix: Remove from REQ → Recheck permissions → Escalate immediately

## ❌ Candidate cannot be submitted
Causes: Client not assigned, email integration missing, missing resume  
Fix: Assign client → Re-auth email → Attach resume

## ❌ Candidate created but not visible anywhere
Causes: RLS issue, DB write failure, sync failure  
Fix: Escalate immediately

---

# 💬 REX Conversational Scripts

Explaining candidates:
> “Candidates represent the people you’re recruiting. HirePilot automatically enriches them with LinkedIn data when possible.”

Candidate missing:
> “Let’s check the Job REQ assignment and whether any filters are hiding them.”

Duplicates:
> “You may be seeing a duplicate because they were both imported and scraped. Let’s merge them to keep a clean profile.”

Submissions:
> “Open the candidate and click ‘Submit to Client.’ I’ll walk you through the steps.”

---

# 🚨 When REX Must Escalate

Escalate if:
- Candidate disappears  
- Duplicate detection broken  
- Merges corrupt data  
- Submissions failing system-wide  
- HTML parsing broken / LinkedIn DOM changed  
- Candidate history missing  
- Pipeline corrupted  
- RLS hiding candidates unexpectedly  

Include:
- Workspace ID, Candidate ID, Job REQ ID, Source (Scraper/Apollo/CSV/Manual), Expected vs actual, Errors, Screenshots

---

# 🔗 Related Files

- `job-requisites.md`  
- `pipelines.md`  
- `remote-session.md`  
- `browserless.md`  
- `decodo.md`  
- `linkedin-scraping.md`  
- `apollo-integration.md`


