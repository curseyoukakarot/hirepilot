# Message Classification & Intent Detection

message-classification.md

(Reply Detection, Intent Categories, Conversions & Troubleshooting)

## Who this is for
Users asking why replies are (or aren't) being classified, what each category means, why a lead wasn't converted, or how to adjust follow-ups.

REX uses this file to:
- Explain how reply detection works
- Interpret user replies
- Classify responses
- Convert leads into candidates or clients
- Trigger follow-ups or automations
- Troubleshoot misclassifications

---

# 💬 What Is Message Classification?

Whenever a lead replies to a campaign:

1. Gmail/Outlook sends metadata → HirePilot  
2. SendGrid confirms deliverability  
3. HirePilot fetches the thread  
4. Classification model analyzes content  
5. Reply is tagged with an **intent category**

Classification determines:
- Whether to convert a Lead → Candidate  
- Whether to stop the campaign  
- What follow-up REX should suggest  
- Whether workflows should trigger  
- Whether user needs to be notified immediately  

---

# 🧠 The Core Intent Categories

HirePilot uses **8 primary classifications**.  
REX should always interpret replies through these.

## **1. Interested (Positive Reply)**  
**Meaning:**  
Lead expressed strong interest in the opportunity, role, or service.

**Examples:**  
- “Yes, I’m interested.”  
- “Tell me more.”  
- “This looks great.”  
- “Can we set up a call?”  

**Actions:**  
- Convert Lead → Candidate  
- Assign to REQ (optional prompt)  
- Notify user immediately  
- Pause future outreach  

---

## **2. Soft Interested (Neutral-Positive)**  
**Meaning:**  
Lead is curious but needs more info.

**Examples:**  
- “Who is the company?”  
- “What’s the salary?”  
- “What’s the job location?”  

**Actions:**  
- Draft follow-up  
- Keep lead active  
- Do **NOT** convert yet  
- REX should offer to reply with details  

---

## **3. Not Interested (Negative)**  
**Meaning:**  
Lead declines politely.

**Examples:**  
- “Not looking right now.”  
- “No thanks.”  
- “I’m happy in my current role.”  

**Actions:**  
- Mark lead “Not Interested”  
- Stop all sequences  
- Offer to add tag “Follow up in 3–6 months”  

---

## **4. Not Now (Future Opportunity)**  
**Meaning:**  
Candidate open later.

**Examples:**  
- “Circle back next quarter.”  
- “Contact me in a few months.”  

**Actions:**  
- Tag: `follow-up-later`  
- Add a follow-up reminder workflow  
- Pause or remove from current sequence  

---

## **5. Objection / Concern**  
**Meaning:**  
Lead has a blocker but not a rejection.

**Examples:**  
- “Comp is too low.”  
- “Remote only?”  
- “Not sure about the company size.”  

**Actions:**  
- REX writes objection-handling reply  
- Keep them in pipeline  
- Do not stop the sequence unless user requests  

---

## **6. Out of Office / Auto-Responder**  
**Meaning:**  
Email system reply.

**Examples:**  
- “I’m out until Monday.”  
- “Autoresponder: vacation.”  

**Actions:**  
- Delay next step  
- Do not convert  
- Do not tag  

---

## **7. Bounce / Invalid Email**  
**Meaning:**  
Email failed.

**Examples:**  
- “550 No such user”  
- “Email address does not exist”  

**Actions:**  
- Mark lead `Invalid`  
- Remove from campaign  
- Reduce sending volume to protect reputation  

---

## **8. Unclear / Needs Manual Review**  
**Meaning:**  
Model is not completely confident.

**Examples:**  
- Gibberish  
- One-word responses (“Okay”)  
- Ambiguous statements  

**Actions:**  
- Ask user for help  
- Do not convert  
- REX asks:  
  > “How would you like to classify this reply?”  

---

# 🔁 How Classification Triggers Automation

REX should understand these built-in triggers:

### **Interested → Convert Lead → Candidate**
- Create Candidate record  
- Pull enrichment  
- Ask user to assign to REQ  
- Stop campaign  
- Start workflow (if configured)  

### **Not Interested → Stop Campaign**
- Mark lead as “Not Interested”  
- Log reason  
- REX suggests “Should I archive this lead?”  

### **Out of Office → Delay Sequence**
- Push next step by 3–7 days  

### **Objection → Draft Follow-Up**
- Provide personalized response templates  

### **Future Follow-Up → Add Reminder**
- Use Workflow or Manual reminder  

---

# 💡 REX Explaining the Process (Suggested Script)

> “When someone replies, HirePilot reads the message, classifies their intent, and triggers the correct next step.  
> If they’re interested, we convert them to a Candidate.  
> If they’re not, we stop outreach so you don’t annoy them.  
> This keeps your sending reputation safe and your pipeline clean.”

---

# 🧪 Troubleshooting Classification Issues

### **“Replies aren’t being classified.”**
Ask user:
- Is Gmail/Outlook connected?  
- Any “Reconnect email” warnings?  
- Was the reply from a different email address (alias)?  
- Does the reply appear inside the campaign thread?  
- Are SendGrid events flowing?  

### **“Lead didn’t convert even though reply was interested.”**
Possible:
- Missing required fields  
- Classification confidence below threshold  
- Candidate creation error  
- Enrichment failed  
- OAuth latency  

### **“Wrong classification category.”**
REX should ask:
> “Would you like me to reclassify this reply?”

Then:
- Update classification  
- Trigger appropriate action  
- Correct future model weight (internal)  

### **“Replies show in Gmail but not in HirePilot.”**
Possible:
- Gmail metadata blocked  
- Microsoft OAuth token expired  
- Threading mismatch  
- Reply was sent from mobile alias  
- Webhook delay  

### **“Classification disappears or resets.”**
Usually:
- Multiple workspace tabs open  
- User manually changed status  
- Sync delay  
- Background job timeout  

---

# 🚨 When REX Should Escalate a Ticket

REX must create a ticket if:
- Classification repeatedly wrong for same user  
- Replies missing for > 2 hours  
- Lead → Candidate conversion error persists  
- Reply webhook failing (SendGrid)  
- OAuth metadata not being received  
- Classification service unreachable  
- Errors like 400/403/500 appear in timeline  
- Multiple leads showing incorrect classifications  

Ticket includes:
- Lead ID  
- Campaign ID  
- User ID  
- Workspace ID  
- Email provider  
- Reply body (sanitized)  
- Classification output  
- Timestamps  

Slack + email alert to Super Admin required.

---

# 👤 Related Files
- `campaigns.md`  
- `gmail-outlook-integration.md`  
- `sendgrid-events.md`  
- `candidates.md`  
- `leads.md`  
- `workflows-automation.md`  


