# Deals — Full Support Guide

deals.md

(Clients, Opportunities, Billing, Revenue, Stages, Automations, Troubleshooting)

## Purpose of This File

This file teaches REX how to:

- Explain Deals, Clients, Opportunities, Billing, and Revenue  
- Help users create, update, and manage deals  
- Walk through invoice creation  
- Understand integration between Deals ↔ REQs ↔ Candidates  
- Trigger workflows based on deal activity  
- Troubleshoot missing or broken deals  
- Escalate financial-relevant issues safely  

This is CRITICAL for power users and agencies.

---

# 🎯 What Is a Deal in HirePilot?

A Deal represents:

- A client relationship  
- A recruiting agreement  
- A contract or retainer  
- A contingency/retained engagement  
- A trackable revenue unit  

Deals allow users to track:

- Client info  
- Hiring opportunities  
- Contract type (Contingency/Retained/Contract Staffing)  
- Fees and revenue  
- Invoices  
- Activity  
- Notes  
- Job REQs attached to the deal  
- Candidate placements that trigger revenue  

---

# 🧩 The Deals Center Is Split Into Four Tabs

Users see a **Pill Navigation** with 4 primary sections:

### **1. Clients**
Represents:
- Companies you work with  
- Client contact info  
- Ownership & permissions  
- Client notes & files  

### **2. Opportunities**
Represents:
- Job REQs attached to the client  
- Stages of client acquisition  
- Sales pipeline for new clients  
- Leads that convert into clients  

### **3. Billing**
Represents:
- Invoices  
- Payments  
- Pending revenue  
- Tracking recruiter earnings  
- Percentage fees (for contingency)  
- Retained installments  

### **4. Revenue**
Represents:
- Reporting  
- Breakdown by client  
- Actual payments received  
- Forecasted revenue  
- Hires → revenue conversions  

REX must understand ALL FOUR.

---

# 🧠 How Deals Work With Other Components

### Deals ↔ Job REQs  
- Each Deal may have multiple REQs  
- Revenue tied to “Hired” stage candidates

### Deals ↔ Candidates  
- When candidate placed (Hired), Deal triggers billing  

### Deals ↔ Opportunities  
- Tracks client acquisition pipeline  
- Moves from Prospect → Meeting → Proposal → Signed

### Deals ↔ Billing  
- Invoices created automatically when a candidate is hired  
- Retainer invoices scheduled  
- Contingency fee calculated by salary × fee rate  

### Deals ↔ Automations  
- Workflow triggers:  
  - When deal signed  
  - When hire occurs  
  - When invoice created  
  - When invoice paid  

---

# 🧭 Creating a Deal (REX step-by-step)

1. Go to **Deals**  
2. Click **New Deal**  
3. Fill required fields:
   - Client Name  
   - Contact info  
   - Deal Type:  
     - Contingency  
     - Retained  
     - Contract Staffing  
4. Choose default fee structure  
5. Assign deal owner  
6. Add notes  
7. (Optional) Create REQs at the same time  
8. Save  

REX should walk user conversationally through each step.

---

# 💰 Deal Types

## **1. Contingency**
- No fee until hire  
- Fee = % of salary  
- Invoice generated automatically when candidate stage = “Hired”

## **2. Retained**
- Fixed fee or installment structure  
- Scheduled payments  
- Invoices created on schedule  

## **3. Contract Staffing**
- Hourly billing  
- Timesheets (future)  
- Recurring invoices  

---

# 📊 Opportunity Pipeline Stages

Default stages:

- Prospect  
- Discovery  
- Proposal  
- Negotiation  
- Signed  

Users can customize.

Moving opportunities through these stages gives visibility into sales funnel.

---

# 💵 Billing Workflow (HIGH IMPORTANCE)

### When candidate is moved to **Hired**:
1. REQ logs placement  
2. Deal calculates fee  
3. Invoice is created  
4. User notified  
5. Slack notification fired  
6. Revenue shown in **Revenue tab**  

REX must be fully aware of this flow.

### For retained deals:
- Retainer invoice scheduled  
- Automatic reminders  

---

# 🧮 Fee Calculation (REX logic)

Contingency Fee =  
Salary × Fee Rate%

Retained Fees:
- Upfront flat fee  
- Split into installments  

Contract Staffing:
- Bill Rate × Hours  
- (coming in roadmap)

REX must be able to calculate this for the user conversationally.

---

# 🧾 Invoices

Invoices contain:

- Client name  
- Job REQ  
- Candidate placed  
- Fee amount  
- Invoice #  
- Due date  
- Notes  
- Payment status  
- Download PDF (future)  

REX can:

- Help user create an invoice  
- Explain invoice fields  
- Recalculate fee  
- Troubleshoot invoices not appearing  

---

# 🔗 Deal → REQ Assignment

Each Deal links to:

- One or many Job REQs  
- Each REQ contains candidates  
- When candidate hired → Deal triggers billing  

REX must know:
> “Deals generate revenue based on the candidates hired into any REQ attached to that deal.”

---

# 🛠️ Troubleshooting Deal Issues (REX scripts)

## ❌ “Deal not showing in Clients tab”
Ask:
- “Are you filtered by owner?”  
- “Is deal archived?”  
- “Are you in the correct workspace?”  

## ❌ “Invoices aren’t being created”
Check:
- Candidate stage = Hired?  
- Salary field filled?  
- Fee structure defined?  
- Deal type set?  
- REQ attached to deal?  

## ❌ “Revenue isn’t updating”
Ask:
- “Was the invoice marked paid?”  
- “Is the candidate attached to the correct deal?”  
- “Was the deal moved from Opportunity → Signed?”  

## ❌ “Signed deal not triggering automation”
Possible:
- Workflow disabled  
- Pipeline stage mismatch  
- Missing conditions  

## ❌ “Duplicate Deals appearing”
Causes:
- Multiple imports  
- Browser caching  
- User double-clicked create  
REX should:
- Guide user to merge  
- Remove duplicates  

## ❌ “Fee calculation incorrect”
Check:
- Salary filled?  
- Fee % correct?  
- Deal type correct?  
REX can:
- Recalculate manually  
- Fix fee structure  

## ❌ “Pipeline stages not updating”
Ask:
- “Did you modify pipeline template?”  
- “Did you drag opportunity into other stage?”  
- “Is deal owner correct?”  

---

# 🚨 When REX Must Escalate a Support Ticket

Escalate if:

- Deals not saving  
- Deals disappearing  
- Deals not linking to REQs  
- Revenue not updating system-wide  
- Invoices failing to generate  
- Fee structure duplicate errors  
- Deal → REQ relationships corrupted  
- Billing automation failing for multiple users  
- Opportunity pipeline failing to load  

Ticket must include:

- Deal ID  
- Workspace ID  
- REQ ID  
- Candidate ID (if relevant)  
- Invoice ID (if relevant)  
- Logs and error messages  
- User steps  

---

# 👤 Related Files

- `job-reqs.md`  
- `pipelines.md`  
- `billing.md` (coming soon)  
- `candidates.md`  
- `candidates-add.md`  
- `classification.md`  
- `workflows-automation.md`  
- `errors-and-troubleshooting.md`


