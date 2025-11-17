# Campaign Wizard (v2) — Full Support & Troubleshooting Guide

campaign-wizard.md

(Campaign creation, sequence logic, send logic, scheduling, troubleshooting)

## Purpose of This File

This file teaches REX how to:

- Walk users through the full campaign creation flow  
- Explain every setting in the wizard  
- Help choose templates  
- Debug issues  
- Explain deliverability and throttling logic  
- Handle scheduling conflicts  
- Validate email provider connection  
- Recommend best practices  
- Detect common mistakes  
- Trigger ticket escalation for true errors  

---

# 🎯 Overview: What Is the Campaign Wizard?

The Campaign Wizard helps users create and launch multi-step outreach sequences using:

- Gmail  
- Outlook  
- HirePilot Mail (SendGrid)  

Campaigns can target:

- Leads  
- Candidates  
- Contacts  
- Custom tables  

A campaign includes:

- Target list  
- Email sequence  
- Wait times  
- Personalization variables  
- Optional conditional logic  

---

# 🧭 Step-by-Step Wizard Flow (REX MUST KNOW ALL STEPS)

REX should walk a user through the wizard conversationally like this:

---

## **Step 1 — Choose Campaign Type**

Options:

- Lead Outreach  
- Candidate Follow-Up  
- Client Prospecting  
- Custom Contacts  

Each type enables different templates.

---

## **Step 2 — Name the Campaign**

REX should encourage:

- Clear name  
- Optional tags  
- Internal-only notes  

Suggested phrase:

> “Choose a name that makes sense when you look back—like ‘VP Sales Outreach – Week of Nov 3’.”

---

## **Step 3 — Choose Target Leads**

User can:

- Select existing leads  
- Upload CSV  
- Pull from Apollo  
- Pull from a Table  
- Filter leads (status, tags, seniority, source)  

REX must ensure:

- No duplicates  
- No invalid emails  
- No leads missing required variables  

---

## **Step 4 — Build the Sequence**

Sequence builder includes:

- Step 1: Email  
- Step 2: Wait X days  
- Step 3: Email  
- Step 4: Email  
- Step 5+: Add more steps  

Supported step types:

- Email  
- Wait  
- Conditional branch *(coming in future)*  

---

## **Step 5 — Editing Messages**

REX should know:

- Templates can be applied  
- Variables auto-highlight mismatches  
- Error shown if variable unused  

Available Variables:

- {{first_name}}  
- {{last_name}}  
- {{company}}  
- {{role}}  
- {{source}}  
- {{my_name}}  
- {{my_company}}  
- {{my_link}}  

Variables fail if:

- Lead missing data  
- Extra whitespace  
- Misspelled variable (REX must correct this automatically)  

---

## **Step 6 — Scheduling Sending Window**

User can set:

- Daily send limit  
- Send start time  
- Send end time  
- Timezone  
- Days of week  

REX must explain:

> “Campaigns follow your timezone and will only send during your selected windows.”

---

# 📤 Sending Logic (How HirePilot Sends)

When campaign starts:

1. Campaign enters queue  
2. System sends emails at safe intervals (4–9 seconds apart by default)  
3. Stops automatically when:  
   - Lead replies  
   - Email bounces  
   - User manually stops the campaign  
4. Logs each message event  
5. Threads emails under the same Gmail/Outlook conversation  

---

# ⚡ Auto-Stop Rules (Critical for REX)

Sequence stops when:

- Lead replies (classified as any type except Out-of-Office).  
- Lead marked as Invalid  
- Lead marked Not Interested  
- Sequence error occurs  

User can override these rules manually.

---

# 📈 Deliverability Guardrails

To protect domain reputation, HirePilot:

- Limits send frequency  
- Enforces daily max send  
- Pauses sending for:

  - Too many bounces  
  - Too many spam reports  
  - Repeated sends failing  

- Uses warm-up logic if needed  

REX must be able to tell users:

> “HirePilot will automatically slow down your outreach if your domain is at risk.”

---

# 🧪 Preview Mode

REX must walk users through:

- Preview each message  
- Preview with lead-specific variables  
- Preview actual subject + body  
- Preview sending schedule  
- Preview classification rules  

If something is missing:

> “This preview shows which lead is missing {{company}}. We can fix that now.”

---

# 🆘 Troubleshooting Scenarios (REX MUST USE THESE)

---

## ❌ “Campaign will not send”

Possible causes:

- Email provider disconnected  
- Send window not active  
- User scheduled campaign in the future  
- All leads missing required variables  
- Campaign paused  
- User hit daily send limit  

REX must ask:

- “Are you connected to Gmail/Outlook?”  
- “Is your send window active right now?”  
- “Are all your leads valid?”  

---

## ❌ “Emails not threading”

Cause:

- Gmail alias mismatch  
- Subject modified incorrectly  
- Reply-to domain mismatch  

REX should suggest:

- Keep subject line same  
- Avoid emojis in subject  
- Ensure Gmail alias matches account  

---

## ❌ “Messages sending too slowly”

Cause:

- Domain warm-up  
- Reputation protection  
- Provider throttling  
- High bounce rate  

REX must reassure:

> “HirePilot slows down messages temporarily to protect your sending reputation.”

---

## ❌ “Template variables aren’t populating”

Cause:

- Missing lead data  
- Incorrect variable syntax  
- Hidden characters (copy/paste)  

REX should:

- Show user which lead is missing the field  
- Auto-correct variable syntax  

---

## ❌ “Email soft bounced”

Cause:

- Inbox full  
- Temporary server issue  
- Spam filtering  

REX should say:

> “Soft bounces are temporary—HirePilot will retry sending automatically.”

---

## ❌ “Email hard bounced”

Cause:

- Invalid email  
- Domain no longer active  

Action:

- Tag lead `Invalid`  
- Recommend finding a new email  
- Adjust campaign list  

---

## ❌ “Campaign stuck on ‘Processing’”

Cause:

- Background worker congestion  
- Sequence stalled due to error  
- User hit sending cap  

REX should:

- Ask user to wait 15 min  
- If still stuck → escalate a ticket  

---

# 🤖 REX-Specific Assistance

REX should:

- Help write email templates  
- Create objection handling  
- Create personalization  
- Suggest sequence improvements  
- Optimize subject lines  
- Restructure messaging based on persona  

Example answers:

> “Would you like a 3-step sequence or a 5-step?”  
> “Should I write messages tailored for CFOs?”  
> “Let’s personalize step 1 based on the prospect’s LinkedIn headline.”  

---

# 🚨 When REX Should Escalate to Engineering

A ticket is REQUIRED when:

- Campaigns fail to start for more than 10 minutes  
- Gmail/Outlook webhooks fail  
- Thread IDs mismatched  
- Emails not being logged  
- Multiple users reporting missing send logs  
- SendGrid metadata not mapping to leads  
- Errors 400, 403, 500 appear in logs  

Ticket must include:

- Campaign ID  
- Workspace ID  
- User ID  
- Template content  
- Error log  
- Provider (Gmail/Outlook/SendGrid)  
- Time of failure  

---

# 👤 Related Files

- `leads.md`  
- `classification.md`  
- `gmail-outlook-integration.md`  
- `deliverability.md`  
- `sendgrid-events.md`  
- `automation-workflows.md`  
- `errors-and-troubleshooting.md`


