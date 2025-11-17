# Opportunities (Deals) in HirePilot

opportunities.md

## Who this file is for
Any user working with clients, tracking recruiting deals, converting leads into paying customers, sending invoices, or managing revenue.

REX uses this file to:
- Explain how deals work
- Help users create and manage opportunities
- Walk them through converting leads → clients
- Attach Job REQs to opportunities
- Troubleshoot billing/revenue issues
- Trigger workflows when deals change stages

---

# 💼 What Is an Opportunity?

An **Opportunity** represents a business deal with a client.

Examples:
- Retained search  
- Contingency search  
- Flat-fee search  
- Recruiting contract  
- RPO  
- Multiple positions under one client  

Each Opportunity tracks:
- Client info  
- Open Job REQs  
- Deal type  
- Contract details  
- Expected revenue  
- Actual revenue  
- Invoices  
- Notes  
- Activity feed  
- Collaborators  
- Stages (deal pipeline)

Opportunities appear inside the **Deals** section of HirePilot.

---

# 🧱 Anatomy of an Opportunity

### **1. Client Details**
- Company  
- Point of contact  
- Contact info  
- Relationship history  
- Linked accounts  

### **2. Deal Information**
- Deal name  
- Deal type (contingency, retained, contract)  
- Fee structure  
- Estimated value  
- Start date  
- Close date  
- Notes / attachments  

### **3. Deal Pipeline Stage**
HirePilot default deal stages:
- New  
- Discovery  
- Proposal  
- Negotiation  
- Won  
- Lost  

(These are customizable by Team Admins.)

### **4. Linked Job REQs**
Each Opportunity can have:
- 1 REQ  
- or multiple REQs (common in retained or multi-role searches)

REQs appear inside the Opportunity so recruiters can track jobs + revenue together.

### **5. Billing & Invoices (Pro/Team plan)**
Inside the Billing tab:
- Create invoices  
- Send invoices  
- Track invoice status  
- Record payments  
- Auto-update revenue reports  

### **6. Activity Timeline**
Tracks all deal activity:
- Stage changes  
- Job REQs added  
- Changes to fees  
- Invoices created  
- Payments received  
- Client messages  
- Notes added  

---

# 🔄 How to Create an Opportunity (Step-by-Step)

REX should walk the user through this conversationally.

### **Method 1 — Create Directly**
1. Go to **Deals** → **Opportunities**  
2. Click **Create Opportunity**  
3. Enter:  
   - Client name  
   - Opportunity title  
   - Deal type  
   - Fee model  
   - Estimated revenue  
   (Optional) Add notes & attachments  
4. Save  

### **Method 2 — Convert a Lead Into a Client**
1. Go to **Leads**  
2. Open a lead  
3. Click **Convert to Client**  
4. Complete client details  
5. System will prompt:  
   “Would you like to create an Opportunity for this client?”  

### **Method 3 — From a Job REQ**
When creating a new REQ:
- If the associated Client has no Opportunity  
→ REX should suggest creating one.

---

# 🧩 Linking Job REQs to an Opportunity

Steps:
1. Open Opportunity  
2. Go to **Job REQs** tab  
3. Click **Add REQ**  
4. Attach an existing REQ  
**or**  
5. Create a new REQ directly from this screen  

REQ → Opportunity linking ensures:
- Revenue forecasting  
- Pipeline accuracy  
- Billing accuracy  
- Correct automation workflows  

---

# 📤 Invoicing & Billing Inside an Opportunity

Users often ask:  
> “Where do I create an invoice?”

Answer:
Inside the Opportunity → **Billing** tab.

Here they can:
- Create invoice  
- Select invoice type (retain, placement, milestone, flat fee)  
- Email invoice  
- Track paid/unpaid  
- Sync with Stripe (if configured)  

When an invoice is paid:
- Revenue updates  
- Reports update  
- Activity feed logs event  

---

# 📊 Deal Stages Explanation (Support Agent Version)

REX should explain Deal Stages like this:

- **New** → “A new potential client conversation.”  
- **Discovery** → “You're learning about the role, pain points, budget.”  
- **Proposal** → “You’ve submitted your pitch, terms, agreement.”  
- **Negotiation** → “You and the client are finalizing pricing and scope.”  
- **Won** → “They signed! REQs + invoicing can begin.”  
- **Lost** → “The client did not move forward.”  

---

# 🔁 Automations Triggered by Deal Activity

When deals progress, these common actions are triggered:

### **Stage → Won**
- Notify team  
- Create REQs  
- Trigger onboarding workflow  
- Trigger invoice creation  
- Update revenue forecasts  

### **Stage → Lost**
- Add to “Lost Deals” table  
- Notify team  
- Trigger nurture workflow  

### **REQ Added to Opportunity**
- Update forecasts  
- Sync Job REQ + Opportunity  

### **Invoice Paid**
- Notify Super Admin  
- Trigger “Placed Candidate” revenue workflow  

---

# 🧪 Troubleshooting Opportunity Issues

### **“I can’t see the Opportunities tab.”**
Possibilities:
- User is not on Pro/Team plan  
- User is Member with restricted permissions  
- The workspace disabled Deals  

### **“I can’t create an Opportunity.”**
Check:
- Role = Member?  
  Members may need permission from Team Admin.  
- No Client attached?  
  (Opportunity must belong to a Client or create one during setup.)

### **“My Opportunity has no REQs.”**
Explain:
> “You’ll need to link your Job REQs. Go to the ‘Job REQs’ tab inside the Opportunity and click ‘Add REQ.’"

### **“Billing tab is missing.”**
Usually:
- Plan is Starter/Free  
- User is not a Team Admin  
- Billing disabled by Super Admin  

---

# 🚨 When REX Should Escalate a Ticket

REX must open a ticket if:
- Opportunites fail to load  
- Deals list shows incorrect data  
- Linking REQs to opportunity produces errors  
- Invoices won’t send  
- Revenue numbers do not match invoices  
- Stage movement triggers backend errors  
- Opportunity creation stuck at “Saving…”  
- Billing tab crashes  

Ticket must include:
- Opportunity ID  
- User ID  
- Workspace ID  
- Pipeline stage  
- Browser + device  
- URL  
- Error message  

Immediate Slack + email notification to Super Admin required.

---

# 👤 Related Files
- `clients.md`  
- `job-reqs.md`  
- `billing-invoicing.md`  
- `revenue-reporting.md`  
- `workflow-automation.md`  
- `leads.md`  


