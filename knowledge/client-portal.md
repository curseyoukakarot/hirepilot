# Client Portal — Full Support Documentation  

client-portal.md

(Client access, collaborator permissions, submissions, feedback, troubleshooting)

### For REX (Support Agent)

---

## Purpose of This File

This file teaches REX how to:

- Understand how the Client Portal works  
- Explain client permissions  
- Diagnose access issues  
- Troubleshoot collaborator problems  
- Walk users through sending submissions and collecting feedback  
- Understand how clients interact with Job REQs, Candidates, and Submissions  
- Escalate client-facing errors  

The Client Portal is one of the most important customer-facing features in HirePilot.

---

# ⭐ What Is the Client Portal?

The Client Portal is a secure, read-only workspace where clients can:

### ✔ View candidates submitted to them  
### ✔ Approve or reject candidates  
### ✔ Request interviews  
### ✔ Leave comments  
### ✔ Review job details (optional)  
### ✔ Collaborate with recruiters in real time  

Clients cannot edit, create, or modify any internal data — the portal is strictly an evaluation interface.

---

# 🧠 How a Client Becomes a Collaborator

A client becomes a collaborator when:

- Recruiter adds them under the Job REQ → “Collaborators”  
- Recruiter sends a Submission email (auto-invites them)  
- Recruiter shares a direct portal link  
- Admin adds a Guest Collaborator to the workspace  

Each collaborator receives a unique access token stored in:

- Their magic-link login  
- Browser session  
- Workspace identity  

No passwords required.

---

# 🔐 Client Permissions Matrix

### ✔ Can Do:

- View assigned Job REQs  
- View submitted candidates  
- Approve or reject candidates  
- Leave comments  
- Request interviews  
- View candidate resumes  
- View attachments  
- See activity related to their job  
- Receive submission emails  

### ❌ Cannot Do:

- Edit candidate details  
- Add or remove candidates  
- Modify the Job REQ  
- Change pipeline stages  
- Invite new collaborators  
- Access other Job REQs  
- See internal recruiter notes  
- View private notes or REX notes  
- See enrichment data (email/phone)  
- Download internal attachments unless marked "public"

This is one of the most important distinctions for support to understand.

---

# 🗂 What Clients Actually See Inside the Portal

## 1. Job Overview
- Job title  
- Description (optional)  
- Requirements  
- Basic details  

## 2. Submitted Candidates
Each candidate shows:
- Summary card, title, current company, key skills  
- Resume preview, submission message, attachments  

## 3. Feedback Interface
Client can choose: Approve, Reject, Request interview, Add comments

## 4. Activity Feed
Shows submission received, client-visible recruiter comments, interview requests, visible status changes

## 5. Submission Thread View
Side-panel with recruiter submission, client responses, and decision timeline

---

# 📤 Submissions Flow (Recruiter → Client)

When recruiter submits a candidate:

1) SendGrid sends a formatted submission email  
2) Client clicks “View Candidate”  
3) Auto-login via magic link  
4) Portal loads submission  
5) Job REQ and Candidate are shown  
6) Client chooses: Approve / Reject / Request interview / Comment  

After client action:
- Recruiter notified  
- Candidate pipeline updates  
- Job REQ logs activity  
- Deals pipeline may update (if connected)  
- Automation rules may fire  

---

# 🧭 Common Support Issues & Fixes

## “Client cannot access portal”
Causes: wrong email, expired magic link, cookies disabled, incognito, collaborator missing  
Fix:
> “Let’s resend the portal access link and ensure you're added as a collaborator on the Job REQ.”

## “Client sees ‘No Candidates Available’”
Causes: not submitted, wrong job, withdrawn, filters  
Fix:
> “Let’s confirm this candidate was actually submitted to this Job REQ.”

## “Client sees wrong/outdated resume”
Causes: candidate updated without resending, cached file, attachment not replaced  
Fix: resend submission with updated attachment; refresh portal

## “Buttons not working (Approve/Reject/etc.)”
Causes: network error, portal cache, outdated link, invalid session  
Fix: refresh/resend link; try another browser; escalate if affecting multiple clients

## “Client can't download attachment”
Causes: permission mis-set, large file, corrupted upload  
Fix: re-upload; mark public for client-facing docs

## “Client not receiving submission emails”
Causes: spam/firewall, wrong email, SendGrid delay  
Fix: check spam, resend, confirm email address

---

# 🧭 REX Troubleshooting Flow

1) Identify role (recruiter vs client)  
2) Identify issue (access, submission, feedback, attachments, job, permissions)  
3) Guide exact UI steps to resolve  
4) Check backend (collaborators, job logs, submission logs, attachment metadata)  
5) Escalate if system-wide (portal downtime, magic-link failures)  

---

# 💬 REX Conversational Scripts

Access issues:
> “No problem — tokens can expire. I’ll help you send a fresh access link.”

Portal intro:
> “This is your private workspace to review submitted candidates. Want a quick tour?”

Roles clarity:
> “Collaborators can approve/reject or comment, but can’t edit candidate profiles.”

Submission visibility:
> “Let’s confirm the candidate was submitted to this specific Job REQ. I can help you resend the submission.”

---

# 🚨 When REX Must Escalate

Escalate immediately if:
- All clients cannot access the portal  
- Magic link system failing  
- Submissions failing globally  
- Feedback buttons unresponsive across clients  
- Attachments not loading portal-wide  
- Activity feed blank system-wide  
- Portal returning 500 errors  
- Jobs not loading in portal view  

Ticket must include:
- Workspace ID, Job REQ ID, Candidate ID (if relevant), Client email, Portal URL, error message, browser/system details

---

# 🔗 Related Files  

- `submissions-and-feedback.md`  
- `job-reqs.md`  
- `candidates-and-drawer.md`  
- `automation-engine.md`  
- `email-delivery.md`

