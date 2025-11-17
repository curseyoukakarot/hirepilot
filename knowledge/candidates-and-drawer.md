# Candidate Management & Drawer — Full Support Documentation

candidates-and-drawer.md

### For REX (Support Agent)

---

## Purpose of This File

This file teaches REX how to:

- Understand candidate creation and data flow  
- Explain how candidate profiles are structured  
- Guide users through the Candidate Drawer  
- Troubleshoot submission issues  
- Handle resume parsing problems  
- Interpret stage changes  
- Diagnose missing data or activity  
- Understand collaborator permissions  
- Trigger follow-ups, feedback, or nurture flows  
- Escalate system-level candidate failures  

This file covers the ENTIRE CANDIDATE SYSTEM.

---

# ⭐ What a “Candidate” Is in HirePilot

A candidate is a person being evaluated for a Job REQ. Candidates are created by:
- Converting a Lead → Candidate  
- Manual candidate entry  
- Sniper → Convert to Candidate  
- Public apply form  
- REX qualification logic  
- CSV/API import  
- Chrome extension (Save as Candidate)  

---

# 🧠 How Candidate Data Is Structured

Each Candidate includes:

### Personal Data
- Full name, title, location, summary (“About”)  
- Resume data (parsed sections), skills  
- LinkedIn URL, contact info (email, phone)

### Professional Data
- Current company  
- Employment history, education history  
- Keywords, seniority, tech stack, industry

### Application Data
- Job REQ(s) attached  
- Pipeline stage per REQ  
- Recruiter notes, client feedback  
- Submission history, interview/offer logs  

---

# 🗂 Candidate Drawer (The Core UI)

The Drawer presents an all-in-one profile:

1) Overview  
- Summary, title, company, contact info, links, tags, insights

2) Resume  
- Parsed resume, original PDF, keyword highlights, sections (Experience/Education/Skills)

3) Activity  
- Stage changes, recruiter notes, client feedback, REX logs, submission events, messages

4) Notes  
- Public notes (team + collaborators)  
- Private notes (team only)  
- Voice notes (if enabled)

5) Submissions  
- History, approvals/rejections, comments, internal discussion

6) Attachments  
- Resume, portfolio, case studies, screenshots, cover letters

7) REX Actions  
- Summarize, compare to REQ, score, rewrite submission, trigger follow-ups

---

# 📥 Candidate Creation Flow

## From a Lead
1) Click “Convert to Candidate”  
2) Lead fields mapped into Candidate schema  
3) Assign: Job REQ + initial stage  
4) Enrichment carries over

## From a Resume Upload
- Parser builds structured profile → Experience/Education/Skills/Keywords

## From Sniper Scrape
- Scraped profile → Candidate mapping + optional enrichment

## From Public Form
- Candidate created/assigned to Job REQ; recruiter notified

---

# 📤 Candidate Submissions (Users → Clients)

Submit candidates via:
- Candidate Drawer  
- Job REQ screen  
- Bulk submission  
- REX recommendation  

Submission emails (SendGrid) include:
- Candidate summary, resume, portfolio link, recruiter notes, job details

---

# 🔁 Client Feedback Workflow

Client actions:
- Approve / Reject / Request Interview / Comment

System updates:
- Status & notes logged  
- Recruiter notifications sent  
- Stage updates automatically (if automations enabled)

---

# 🧠 Candidate Pipeline Integration

Default stages:
- Sourced → Contacted → Interviewed → Offered → Hired → Rejected

When stages change:
- Activity logged; automations may fire  
- REX assistance; Slack/email alerts; Deals/Billing may update

---

# 👀 Collaborator Access & Permissions

Team Admin & Recruiters:
- View/edit, add notes, submit, move stages

Guest Collaborators:
- See submissions; approve/reject; leave feedback; request interviews  
- Cannot edit candidate data or move stages  
- Cannot view private notes

Cross-workspace:  
- Candidates are visible only within the current workspace context; sharing outside the workspace is disallowed unless exported

---

# 🔗 Enrichment & REX Inside the Drawer

Enrichment:
- Standard (email discovery) & Enhanced (company intel) show inside profile  
- REX can trigger enrichment, summarize fit, and propose outreach

REX actions:
- Score candidate vs REQ; draft updates; trigger next steps; propose nurture or follow-up

---

# ⚠️ Common Candidate Support Issues & Fixes

## “Candidate isn’t showing in the drawer”
Causes: Filters, wrong workspace, not tied to Job REQ, assignment removed  
Fix: Clear filters; confirm REQ assignment; verify workspace; reassign recruiter

## “Resume didn’t parse”
Causes: Image-only PDF, encrypted PDF, malformed layout  
Fix: Upload text-based PDF; re-run parser; manual field entry as fallback

## “Submission email didn’t send”
Causes: Recipient invalid, SendGrid bounce, large attachment, submission template error  
Fix: Retry; verify recipient; reduce attachment size; check `email-delivery.md`

## “Client cannot open link”
Causes: Wrong collaborator role, permissions, expired link  
Fix: Recreate link; correctly assign Guest; test in incognito

## “Stage didn’t update”
Causes: Automation failure, slow network, multiple tabs  
Fix: Retry; verify automation logs; report if repeated

## “Wrong title/company”
Causes: Outdated scrape/resume; job change  
Fix: Manual edit; re-run enrichment; refresh scraped data

## “Activity missing”
Causes: Log sync delay; UI filter; audit retention window  
Fix: Hard refresh; clear filters; confirm logs

---

# 🧭 REX Troubleshooting Flow

1) Clarify intent (submit, stage move, find candidate, parse résumé, add Guest)  
2) Identify failure scope (local vs system)  
3) Provide exact UI steps to resolve  
4) Verify backend logs (activity/submission/stage)  
5) Escalate if abnormal (system-wide or data-loss risk)

---

# 💬 REX Conversational Examples

Resume parse:
> “This résumé looks image-based; if you upload a text-based PDF, I’ll reparse it now.”

Client visibility:
> “Let’s add the client as a Guest Collaborator to the REQ—then they’ll see the submitted candidates.”

Submission guidance:
> “From the Drawer, click Submit to Client, select the REQ + Guest, and I’ll help you add a succinct pitch.”

Pipeline:
> “The stage didn’t update; let’s try once more and I’ll confirm the pipeline logs. If it persists, I’ll log a ticket.”

---

# 🚨 When REX Must Escalate

Escalate immediately when:
- Candidate creation fails across users  
- Resume parser down  
- Activity logs empty system-wide  
- Submissions queue failing  
- Client portal not loading  
- Permissions breached (Guests seeing internal data)  
- Notes not saving / attachments failing  
- Pipeline updates not registering  
- Drawer loads blank  

Ticket payload:
- Candidate ID, Job REQ ID, Workspace ID, User ID, error text, attempted action, stage before/after, timestamp

---

# 🔗 Related Files

- `candidate-management.md`  
- `job-requisites.md`  
- `pipelines.md`  
- `submissions-and-feedback.md`  
- `client-collaboration.md`  
- `email-delivery.md`  
- `errors-and-troubleshooting.md`

