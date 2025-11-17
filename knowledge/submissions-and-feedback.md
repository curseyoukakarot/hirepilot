# Submissions & Feedback — Full Support Documentation  

submissions-and-feedback.md

(Submission emails, client actions, stage updates, threading, troubleshooting)

### For REX (Support Agent)

---

## Purpose of This File

This file teaches REX how to:

- Explain how submissions work  
- Walk users through sending submissions  
- Diagnose issues with submission emails  
- Troubleshoot client feedback actions  
- Understand how approvals & rejections update pipelines  
- Handle interview requests  
- Fix submission-view issues in the Client Portal  
- Identify when to escalate system-wide problems  

Submissions are the backbone of client communication in HirePilot.

---

# ⭐ What Is a “Submission”?

A Submission is a formatted candidate packet sent to the client.  

It includes:

- Candidate summary  
- Resume  
- Key skills  
- Recruiter notes  
- Attachments  
- Role context  

Submissions go through SendGrid, NOT Gmail/Outlook.

When the client clicks “View Candidate,” they are taken into the Client Portal.

---

# 🧠 Submission Flow (Step-by-Step)

### Step 1 — Recruiter selects a candidate  
From:
- Candidate Drawer  
- Job REQ screen  
- Bulk submission mode  
- REX suggestion modal  

### Step 2 — Submission composer opens  
Recruiter chooses:
- Which job  
- Which attachments  
- Submission summary text  
- Any additional notes  

### Step 3 — SendGrid sends submission email  
Email includes:
- Personalized preview  
- “View Candidate” button  
- Portal access link  
- Recruiter info  

### Step 4 — Client opens portal  
Auto-login via magic link.

### Step 5 — Client views candidate and takes action  
Options:
1. Approve  
2. Reject  
3. Request Interview  
4. Comment  

### Step 6 — HirePilot updates everything automatically  
- Candidate pipeline  
- Job REQ activity log  
- Recruiter notifications  
- Slack alerts  
- Deal progression (if linked)  

---

# 💌 What Does the Client Actually See?

### Client Portal Submission View
Shows:
- Candidate card  
- Summary  
- Resume viewer  
- Attachments viewer  
- Recruiter notes  
- Timeline of submission  
- Feedback buttons  

Clients DO NOT see:
- Internal notes  
- Candidate email/phone  
- Private attachments  
- Previous submissions (unless allowed)  

---

# 🔁 Resubmissions

Recruiter can resend:
- Updated resume  
- Updated notes  
- Clarifications  
- Multiple submissions per candidate  

Portal shows a submission history thread.

---

# 🧭 Client Feedback Logic (The Backbone)

This is CRITICAL. Support MUST understand this perfectly.

## Approve
- Candidate stage auto-moves → Interviewed OR custom “Approved” stage  
- Recruiter notified  
- Activity logged  
- Deal updated (if workflow defines it)  

## Reject
- Candidate stage auto-moves → Rejected  
- Recruiter notified  
- Activity logged  
- Rejection reason saved  

## Request Interview
- Candidate stage → Interview Requested (or Interviewed per pipeline)  
- Recruiter notified  
- Activity logged  
- Optional automation may schedule interview  

## Comment
- Visible in Candidate Drawer (client-visible notes), Job REQ comments, Notifications  

---

# 🔔 Notifications Triggered by Submissions & Feedback

Triggered for recruiters:
- Email, Slack, in-app

Triggered for clients:
- Confirmation for interview request (optional), submission received

Triggered for REX:
- Stage updates may trigger automations; approvals can run next-step logic

---

# 📎 Attachments Handling

Candidate artifacts can include:
- Resume, PDFs, portfolio links, screenshots, case studies  

Submission automatically attaches:
- Resume (PDF) + public recruiter files  

Private/internal files are NOT sent to clients.

---

# ⚠️ Common Submission Issues & Fixes

## “Client didn’t receive submission email”
Causes: spam, wrong email, corporate firewall, SendGrid delay/outage, old link  
Fix: resend; verify email; ask to check spam; escalate if SendGrid global issue

## “Submission link expired”
Magic link window elapsed.  
Fix:
> “No problem — let’s resend the link. It’ll refresh your access immediately.”

## “Client sees blank page”
Causes: invalid token, wrong job/candidate link, permissions mismatch  
Fix: regenerate portal link; re-add collaborator

## “Attachments missing”
Causes: marked private, too large, incomplete upload  
Fix: re-upload; mark public; confirm size limits

## “Feedback buttons not working”
Causes: browser errors, invalid session, API 4xx/5xx  
Fix: refresh; new link; alternate browser; escalate if widespread

## “Stage didn’t update after approval”
Causes: automation conflict, backend error, misconfigured stage mapping  
Fix:
> “Let’s retry the stage update manually, and I’ll check pipeline logs.”

## “Submission email formatting wrong”
Causes: cached template, SendGrid template issue  
Fix: re-upload/refresh template

---

# 🧭 REX Troubleshooting Flow

1) Identify user role (recruiter vs client)  
2) Identify submission stage (email sent? portal loaded? feedback given?)  
3) Determine issue type (email, portal, feedback, pipeline, attachments)  
4) Diagnose via questions: latest email link? assigned to this Job REQ? candidate visible in portal?  
5) Walk exact solution steps  
6) Escalate if systemic (portals or submissions failing)  

---

# 💬 REX Conversational Examples

How submissions work:
> “Submissions send a formatted candidate profile to your client. After they open the portal link, they can approve, reject, or request an interview. Want me to walk you through sending one?”

Email didn’t arrive:
> “Totally normal — some corporate filters block these. I’ll help you resend and verify the email.”

Client confused:
> “This portal is your private review space. You can approve, reject, request interviews, or leave comments here.”

Approval didn’t update:
> “The stage didn’t update. Let’s try again and I’ll check the automation logs.”

---

# 🚨 When REX MUST Escalate

Escalate immediately if:
- Submissions fail for all users  
- SendGrid outage detected  
- Feedback API returns 500  
- Stage not updating globally  
- Portal not loading  
- Attachments not rendering portal-wide  
- Approvals not triggering logic  
- Email links incorrect  

Ticket must include:
- Workspace ID  
- Candidate ID  
- Job REQ ID  
- Submission email (to)  
- Error message  
- Portal URL  
- Attachments (if relevant)  
- Logs if provided  

---

# 🔗 Related Files  

- `client-portal.md`  
- `job-reqs.md`  
- `candidates-and-drawer.md`  
- `email-delivery.md`  
- `automation-engine.md`
# Submissions & Client Feedback — Full Support Guide

submissions-and-feedback.md

(Candidate submissions, client feedback loops, visibility, notifications, troubleshooting)

## Purpose of This File

This guide trains REX to:

- Explain how candidate submissions work  
- Help recruiters submit candidates correctly  
- Understand what clients (Guests) see  
- Diagnose visibility issues  
- Explain submission statuses  
- Guide recruiters through feedback loops  
- Troubleshoot email issues, missing links, or failed submissions  
- Escalate critical visibility bugs  

Submissions = the point of delivery for recruiting.  
This file ensures REX handles it flawlessly.

---

# ⭐ What Are Submissions?

A submission is when a recruiter sends a candidate to a client (Guest Collaborator) for review.

Every submission includes:
- Candidate profile  
- Summary pitch or notes  
- Resume & attachments  
- Submission status  
- Client feedback (approve/reject/comments)  
- Timeline history  

Clients interact with submissions through a simplified portal view.

Submissions are tied to:
- Job REQ, Pipeline stage, Client account, Recruiter activity

---

# 🧱 How to Submit a Candidate (Step-by-Step)

1) Recruiter opens candidate profile (from Candidates or Job REQ pipeline)  
2) Clicks **“Submit to Client”** (opens submission modal)  
3) Selects: Client/Guest, Job REQ, Message/Summary, Attachments (optional)  
4) System sends: Email to client, in-app update for Guest, creates submission record  
5) Submission appears in: Job REQ → Submissions tab, Candidate profile, Client portal  

---

# 🧩 Submission Statuses

1. **Submitted** — Sent; client not opened yet  
2. **Viewed** — Client opened submission  
3. **Approved** — Client wants to proceed  
4. **Rejected** — Client declines candidate  
5. **Needs More Info** — Client commented or asked a question  
6. **Resubmitted** — Recruiter updated and resent  

Statuses drive recruiter next actions.

---

# 👥 What Clients (Guests) Can See

Guests ONLY see:
- Candidates submitted for their Job REQs  
- Candidate profile summary, resume, recruiter notes  
- Feedback options and comments

Guests CANNOT see:
- Internal recruiter notes  
- Other candidates/workspace data  
- Internal pipelines or deals  
- Other clients or job reqs  
- REX or Sniper tools  

If a Guest ever sees more than they should → escalate immediately.

---

# 🛠 Troubleshooting Submission Issues

## ❌ Client did not receive submission email
Possible: Spam, typo, Guest not added, email integration down  
Fix: Confirm email → check spam → resend → verify Gmail/Outlook → escalate SendGrid outage

## ❌ Client cannot open submission link
Possible: Link expired, wrong account, cookie issue  
Fix: Send fresh link → incognito → clear cookies

## ❌ Client cannot see the candidate
Possible: Wrong REQ, not actually submitted, Guest not assigned, RLS rule  
Fix: Assign Guest to REQ → confirm submission exists → escalate if still hidden

## ❌ Recruiter cannot submit candidate
Possible: No client on REQ, missing resume (workflow), email not connected, missing fields  
Fix: Assign client → add resume → re-auth email → complete required fields

## ❌ Submission stuck / status not updating
Possible: Client portal cache, DB sync delay, UI rendering  
Fix: Refresh/Hard reload → escalate if persistent

## ❌ Submissions not sending system‑wide
Causes: SendGrid queue down, backend mailer error, DB failure, template error  
REX: Create ticket → alert Super Admin → apologize → start support thread

---

# 🔁 Feedback Loop Logic

Client actions (approve/reject/comment) trigger:
- Recruiter notifications  
- Candidate + Job REQ updates  
- Optional pipeline movement via automation  
- Activity log entries  

REX guides next steps based on feedback.

---

# 💬 REX Conversational Scripts

Explaining submissions:
> “Submitting a candidate sends their profile, resume, and your notes directly to your client. They can approve, reject, or comment.”

Email not received:
> “No problem — let’s resend the submission and double‑check the client’s email address.”

Guest lacks access:
> “Guests only see candidates submitted for their specific Job REQs. Let’s confirm this candidate was submitted to the right REQ and that the Guest is assigned.”

Client approved:
> “Great! Let’s move this candidate to Interviewed or Offered based on your next step.”

---

# 🚨 When REX Must Escalate Immediately

Escalate if:
- Client sees wrong candidates  
- Submissions disappear  
- Submissions fail system‑wide  
- Guest permissions break  
- Submission emails not generated  
- Candidate data not loading in portal  
- Submission status not updating  
- RLS rules appear broken  

Include in ticket:
- Workspace ID, Job REQ ID, Candidate ID, Guest user ID, Submission ID  
- Expected vs seen, error text, screenshot if available  

---

# 🔗 Related Files

- `candidate-management.md`  
- `job-requisites.md`  
- `workspace-roles-and-permissions.md`  
- `team-management.md`  
- `gmail-outlook-integration.md`  
- `sendgrid-events.md`  
- `errors-and-troubleshooting.md`

