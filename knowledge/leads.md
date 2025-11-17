# Leads in HirePilot

leads.md

(Sourcing, Enrichment, Converting, Campaigns & Troubleshooting)

## Who this is for
Users sourcing prospects, building outreach campaigns, enriching data, or converting prospects into candidates or clients.

REX uses this file to:
- Explain the difference between Leads vs Candidates
- Walk through enrichment steps
- Help users generate prospects
- Convert leads to clients or candidates
- Troubleshoot enrichment issues
- Understand the campaign → lead → candidate flow

---

# 🧩 What Is a Lead?

A **Lead** is a potential candidate OR potential client — depending on how you use the data.

Leads are used for:
- Talent sourcing  
- Client prospecting  
- Campaign outreach  
- Automated sequences  
- Enrichment  
- Lead → Candidate conversion  
- Lead → Client conversion (Deals)

A lead usually contains:
- Name  
- Email (if enriched)  
- Company  
- Title  
- LinkedIn URL  
- Location  
- Status  
- Owner  
- Tags  
- Notes  
- Activity history  

---

# 🧱 Where Leads Come From

### **1. Chrome Extension**
From LinkedIn, Sales Navigator, or Recruiter.

### **2. CSV Imports**
Upload thousands of leads at a time.

### **3. Sniper / LinkedIn Automations**
Bulk scraping & enrichment.

### **4. Apollo Integration**
Pull leads directly from Apollo Search.

### **5. Manual Entry**
Create new lead records anytime.

### **6. Campaign Replies**
If someone replies, the system can:
- Convert them to a Candidate  
- Assign them to a REQ  
- Attach the reply thread

---

# 🔍 Core Actions You Can Do With Leads

### **1. Enrich a Lead**
Enrichment adds:
- Email  
- Phone number  
- Company data  
- Skills  
- Keywords  
- Funding stage  
- Tech stack  
- Revenue estimates  

### **2. Add Leads to Campaigns**
Campaigns use leads as their audience.

### **3. Convert Leads**
- **Lead → Candidate** (if interested in a REQ)  
- **Lead → Client** (if they are a prospect you want to work with)  
- **Lead → Opportunity** (sales pipeline)  

### **4. Tag & Segment**
Add tags like:
- VP Sales  
- Austin  
- 2025 prospects  
- Tech hiring  

### **5. Add Notes**
Keep internal notes or summaries.

---

# 🔁 Understanding Lead Status

These help REX know what to say:
- **New** – created but untouched  
- **Enriched** – email/phone/company data found  
- **Contacted** – added to a campaign  
- **Replied** – replied to a campaign  
- **Qualified** – strong fit  
- **Bad Fit** – not relevant  
- **Converted** – turned into candidate or client  

---

# 🧠 Understanding the Lead → Candidate Process

REX should explain it like this:

> “When you message a lead and they reply with interest or a question about the job, they become a Candidate.”

Triggers:
- Campaign replies  
- Manual conversion  
- REX classification (Interested / Not Interested / Not Now / Bad Fit)

Candidate creation pulls in:
- Name  
- Email  
- Title  
- LinkedIn  
- Enriched info  

Then user can:
- Assign to a REQ  
- Move them through pipeline  

---

# 🧠 Understanding Lead → Client → Opportunity Flow

If a lead is a potential partner:
1. User clicks **Convert to Client**  
2. Creates Client record  
3. Asks user if they want to create an Opportunity  
4. Opportunity → where they track revenue & deals  
5. Then user can create Job REQs under that client

---

# 🔋 Enrichment (In-Depth)

Leads use the **same enrichment stack as candidates**, but usually earlier in the funnel.

### **Basic Enrichment (1 credit)**
- Email lookup  
- Title normalization  
- Company info  
- Skills extraction  
- LinkedIn cleanup  
- Experience normalization  

### **Enhanced Enrichment (+1 credit)**
Adds deep insights like:
- Revenue  
- Funding stage  
- Keywords  
- Tech stack  
- Market signals  

### Provider Order
REX uses the cheapest and strongest:
1. Decodo  
2. Apollo  
3. Hunter  
4. Skrapp  
5. Internal scraping  

REX must:
- Check credit balance  
- Ask for confirmation if enhanced enrichment  
- Prevent double-charging  

---

# 🧪 Troubleshooting Leads Issues

### **“Lead didn’t enrich.”**
Possible:
- Out of credits  
- Provider returned incomplete data  
- Proxy failure  
- Apollo API limit hit  
- LinkedIn session expired  

REX should check:
> “Did you recently use LinkedIn automation or Apollo a lot today?”

---

### **“Leads aren’t showing in my campaign.”**
Reasons:
- Filters too narrow  
- Wrong tag  
- List empty  
- Lead was archived  

---

### **“I can’t convert a lead to a candidate.”**
Check:
- Does the lead have a LinkedIn URL?  
- Is the lead missing required fields?  
- User role (Member or Guest?)  

---

### **“I can’t find a lead I added.”**
Likely:
- Different workspace  
- Wrong filters  
- Lead archived  
- Duplicate merged automatically  

---

# 🚨 When REX Should Escalate a Ticket

REX must create a ticket if:
- Lead creation fails  
- Enrichment double-charges  
- Duplicate merging corrupts data  
- Lead → Candidate conversion fails  
- Lead → Client conversion breaks  
- Leads disappear after import  
- Apollo integration fails  
- Sniper scraping errors occur  
- Campaign → lead mapping breaks  

Ticket must include:
- Lead ID  
- User ID  
- Workspace ID  
- Steps taken  
- Error messages  
- Provider used  

Slack + email alert Super Admin immediately.

---

# 👤 Related Files
- `campaigns.md`  
- `candidates.md`  
- `job-reqs.md`  
- `opportunities.md`  
- `enrichment.md`  
- `chrome-extension.md`  
- `sniper.md`  


