# Job Requisitions (Job REQs) — Full Support Guide

job-requisites.md

(Job REQs, workflow, candidate flow, stages, submissions, team access, troubleshooting)

## Purpose of This File

This guide teaches REX how to:

- Explain what a Job REQ is  
- Help users create, edit, and manage job requisitions  
- Understand the full candidate lifecycle  
- Diagnose issues with Job REQs, stages, submissions, or visibility  
- Assist users who cannot see candidates, pipelines, or feedback  
- Identify permission issues vs. configuration issues  
- Trigger automation or support tickets when needed  

Job REQs are a core part of HirePilot. This file ensures REX supports them flawlessly.

---

# ⭐ What Is a Job REQ in HirePilot?

A Job REQ represents:

- A hiring project  
- A role the user is recruiting for  
- A pipeline where candidates move through stages  
- A collaboration space for internal team + external clients  
- A central place for submissions, notes, and evaluations  

Every Job REQ includes:

- Job title, Description, Salary range, Seniority, Company info  
- Recruiter(s) assigned, Client (if applicable), Opportunity (if linked)  
- Pipeline stages, Candidate list, Activity log  

Job REQs tie together:
- Candidates, Pipelines, Submissions, Guest collaboration  
- Deals & Opportunities, REX automations, Sniper sourcing flows  

---

# 🧱 Creating a Job REQ (Step-by-Step)

Create from:
- Job REQs page  
- Deals → Opportunities → Attach Job REQ  
- REX (Agent Mode)  

Required:
- Job title, Company, Recruiter assigned, Minimum pipeline details  

Optional (recommended):
- Description, Salary range, Location, Industry, Notes  

After creation:
- New pipeline generated with default stages  
- Candidate area activates, submissions enabled  
- Guest collaborators can be invited  

---

# 🧩 Job REQ Pipelines (Default Stages)

Five primary customizable recruiting stages:

1. **Sourced** — Candidate identified (LinkedIn/Sniper/Apollo/manual)  
2. **Contacted** — Outreach sent  
3. **Interviewed** — Phone screen/interview completed  
4. **Offered** — Offer extended  
5. **Hired** — Offer accepted; role filled  

Additional: **Rejected** (non-fit/withdrawn)  
Users can customize all stages except Hired and Rejected.

---

# 🔄 Candidate Lifecycle Inside a Job REQ

1) Candidate created/added (LinkedIn scraper, Extension, Apollo, CSV, manual, Deals)  
2) Candidate appears in REQ pipeline (drag between stages; REX/Sniper may auto-update/enrich)  
3) Candidate submitted to client (Recruiters/Admins submit; Guests give feedback)  
4) Candidate moves through stages (Interview → Offer → Hire; or Rejected)  
5) Candidate impacts reporting (source, time-to-fill, placement value, recruiter performance)  

---

# 📤 Submissions to Clients

Clients (Guests) can: Approve/Decline, leave notes, request more options  
Recruiters can: Customize submittal email, add notes, attach resumes/files, track responses  

Guests see only:
- Submitted candidates in their REQ, associated notes/comments, submission history  

Guests never see:
- Internal notes, compensation, other deals/clients, internal pipelines  

---

# 🔒 Job REQ Permissions (Very Important)

Super Admin — Full access  
Team Admin — Full access to all job reqs  
Member (Recruiter) — Access to assigned reqs; manage pipeline; submit candidates; no admin-only sections  
Guest Collaborator — View submitted candidates, leave notes, approve/decline; no internal tools/REX/Sniper  

---

# 🔗 Connecting Job REQs to Deals (Opportunities)

A Job REQ can:
- Attach to an Opportunity and be associated with a Client  
- Feed billing + revenue (placement tracking, invoice triggers)  

Support must know:
> A Job REQ can exist standalone or as part of a Deal/Opportunity.

---

# ⚙️ Automations Connected to Job REQs

Examples:
- “Interviewed” → notify recruiter  
- “Offered” → Slack alert  
- “Hired” → invoice event to Deals  
- “Rejected” → nurture email  
- New candidate → notify Team Admin  

REX should explain, help create, and escalate if automations fail.

---

# 🧭 Troubleshooting Job REQs

## ❌ User can't see a Job REQ
Causes: Wrong role, not assigned, workspace misconfig, UI bug  
Fix: Check role/assignment/team settings → refresh/clear cache → escalate if Admin missing visibility  

## ❌ Stages not updating
Causes: Sync delay, browser cache, automation conflict  
Fix: Refresh, drag again, notify support if persists  

## ❌ Cannot submit candidate to client
Causes: No client assigned, guest not configured, email blocked, missing fields  
Fix: Assign client, configure Guest, check email integration  

## ❌ Pipeline stages missing
Causes: Corrupted pipeline, migration duplication, rendering issue  
Fix: Recreate stages, escalate if widespread  

## ❌ Clients seeing wrong candidates
CRITICAL — escalate immediately.  
Include: Workspace ID, Job REQ ID, Candidate ID, expected vs actual visibility  

---

# 💬 REX Conversational Scripts

Explaining stages:
> “Each Job REQ has stages — Sourced, Contacted, Interviewed, Offered, and Hired. I can walk you through moving candidates along the pipeline.”

Assigning recruiters:
> “Open the Job REQ, go to Settings, and use the Recruiter assignment panel. Let’s add your recruiter now.”

Submissions:
> “Let’s submit this candidate to your client. I’ll guide you through the steps and confirm delivery.”

Visibility issues:
> “Your role only shows REQs you’re assigned to. Want me to show you how to add yourself to this REQ?”

---

# 🚨 When REX Must Escalate Job REQ Issues

- Job REQ/candidates disappear  
- Stages won’t move or break  
- Submissions not sending  
- Guests seeing incorrect data  
- Wrong permissions applied  
- Data corruption suspected  
- Pipeline not loading  
- Stage-based automations fail  
- Job REQ cannot save  

Escalation payload:
- Workspace ID, Job REQ ID, User ID, stage structure, attempted action, error message, screenshot if possible  

---

# 🔗 Related Files

- `pipelines.md`  
- `workspace-roles-and-permissions.md`  
- `deals.md`  
- `candidates.md`  
- `submissions-and-feedback.md`  
- `sniper-actions.md`  
- `errors-and-troubleshooting.md`

