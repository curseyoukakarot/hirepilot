# Job REQs (Job Requirements) — Full Support Documentation  

job-reqs.md

(Everything about Job REQs, assignment, pipeline logic, client collaboration, REX integrations)

### For REX (Support Agent)

---

## Purpose of This File

This file teaches REX how to:

- Understand how Job REQs are created  
- Explain how Job REQs link to candidates  
- Guide users through the Job REQ interface  
- Troubleshoot missing candidates  
- Diagnose client-collaboration issues  
- Explain how submissions and feedback flow to Job REQs  
- Handle pipeline updates  
- Understand REX interactions with Job REQs  
- Escalate system-wide issues with Job REQs  

---

# ⭐ What Is a Job REQ?

A Job REQ represents:

- A job opening  
- A role the recruiter is hiring for  
- A central location for all candidate activity  
- The pipeline tied to that specific job  
- The client’s evaluation workspace  
- A collaboration space  
- A submission + feedback system  

Job REQs are the nexus of HirePilot’s hiring engine.

---

# 🧠 How Job REQs Are Created

Users can create Job REQs by:

- Clicking “New Job REQ”  
- Using the Job REQ Builder  
- Converting a Deal → Job REQ  
- Using the “Add Job” button inside Deals or Clients  
- Importing via CSV/API (optional)  
- REX-proposed Job REQs (auto-created in certain workflows)  

When a Job REQ is created, system sets up:

- Default pipeline  
- Permissions  
- Unique slug for sharing  
- Submission email routes  
- Activity log instance  
- Candidate slot container  

---

# 📦 Job REQ Structure

## 1. Job Overview
- Title  
- Contract / Full-time  
- Salary range  
- Location  
- Description  
- Requirements  
- Nice-to-haves  
- Hiring manager info  
- Industry  
- Keywords  

## 2. Pipeline
Default stages (customizable):  
- Sourced  
- Contacted  
- Interviewed  
- Offered  
- Hired  
- Rejected  

## 3. Candidates Assigned
Every candidate linked to the job:
- Their stage  
- Their submission status  
- Their feedback  
- Their activity  

## 4. Client Collaboration Panel
- Approve/Reject  
- Comments  
- Notes  
- Interview requests  
- Notifications  

## 5. Activity Log
- Submissions  
- Feedback  
- Stage changes  
- Comments  
- Automated actions  

## 6. REX Insights
- Candidate scoring  
- Role-to-candidate alignment  
- Job-matching insights  
- Diversity signals  

---

# 🔗 How Candidates Are Linked to Job REQs

Candidates are added to a Job REQ when:

- Lead → Candidate conversion  
- Recruiter manually assigns candidate  
- Candidate applies to public form  
- REX creates candidate via automation  
- Sniper → Convert To Candidate (with job selection)  

If a Job REQ is missing candidates:
- They may have been added to the wrong Job REQ  
- The recruiter may not have converted the lead  
- Filters may hide candidate  

---

# 📤 Submissions (Via Job REQ)

Job REQs are the home base for submission workflows.

When recruiter submits candidate:

- SendGrid sends formatted email to client  
- Client portal receives new submissions  
- Job REQ logs event  
- Pipeline automatically updates  
- REX can trigger additional automations  

Submission includes:

- Candidate profile  
- Summary  
- Resume  
- Skills  
- Notes  
- Fit explanation (auto or manual)  

---

# 🔁 Client Feedback → Job REQ Workflow

When client provides feedback:
- “Approve”, “Reject”, “Interview”, “Comment”  

Job REQ updates:
- Candidate stage automatically  
- Activity log entry created  
- Recruiter notified  
- Deal metrics update (pipeline progression)  

If client feedback fails:
- Usually SendGrid or portal issue  
- Candidate may not be tied to the job  
- Permissions not correctly assigned  

---

# 🧭 Pipeline Behavior Inside Job REQs

Pipeline ties directly into:
- Automation engine  
- Deal stage projection  
- Activity logs  
- REX monitoring  

When stage changes:
- Triggers automations  
- Updates candidate drawer  
- Sends notifications  
- REX may respond based on workflow type  

---

# 🎛 Permissions Inside Job REQs

## Team Admin + Recruiters:
- Full edit  
- Add/remove candidates  
- Add/edit job details  
- Move pipeline  
- Submit candidates  
- Invite collaborators  

## Guest Collaborators (Clients):
- View assigned candidates  
- Approve/reject  
- Comment  
- Request interview  
- Cannot edit job details  
- Cannot move stages  

Common issue:  
Clients often try to edit candidate details — which is not permitted.

---

# 🧰 Common Job REQ Issues & Fixes

## “Candidates not showing inside the Job REQ”
Causes:
- Filters applied  
- Wrong job assigned  
- Candidate was added globally, not to job  
- Conversion didn’t complete  
Fix:
> “Let’s clear filters and make sure this candidate is actually assigned to this Job REQ.”

## “Client cannot access job”
Causes:
- Missing collaborator permissions  
- Wrong workspace  
- Expired link  
Fix:
- Reinvite collaborator  
- Regenerate link  

## “Submissions not showing to client”
Causes:
- Submission failed  
- Client portal issue  
- Candidate not tied to job  
Fix:
- Resubmit  
- Verify candidate-job relationship  

## “Pipeline stuck — stage not updating”
Causes:
- Automation conflict  
- Backend 400/500 error  
- Network issue  
Fix:
- Retry  
- Check logs  
- Escalate if system-wide  

## “Wrong job details showing”
Causes:
- Old cached REQ  
- Chrome extension overwriting  
- Browser caching  
Fix:
- Full refresh  
- Check job history  

---

# 🧭 REX Troubleshooting Flow

1) Ask: “What are you trying to do with this job?” (assign candidate, submit, get client feedback)  
2) Identify issue type: data, permissions, submission, stage, client access  
3) Walk user step-by-step through fix  
4) Verify backend behavior (job logs, candidate assignment, pipeline updates)  
5) Escalate when needed  

---

# 💬 REX Conversational Phrasing

Candidate not tied to job:
> “Looks like this candidate hasn’t been assigned to this Job REQ yet — want me to walk you through adding them?”

Client can’t see job:
> “This is usually a permissions issue. Let’s re-send the collaborator invite with the correct access.”

Submission confusion:
> “Submissions let you send formatted candidate reports to your client. Want me to show you exactly how it works on this Job REQ?”

---

# 🚨 When REX Must Escalate

Escalate if:
- All Job REQs fail to load  
- Candidate assignment broken  
- Submissions failing system-wide  
- Client portal unavailable  
- Pipeline updates failing globally  
- Notes/comments not syncing  
- 500 errors on Job REQ endpoints  
- Job REQs duplicating unexpectedly  

Ticket must include:
- Workspace ID  
- Job REQ ID  
- Candidate ID (if relevant)  
- Error message  
- Browser logs (if provided)  
- Action user attempted  

---

# 🔗 Related Files  

- `candidates-and-drawer.md`  
- `pipelines-and-stages.md`  
- `submissions-and-feedback.md`  
- `client-portal.md`  
- `automation-engine.md`
# Job REQs — Full Support Guide

job-reqs.md

(Job requests, creating REQs, attaching candidates, connecting pipelines, troubleshooting)

## Purpose of This File

This guide teaches REX how to:

- Create new Job REQs  
- Assign candidates  
- Connect REQs to Pipelines  
- Understand REQ ownership  
- Link REQs to campaigns  
- Manage requirements and job details  
- Troubleshoot REQ issues  
- Escalate REQ-related problems  

It is CRITICAL for REX to understand how REQs interact with:

- Candidates  
- Pipelines  
- Campaigns  
- Deals  
- Automations  
- Team permissions  

---

# 🎯 What Is a Job REQ?

A Job REQ represents:

- A job opening  
- A role you’re actively recruiting for  
- A pipeline that candidates move through  
- A parent object for campaigns, candidates, and submissions  

A REQ stores:

- Job title  
- Company  
- Location  
- Compensation  
- Description  
- Requirements  
- Hiring manager(s)  
- Attached candidates  
- Pipeline stages  
- Notes & activity  
- Tags  
- Custom fields  
- REQ status (Open, On Hold, Closed, Completed)  

---

# 🧭 How to Create a Job REQ (REX step-by-step)

1. Go to **Job REQs** page  
2. Click **Create New REQ**  
3. Fill required fields:
   - Job Title  
   - Company  
   - Location  
4. (Optional)
   - Salary  
   - Remote/hybrid/in-office  
   - Employment type  
   - Description  
   - Responsibilities  
   - Requirements  
5. Choose pipeline template  
6. Assign REQ owner  
7. Add hiring manager(s)  
8. Save  

REX should always guide users with conversational steps like:
> “Let’s create your new REQ. What’s the job title?”  

---

# 🔗 How REQs Connect to Other Parts of HirePilot

This is one of the most important parts of the file.

### REQs connect to:
- **Candidates** (most important relationship)
- **Campaigns**  
- **Pipelines**  
- **Deals**  
- **Automations**  
- **Sniper scraping assignments**  
- **Workflows**  

REX must be able to explain these connections.

---

# 🧩 Assigning Candidates to REQs

Candidates can be added to a REQ by:

### **1. Manual Add**
- Open REQ  
-.Click **Add Candidate**  
- Select candidate or create new  

### **2. Auto-conversion from campaigns**
If campaign is tied to a REQ → interested lead automatically becomes a Candidate in that REQ.

### **3. Convert Lead to Candidate (Manual)**
User assigns REQ during conversion.

### **4. CSV import**
Users can import directly into a REQ.

### **5. Chrome extension scraping**
Scraped candidates can be added to the REQ after enrichment.

---

# 📊 Pipeline Stages for REQs

Each REQ uses a defined pipeline with customizable stages:

**Default customizable stages:**
- **Sourced**  
- **Contacted**  
- **Interviewed**  
- **Offered**  
- **Hired**

Users can reorder, rename, or hide stages.

REX must know:
- Moving candidates between stages updates analytics  
- Stage movement triggers workflows  
- Stage movement logs activity on the REQ  
- Moving a candidate to “Hired” triggers the Deals → Billing workflow (if enabled)  

---

# 🧠 REQ Ownership & Permissions

### REQ Owner
- Full control  
- Can edit details  
- Can add/remove candidates  
- Can run campaigns  
- Can assign hiring managers  
- Can modify pipeline  

### Hiring Managers
- Can view REQ  
- Can view candidates  
- Can leave notes  
- Cannot delete REQ  
- Cannot edit system fields  

### Team Members
Follow workspace role permissions:
- Viewer  
- Recruiter  
- Team Admin  
- Super Admin  

REX must enforce permissions rules.

---

# 🚀 Connecting REQs to Campaigns

A campaign can be tied to a REQ, meaning:

- Messages are relevant to that job  
- Interested replies → convert into candidates for that REQ  
- Analytics group under that REQ  
- Sequence stops when candidate replies  
- Automations tied to that REQ run automatically  

REX should ask:
> “Would you like this campaign to be connected to the REQ so candidates auto-assign?”

---

# 📌 REQ Statuses

Statuses:
- **Open**  
- **On Hold**  
- **Closed**  
- **Completed**  

REX must explain implications:
- **Open** → Candidates added normally  
- **On Hold** → New candidates discouraged  
- **Closed** → Role filled; stop campaigns  
- **Completed** → Billing finalized  

---

# 📓 Notes, Files & Activity Tracking

REX should know that each REQ has:
- Notes section  
- File uploads  
- Comments (if collaborator mode enabled)  
- System-generated events  
- Updates when stages change  

---

# 🛠️ Troubleshooting REQ Issues (REX must respond like this)

## ❌ “REQ won’t save”
Check:
- Missing required fields  
- REQ name too long  
- Duplicate REQ for same job  
- Database constraint  

## ❌ “Candidate not appearing in REQ”
Ask:
- “Was candidate assigned to the REQ?”  
- “Are you filtering by stage?”  
- “Is the candidate archived?”  

## ❌ “Pipeline stages not showing”
Causes:
- Custom pipeline missing  
- User permission issue  
- Browser cache  
- System migration delay  

## ❌ “Campaign didn’t attach to REQ”
Check:
- Did user choose the REQ?  
- Did they finalize the wizard?  
- Was REQ in ‘Closed’ state?  
- Campaign saved as “Draft”?  

## ❌ “REQ disappeared”
Possible:
- User filtered by status  
- User switched team/workspace  
- REQ archived  
- Permission change  

## ❌ “Candidates not converting to REQ”
Check:
- Campaign tied to REQ?  
- Classification correct?  
- Email provider connected?  
- Reply inside same thread?  

---

# 🚨 When REX Must Escalate a Support Ticket

Escalate if:
- REQs fail to save or update  
- REQ pipelines corrupted  
- Candidates missing across multiple REQs  
- Campaigns not attaching to REQs  
- Stages not loading  
- REQ permissions failing  
- REQ assignments dropping unexpectedly  
- REQ names duplicating incorrectly  
- REQ analytics not populating  

Ticket must include:
- REQ ID  
- Workspace ID  
- Candidate ID (if relevant)  
- Pipeline stages  
- User role  
- Any related log errors  
- Steps user took  

---

# 👤 Related Files
- `pipelines.md`  
- `candidates.md`  
- `candidates-add.md`  
- `opportunities.md`  
- `campaign-wizard.md`  
- `classification.md`  
- `errors-and-troubleshooting.md`


