# Adding Candidates — Full Support Guide

candidates-add.md

(All ways to add candidates, enrichment, assignment, troubleshooting)

## Purpose of This File

This guide teaches REX how to:

- Help users add candidates in every possible way  
- Explain the difference between Leads vs Candidates  
- Assist with manual creation  
- Convert leads → candidates (auto + manual)  
- Add candidates directly to Job REQs  
- Handle scraping-based creation  
- Help with CSV imports  
- Troubleshoot creation errors  
- Detect duplicates  
- Trigger enrichment  
- Escalate critical issues  

---

# 🎯 What Is a Candidate in HirePilot?

A Candidate represents:

- Someone being evaluated for a job  
- Someone who has expressed interest  
- Someone sourced manually  
- Someone converted from a lead  

Candidates belong to:

- A Workspace  
- Optionally: a Job REQ  
- Optionally: a Pipeline Stage  

Fields include:

- Name  
- Email  
- Phone  
- LinkedIn URL  
- Source  
- Notes  
- Tags  
- Experience  
- Enrichment data  

---

# 🧩 Ways to Add a Candidate (REX must know all)

There are 7 ways to add a candidate:

---

## **1. Manual Create (Add Candidate button)**

Flow:

1. Go to Candidates page  
2. Click **Add Candidate**  
3. Enter:  
   - First name  
   - Last name  
   - Email (optional but recommended)  
   - LinkedIn URL (optional)  
   - Phone (optional)  
4. Choose a Job REQ (optional)  
5. Choose initial stage (optional)  
6. Save  

REX should guide users step-by-step.

---

## **2. Convert Lead → Candidate (Automatic)**

Triggered when:

- Lead replies positively (“Interested”)  
- Lead classified as high-quality by REX  
- Sequence auto-stops  

When this happens:

- Lead becomes Candidate  
- Candidate assigned to:  
  - Original REQ (if campaign tied to one)  
  - Or user is prompted to choose  

REX must explain:

> “HirePilot automatically converts interested leads into candidates so you can track them through your pipeline.”

---

## **3. Convert Lead → Candidate (Manual)**

User can:

- Open Lead drawer  
- Click **Convert to Candidate**  
- Choose REQ  
- (optional) add notes  
- Save  

---

## **4. Add Candidate via Chrome Extension (LinkedIn/SN/Recruiter)**

When scraping:

- Profile → Lead  
- If highly qualified OR user selects manually: convert to Candidate  
- Skills  
- Experience  
- Summary  
- Education  

REX must know:

> “Scraped profiles are leads first, and can be converted to candidates with one click.”

---

## **5. Add Candidate via CSV Import**

Step-by-step:

1. Go to Candidates page  
2. Click **Import CSV**  
3. Use template CSV (REX should provide it)  
4. Map fields:  
   - Name  
   - Email  
   - Phone  
   - LinkedIn URL  
   - Source  
   - Notes  
5. Confirm import  
6. Candidates created in bulk  

CSV troubleshooting below.

---

## **6. Add Candidate from Job REQ Page**

On any Job REQ:

- Click “Add Candidate”  
- Choose:  
  - Manual create  
  - From Leads  
  - From CSV  
  - From Scraper  

REX must explain:

> “Adding candidates directly from a REQ automatically assigns them to the correct pipeline.”

---

## **7. Add Candidate from Pipelines Page**

- Click “Add Candidate” from pipeline column  
- Popup appears  
- Same as Manual Create  
- Automatically assigns stage  

---

# 🤖 Auto-Enrichment (Important for Support)

Whenever a candidate is created, HirePilot attempts to enrich using:

Order:

1. **Decodo (Smartproxy)**  
2. **Hunter.io** (if user has key)  
3. **Skrapp.io** (if user has key)  
4. **Apollo** (if available)

Data retrieved:

- Email  
- Phone  
- Skills  
- Company info  
- Tech stack  
- Revenue  
- Industry  
- Keywords  

REX must explain:

> “Enrichment fills in the details automatically, like job titles and company info.”

---

# 🚫 Duplicate Handling

HirePilot prevents duplicates based on:

- Email  
- LinkedIn URL  
- Phone number  

If duplicate detected:

- System merges the records  
- Updates most recent information  
- Keeps activity feed merged  
- Prevents duplicate campaigns  

REX must describe the logic if asked.

---

# 🛠️ Troubleshooting Candidate Creation

---

## ❌ Problem: “I can’t add a candidate”

REX checklist:

- “Are required fields missing?”  
- “Is the email valid?”  
- “Is the LinkedIn URL valid?”  
- “Do you already have this candidate in your system?”  

Possible causes:

- Duplicate  
- Invalid email  
- Missing name fields  
- Database constraints  

---

## ❌ Problem: “Candidate isn’t showing in the REQ”

Ask:

- “Did you assign the candidate to a REQ?”  
- “Are you filtering by stage?”  
- “Are you in the correct workspace?”  

Fix:

- Assign manually  
- Refresh page  

---

## ❌ Problem: “Candidate didn’t convert from lead automatically”

Check:

- Was reply classified as “Interested”?  
- Was reply inside the same thread?  
- Was user’s email provider connected?  
- Was LinkedIn/Chrome data saved fully?  

---

## ❌ Problem: “CSV import failed”

Possible causes:

- Wrong column names  
- Missing headers  
- Invalid email formats  
- Empty rows  
- CSV saved as XLSX accidentally  

REX should instruct user:

> “Download the template, copy your data into it, and re-upload.”

---

## ❌ Problem: “Enrichment failed”

Causes:

- Provider down  
- Email invalid  
- LinkedIn URL invalid  
- User out of credits  

Fix:

- Rerun enrichment manually  

---

## ❌ Problem: “Wrong candidate assigned to REQ”

Fix:

- Open candidate drawer  
- Change REQ assignment  

---

# 🧠 REX Conversational Guidance Examples

### Helping a user convert a lead:
> “Open the lead, click ‘Convert to Candidate,’ choose the REQ, and I’ll take care of the rest.”

### Helping assign a REQ:
> “Let’s assign this candidate to the VP Sales role. Click the dropdown under Job REQ.”

### Helping with an import:
> “Upload the CSV using the template. Let me check the first few rows for missing data.”

---

# 🚨 When REX Must Escalate a Support Ticket

Escalate if:

- Candidates failing to save  
- REQ assignment broken  
- Pipeline stages not rendering  
- Duplicate detection failing  
- Enrichment failing across all candidates  
- CSV import failing with 500-level errors  
- Candidates disappearing  

Ticket must include:

- Candidate ID (if any)  
- Lead ID (if conversion failed)  
- REQ ID  
- Workspace ID  
- CSV rows (if import-related)  
- Error message  
- User steps taken  

---

# 👤 Related Files

- `leads.md`  
- `candidates.md`  
- `enrichment-providers.md`  
- `job-reqs.md`  
- `pipelines.md`  
- `chrome-extension.md`  
- `campaign-wizard.md`


