# Campaigns in HirePilot

campaigns.md

(Outreach, Sequences, Sending, Replies, Deliverability & Troubleshooting)

## Who this is for
Users who want to send outreach, run recruiting sequences, follow up with leads, or understand how replies convert into Candidates, Deals, or Opportunities.

REX uses this file to:
- Walk users through creating campaigns step-by-step
- Explain how sending works
- Troubleshoot email issues
- Help users understand reply classification
- Convert replies into Candidates
- Guide users on warm-up, sending limits, and deliverability best practices

---

# 📣 What Is a Campaign?

A **Campaign** is an automated or semi-automated sequence of messages sent to Leads.

Campaigns are used for:
- Recruiting outreach  
- Client acquisition  
- Pipeline activation  
- Follow-up sequences  
- Nurture loops  
- Warmup messaging  
- announcements or marketing  

Each Campaign includes:
- Audience (Leads)  
- Email sequence (multi-step)  
- Sending schedule  
- Daily limits  
- Reply detection  
- Automatic classification  
- Conversion logic (Lead → Candidate or Lead → Client)  
- Fail-safes and safety limits  

---

# 🎯 Campaign Types

### **1. Simple Campaigns**
1–5 emails, typically for recruiting outreach or client acquisition.

### **2. Multi-Step Sequences**
Advanced sequences with:
- Delays  
- Conditions  
- Automatic follow-ups  
- Tags  

### **3. REX-Assisted Campaigns**
REX generates message content and personalizations.

### **4. Job-Specific Campaigns**
Tied to a Job REQ to source candidates for that specific role.

---

# 🧱 Anatomy of a Campaign

### **1. Campaign Overview**
- Campaign name  
- Owner  
- Status (Draft / Running / Paused / Completed)  
- Daily sending limit  
- Reply settings  
- Lead list  

### **2. Audience Section**
Where users:
- Add leads  
- Remove leads  
- Filter lists  
- Import CSVs  

### **3. Sequence Builder**
Build, reorder, or edit emails:
- Step 1 → Intro  
- Step 2 → Follow-up  
- Step 3 → Bump message  
- Step 4 → Breakup email  

### **4. Settings / Send Controls**
- Daily sending limit  
- Gmail/Outlook protection  
- Send window  
- Tracking options  
- Safety checks  

### **5. Results Dashboard**
Shows:
- Sends  
- Opens  
- Clicks  
- Replies  
- Positive / neutral / negative classifications  
- Conversions  
- Bounces  

---

# 🧰 How to Create a Campaign (Step-by-Step)

REX should guide users conversationally:

### **1. Go to Campaigns**
Left sidebar → **Campaigns**

### **2. Click “New Campaign”**

### **3. Name the Campaign**
Something meaningful:
- “VP Sales Candidates – March”
- “Austin Client Prospects”
- “2025 Product Managers”

### **4. Add Leads**
Options:
- Select from lead list  
- Filter (tags, locations, roles)  
- Import CSV  
- Add from Chrome extension  
- Add from Apollo search  

### **5. Build Your Sequence**
Each step includes:
- Subject line  
- Message body  
- Variables  
- Delay logic  
- Personalization  

REX should offer optimizations if asked.

### **6. Configure Sending**
- Daily limit  
- Start date/time  
- Send window (e.g., 8am–5pm)  
- Throttling rules  
- Safety checks  

### **7. Launch Campaign**
Campaign begins sending at the next scheduled window.

---

# 💬 How Replies Work (Critical for REX)

All replies go through **REX’s intent classifier**, which categorizes them:

### **Positive / Interested**
→ Convert Lead → Candidate  
→ Assign to Job REQ (optional)  

### **Neutral / Needs Info**
→ User can respond manually  
→ REX can draft follow-ups  

### **Not Interested**
→ Lead marked as “Not Interested”  
→ Stop future sends  

### **Not Now**
→ Add tag “Follow up later”  

### **Objection / Concern**
→ REX provides recommended follow-up response  

### **Out of Office**
→ Auto-delay next step  

### **Spam / Bounce**
→ Move to “Invalid Leads”  
→ Stop campaign delivery  

This classification is crucial for automation reliability.

---

# 🧠 Lead → Candidate Conversion Logic

When a reply indicates **interest**:
1. Create Candidate profile  
2. Pull enriched data  
3. Prompt user:  
   “Would you like to assign this Candidate to a Job REQ?”  
4. Log thread in the activity timeline  

---

# 📧 How Email Sending Works

Sending uses:
- Gmail or Outlook integration  
- OAuth authentication  
- Per-user sending limits  
- Safety throttles  
- SendGrid backend events (deliveries, opens, bounces)

### 🚫 No credits used for email sending
Email sending is **free** and unlimited (within provider limits).

---

# 🛡️ Safe Sending & Limits

To avoid spam flags:
- Gmail recommended: 150–200/day  
- Outlook recommended: 150–200/day  
- If new domain: start with 30–50/day  
- REX automatically slows sending if:  
  - bounce rate spikes  
  - spam filters triggered  
  - throttling events occur  

REX should always warn users:
> “To protect your domain, I’m slowing sending to keep your account safe.”

---

# 🧪 Troubleshooting Campaign Issues

### **“Emails are not sending.”**
Ask:
- Is Gmail/Outlook connected?  
- Does user see “Reconnect Email” banner?  
- Has user hit daily limit?  
- Sending window set incorrectly?  
- Sequence scheduled for the future?  

---

### **“Leads aren’t being added to the Campaign.”**
Check:
- Lead filters  
- Tag mismatch  
- Empty list  
- Lead archived  
- Wrong workspace  

---

### **“Sequences aren’t sending step 2 and beyond.”**
Likely:
- Step delay too long  
- Reply already classified  
- Sequence paused  
- Hard bounce  
- User paused campaign  

---

### **“Replies are not being detected.”**
Possible:
- Gmail/Outlook disconnected  
- SendGrid events delayed  
- Reply came from different email address  
- SPF/DKIM not set  

---

### **“My open/click tracking isn’t accurate.”**
Explain:
> “Open data is never 100% reliable due to Apple Mail Privacy Protection and other privacy features. Use replies and conversions as your main metric.”

---

# 🚨 When REX Should Escalate a Ticket

Escalate when:
- Campaigns stuck in “Scheduled”  
- Sends freeze mid-day  
- Replies not showing  
- Reply classification incorrect repeatedly  
- Lead → Candidate conversion fails  
- Gmail/Outlook OAuth errors  
- SendGrid event webhook failures  
- 500 or 404 errors appear in campaign log  
- Bounces not logging correctly  
- Sequence builder crashes  

Ticket should include:
- User ID  
- Workspace ID  
- Campaign ID  
- Email provider  
- Time window  
- Error codes  

Slack + email must notify Super Admin immediately.

---

# 👤 Related Files
- `leads.md`  
- `candidates.md`  
- `gmail-outlook-integration.md`  
- `sendgrid-events.md`  
- `workflows-automation.md`  
- `chrome-extension.md`  


