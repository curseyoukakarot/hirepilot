# Client Collaboration — Full Support Guide

client-collaboration.md

(Guest Collaborators, client portals, submissions, visibility, troubleshooting)

## Purpose of This File

This document teaches REX how to:

- Understand the client-facing experience in HirePilot  
- Explain Guest Collaborator access  
- Troubleshoot client login issues  
- Help clients view candidates  
- Understand visibility permissions  
- Diagnose incorrect client access  
- Explain feedback and approvals  
- Help recruiters onboard clients smoothly  
- Escalate critical client visibility bugs  

Clients interact with HirePilot differently than recruiters — this file ensures the Support Agent understands every part of the client journey.

---

# ⭐ What Is a Guest Collaborator?

A Guest Collaborator is a client, hiring manager, or external partner invited to review candidates.

They are intentionally given:
- Simplified interface  
- Limited access  
- Read + feedback-only abilities  
- Submission-focused views  

They are NOT meant to see or manage:
- Pipelines, all candidates, or internal notes  
- Deals/Billing, REX/campaigns/Sniper, team settings  
- Other clients’ job reqs or data  

The experience is intentionally clean, minimal, and decision-focused.

---

# 🧩 What Clients Can See (VERY IMPORTANT)

Clients CAN see:
- Job REQs they are assigned to  
- Candidates submitted to those REQs  
- Recruiter submittal notes, resumes, files  
- Approval/rejection buttons, comments  
- Activity log limited to their REQ  

Clients CANNOT see:
- Job REQs they are not assigned to  
- Workspace-wide candidates  
- Pipeline view (internal)  
- Internal tags/notes/source intelligence unless recruiter shares  
- Deals/Billing/Admin controls/automation settings  
- Other clients’ data  

If a client EVER sees anything outside these limits → escalate immediately.

---

# 🧱 How Clients Log In & Collaborate

1) Recruiter invites client as Guest Collaborator  
   - Job REQ → Settings → Add Guest  
2) Client receives email invite  
   - Secure link; create password if first time  
3) Client logs into simplified portal  
   - Shows assigned Job REQs, submitted candidates, feedback options  
4) Client reviews candidates  
   - Open candidate → view summary/resume/attachments  
5) Client leaves feedback  
   - Approve / Reject / Comment (Needs more info)  
6) Recruiter notified  
   - Email + in-app; optional REX automations  

---

# 🧠 Submission Experience for Clients

Each submission appears as a card with:
- Candidate name, title, company  
- Recruiter summary pitch  
- Resume/attachments  
- Approve/Reject buttons  
- Comments area and activity history  

Clients can: open multiple submissions, approve/decline, comment, view attachments  
Clients cannot: edit candidates, move stages, add new candidates, view internal notes  

---

# 🔗 How Guest Visibility Is Determined

Visibility requires all three:
1) Guest is assigned to the Job REQ  
2) Candidate has been submitted to that REQ  
3) Submission is active/visible (not archived, unless UI shows history)  

If any link is missing, the client will not see the candidate.

---

# 🔄 Client Feedback → Recruiter Workflow

When client Approves:
- Recruiter notified; optional automation moves candidate forward  

When client Rejects:
- Recruiter notified; candidate may move to Rejected; recruiter can nurture or close out  

When client Comments:
- Recruiter sees thread; can respond; REX can trigger next steps  

All feedback events update logs, Job REQ activity, and optional pipeline automation.

---

# 🧭 Onboarding Clients (Best Practice)

1) Invite via Job REQ → Settings → Add Guest  
2) Send a brief “how to review” message with screenshots or a quick loom (optional)  
3) Submit first set of candidates; confirm email received  
4) Ask the client to Approve/Reject/Comment on one candidate to verify loop  
5) Offer a “Client View” walkthrough: where to click, what they’ll see, how to leave feedback  

Script:
> “Your client view only shows the candidates we submit to you. Approve, reject, or leave a comment and we’ll handle the next step.”

---

# 🛠 Troubleshooting Client Collaboration Issues

## ❌ Client cannot log in
Causes: Wrong email, invite not accepted, password mismatch, cookie issues  
Fix: Resend invite → password reset → incognito → confirm email

## ❌ Client sees NO candidates
Causes: Not assigned to Job REQ; no submissions yet; misassigned client; RLS rule  
Fix: Assign Guest to REQ; confirm submissions exist; escalate if still hidden

## ❌ Client sees SOME but not ALL candidates
Causes: Some candidates not submitted; assigned to wrong REQ; filter active  
Fix: Review submission history; re-submit missing candidates

## ❌ Client sees WRONG candidates
CRITICAL SECURITY BUG — escalate immediately  
Include: Workspace ID, Job REQ ID, Candidate IDs, Guest ID, expected vs actual, screenshots

## ❌ Submission emails not received
Fix: Check spam; resend; verify integration and recipient; escalate SendGrid outage

## ❌ Approve/Reject buttons not working
Causes: UI rendering bug, REQ misconfig, stale session  
Fix: Refresh, different browser/incognito; escalate if action fails

---

# 🔍 Client vs Recruiter Views (Differences)

Recruiter View:
- Full pipelines, sourcing tools (REX/Sniper), internal notes/tags, job settings  

Client View:
- Only candidates submitted to them, approve/reject/comments, submission history for that REQ  

Scope:
- Recruiters operate across the workspace; Clients operate within assigned REQs only.

---

# 💬 REX Conversational Scripts

Explaining client view:
> “Clients only see candidates you submit to them, not your full database. It keeps their view simple and focused.”

Inviting a client:
> “Open the Job REQ, go to Settings, and click ‘Add Guest Collaborator’. I’ll walk you through it.”

No access:
> “Let’s add them to the correct Job REQ — guests don’t have workspace-wide visibility.”

Feedback received:
> “Your client just approved this candidate — ready to move them forward to Interview or Offer?”

---

# 🚨 When to Escalate Immediately

- Guest sees wrong candidates or internal notes  
- Client sees other clients’ submissions or admin controls  
- Submission history loads incorrectly or not at all  
- Approvals/rejections not saving  
- Candidate profile not loading in client portal  
- Email links failing system-wide  
- Any suspected security/privacy issue  

Ticket payload:
- Workspace ID, Job REQ ID, Guest ID, Candidate ID, Submission ID  
- Expected vs actual visibility, errors, screenshots/logs  

---

# 🔗 Related Files

- `submissions-and-feedback.md`  
- `workspace-roles-and-permissions.md`  
- `team-management.md`  
- `job-requisites.md`  
- `candidate-management.md`  
- `email-delivery.md`  
- `errors-and-troubleshooting.md`

