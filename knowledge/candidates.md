# Candidates in HirePilot

candidates.md

(Candidate Profiles, Submissions, Enrichment, Pipelines & Troubleshooting)

## Who this file is for
Users managing talent, reviewing applications, adding people from campaigns, enriching profiles, or trying to understand how candidates fit into Job REQs, Pipelines, and Opportunities.

REX uses this file to:
- Walk users through adding candidates  
- Show them how enrichment works  
- Navigate the candidate drawer  
- Troubleshoot missing data or errors  
- Explain how candidates move through a hiring workflow  
- Trigger workflows or escalate ticket issues  

---

# 🙋‍♂️ What is a Candidate?
A **Candidate** represents a real human being who may be considered for a job.

Every Candidate record can include:
- Name  
- Email  
- Phone (if enriched)  
- LinkedIn URL  
- Resume & attachments  
- Summary  
- Experience & Skills  
- Notes  
- Activity timeline  
- Status  
- Assigned Job REQs  
- Pipeline stage  
- Submissions to clients  
- Enrichment data  
- Custom fields  

Candidates can come from:
- Outreach campaigns  
- Chrome extension  
- CSV imports  
- Manual entry  
- LinkedIn Sniper / automation tools  
- REX-generated sourcing  

---

# 🧱 Anatomy of a Candidate Profile
Each Candidate includes:

### **1. Header**
- Name  
- Current title  
- Location  
- Tags  
- Owner  

### **2. Contact Info**
- Email  
- Phone  
- LinkedIn  
- Company  
- Website  

### **3. Enrichment Section**
Where enhanced insight appears:
- Better job titles  
- Seniority  
- Experience  
- Skills & keywords  
- Company revenue  
- Funding stage  
- Tech stack  
- Associated websites  
- Social links  

### **4. Job REQ Assignments**
All REQs the candidate is in + their stage in each.

### **5. Notes & Feedback**
Team notes, client feedback, and private/internal notes.

### **6. Resume & Attachments**
PDFs, docs, scorecards, assessments, etc.

### **7. Timeline Activity**
Every action is logged:
- Status change  
- Stage movement  
- Submissions  
- Feedback  
- Email events  
- REQ assignment  

---

# ✏️ How to Add or Create a Candidate (Step-by-Step)
REX should walk users conversationally through these steps:

## **Method 1 — Add Manually**
1. Go to **Candidates** page  
2. Click **New Candidate**  
3. Fill out:
   - Name  
   - Email  
   - LinkedIn URL  
   - Location  
   - Resume (optional)  
4. Click **Create Candidate**  
5. User may optionally enrich

## **Method 2 — Add From Chrome Extension**
When viewing a LinkedIn profile:
- Click the HirePilot extension  
- Confirm the candidate details  
- Click “Save to HirePilot”  
- (Optional) Assign to a Job REQ  

## **Method 3 — Add From Campaign Replies**
If someone replies in a positive/qualified way:
- Lead becomes a Candidate  
- Assigned to a REQ if linked  
- REX classifies the intent  

## **Method 4 — Add From CSV Import**
For large applicant lists:
1. Go to Candidates  
2. Click Import  
3. Upload CSV  
4. Map fields  
5. Import  

## **Method 5 — Sniper / LinkedIn Automation**
- Scrapes profiles  
- Adds candidates  
- Auto-enriches when credits allow  

---

# 🔍 Candidate Enrichment (How It Works)
REX should explain enrichment every single time a user asks:

## **Basic Enrichment (1 credit)**
- Email lookup  
- Title normalization  
- Company info  
- LinkedIn data cleanup  
- Skills & seniority extraction  

## **Enhanced Enrichment (+1 credit)**
Adds deeper signals:
- Revenue  
- Funding  
- Tech stack  
- Keywords  
- Industry segmentation  

## **Smart Provider Order**
REX uses the cheapest / best data source:

**Decodo → Apollo → Hunter/Skrapp → Manual scraping**

REX must:
- Warn user if credits are low  
- Confirm before using enhanced enrichment  
- Never double-charge if data already exists  

---

# 🔁 Assigning Candidates to a Job REQ
This always confuses new users.

### **Method 1 — From the Candidate Drawer**
1. Open the candidate  
2. Click “Assign to Job REQ”  
3. Choose the REQ  
4. Candidate appears inside pipeline  

### **Method 2 — From the REQ Itself**
1. Open the REQ  
2. Click **Add Candidate**  
3. Choose an existing candidate or create new  

### **Method 3 — Auto-assignment**
Campaign replies or workflows can auto-assign:
- “Interested” → assign to appropriate REQ  
- Matching tags → assign  

---

# 🧱 Moving Candidates Through Pipeline Stages
Inside a REQ:
- Drag candidate from one stage to another  
**or**  
- Open the candidate drawer → move stage dropdown  

When they move:
- Status updates  
- Timeline logs event  
- Notifications trigger (Slack/email)  
- Client portal updates  

---

# 📤 Submitting Candidates to Clients
Steps:
1. Open the candidate  
2. Click **Submit to Client**  
3. Choose client/collaborator  
4. Add optional message  
5. Candidate emailed + portal access granted  

### Clients can:
- Approve  
- Decline  
- Comment  
- Download resumes  

Submission history is stored permanently.

---

# 📊 Candidate Status Types
- **Active** — being reviewed  
- **Interviewing** — in process  
- **On Hold** — temporarily paused  
- **Rejected** — not a fit  
- **Withdrawn** — candidate withdrew  
- **Hired** — placed  
- **Archived** — not visible in primary lists  

REX must ensure the correct status before performing actions.

---

# 🧪 Troubleshooting Common Candidate Issues

### **“Candidate didn’t enrich”**
Possible reasons:
- Out of credits  
- Provider returned limited data  
- LinkedIn scraping failed  
- Proxy warming wasn’t complete  

### **“Candidate disappeared from REQ”**
Causes:
- Wrong filter  
- Wrong pipeline  
- Candidate archived  
- Multiple workspaces  
- Wrong REQ assignment  

REX should ask:
> “Are you inside the correct REQ and pipeline view?”

### **“Client can’t see the candidate I submitted.”**
Check:
- Submission marked internal only  
- Wrong collaborator  
- Wrong email  
- Client did not open new portal link  

### **“I can’t move candidate to next stage.”**
Possible:
- REQ is closed  
- Candidate is marked hired  
- Workflow is restricting movement  
- Permissions issue  

### **“Candidate won't save”**
Look for:
- Missing required fields  
- 500 backend error  
- Browser extension conflict  
- Session timeout  

---

# 🚨 When to Escalate a Ticket
REX must open a ticket automatically if:
- Candidate record cannot be loaded  
- Candidate won’t save  
- Timeline events fail to log  
- Enrichment charges credits but returns empty  
- Attachments fail to upload  
- Submissions not sending  
- Stage movement produces error codes  
- Candidate stuck in “Loading...” state  

Ticket includes:
- Candidate ID  
- User ID  
- Workspace ID  
- URL  
- Error text  
- Steps taken  

---

# 👤 Related Files
- `job-reqs.md`  
- `pipelines.md`  
- `submissions.md`  
- `chrome-extension.md`  
- `linkedin-automation.md`  
- `enrichment.md`  


