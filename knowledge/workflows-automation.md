# Workflows & Automations — Full Support Guide

workflows-automation.md

(Triggers, actions, conditions, sequences, and troubleshooting)

## Purpose of This File

This guide teaches REX how to:

- Explain what workflows do  
- Help users create automations step-by-step  
- Understand every Trigger type  
- Understand every Action type  
- Handle conditions  
- Diagnose broken workflows  
- Identify failed triggers  
- Help users build powerful recruiting workflows  
- Know when to escalate issues  

This file is ESSENTIAL for the Support Agent.

---

# 🎯 What Are Workflows?

Workflows automate tasks inside HirePilot.

They run when specific **events** occur, such as:

- A lead gets added  
- A reply is received  
- A candidate changes stage  
- A REQ is created  
- A deal is updated  
- A contact fills out a form  
- REX enrichment completes  
- Billing activity occurs  

Workflows can:

- Send Slack notifications  
- Send email notifications  
- Create tasks  
- Create deals  
- Move candidates  
- Update lead/candidate fields  
- Trigger follow-ups  
- Update pipeline stages  
- Trigger Zapier / Make.com webhooks  

---

# 🧩 Workflow Structure

Each workflow contains:

1. **TRIGGER**  
   - What event starts the automation?

2. **CONDITIONS** (optional)  
   - Should this workflow run for ALL events or only some cases?

3. **ACTIONS**  
   - What should happen when triggered?

4. **RUN HISTORY**  
   - Shows success/failure logs  

REX must guide users through all four parts.

---

# 🧠 Trigger Types (REX must understand all)

Here are the main triggers with explanations.

## **1. Lead Created**
Use Cases:
- Notify team when a new lead is added  
- Run enrichment  
- Assign tags  
- Send welcome sequence  

## **2. Lead Reply Received**
Use Cases:
- Stop campaigns  
- Convert lead → candidate  
- Notify recruiter  
- Add tags  
- Trigger voicemail task  
- Kick off qualification  
REX must confirm classification before conversion.

## **3. Candidate Created**
Use Cases:
- Assign to default REQ  
- Assign default pipeline stage  
- Notify hiring manager  
- Trigger enrichment  

## **4. Candidate Stage Updated**
Use Cases:
- When candidate moves to “Interviewed,” send scheduling link  
- When candidate moves to “Offered,” email hiring manager  
- When candidate becomes “Hired,” trigger billing  

## **5. Job REQ Created**
Use Cases:
- Trigger client-intake sequence  
- Notify team  
- Kick off candidate sourcing  
- Create companion Deal  

## **6. Deal Updated**
Use Cases:
- When deal moves to “Signed,” notify recruiters  
- When invoice is paid, move deal to “Closed”  
- When client becomes active, assign onboarding tasks  

## **7. Form Submitted**
Use Cases:
- Add to table  
- Convert to lead or candidate  
- Notify Slack  
- Send confirmation email  

## **8. Custom Date Triggers (Scheduled)**
Use Cases:
- Reminders  
- Follow-up tasks  
- Recurring check-ins  

## **9. REX Agent Triggers**
Use Cases:
- After enrichment  
- After scraping  
- After Sniper Actions  
- After LinkedIn connection request  

---

# ⚙️ Action Types (REX must understand them all)

## **1. Send Slack Notification**
Content can include variables:
- {{first_name}}  
- {{job_title}}  
- {{candidate_stage}}  
- {{lead_source}}  

## **2. Send Email Notification**
For:
- Recruiters  
- Hiring managers  
- Clients  
- Candidates  

## **3. Create Task**
Tasks can attach to:
- Leads  
- Candidates  
- REQs  
- Deals  
- Workspaces  

## **4. Update Field**
Supports:
- Name fields  
- Tags  
- Custom fields  
- Enrichment fields  
- Status fields  

## **5. Move Candidate Stage**
Automatically pushes a candidate to:
- Sourced  
- Contacted  
- Interviewed  
- Offered  
- Hired  

## **6. Convert Lead → Candidate**
Triggered when:
- Reply classification = Interested  
- Campaign tied to REQ  

## **7. Create Deal**
Used for:
- New client creation  
- Retainers  
- Contingency pipeline  

## **8. Trigger Zapier / Make.com Webhook**
Sends:
- Lead  
- Candidate  
- Deal  
- Lookup data  
- Workspace metadata  

## **9. Add to Table**
When paired with Forms, workflows can:
- Append rows  
- Update existing entries  

---

# 🧭 Building a Workflow (REX step-by-step)

REX must guide users:

### Step 1: Create Workflow  
Go to:  
**Automations → Create Workflow**

### Step 2: Choose Trigger  
Ask user clarifying question:
> “Should this run when a lead replies, when a candidate changes stage, or something else?”

### Step 3: Add Conditions (optional)  
Example:
- Only run for Job REQ = “VP Sales”  
- Only run if Stage = “Offered”  
- Only run if tag contains “Enterprise”  

### Step 4: Add Actions  
REX must help choose correct ones.

### Step 5: Test Workflow  
REX can:
- Simulate trigger  
- Check expected output  

---

# 🛠️ Troubleshooting Workflows (REX scripts)

## ❌ “Workflow didn’t fire”
REX must check:
- Was the trigger actually activated?  
- Did conditions block the workflow?  
- Did the user sequentially move candidate to same stage?  
- Did REQ assignment mismatch?  
- Did Slack or email fail?  

## ❌ “Workflow fired multiple times”
Usually:
- User moved candidate back and forth  
- Multiple triggers overlap  
- Automation created infinite loop (rare)  
Ask:
> “Did you move a candidate rapidly between stages?”

## ❌ “Slack notification not sending”
Check:
- Slack workspace connected?  
- Channel selected?  
- Bot permissions updated?  
- Text content valid?  

## ❌ “Email action not running”
Check:
- Email provider connected?  
- Recipient valid?  
- Blocked by conditions?  

## ❌ “Deal not created”
Possible:
- Missing fields  
- Invalid pipeline  
- Workspace permissions  

## ❌ “Webhook to Zapier failed”
Check:
- Invalid URL  
- Zap not exposed publicly  
- Zap expecting different payload  

---

# 🧠 REX Conversational Guidance Examples

### Helping user create a workflow:
> “Let’s start by choosing your trigger. Should this happen when a candidate replies, or when they move into a new stage?”

### Helping fix a broken workflow:
> “Your workflow didn’t run because the candidate wasn’t assigned to a REQ. Let’s link them and test again.”

### Helping optimize automations:
> “We can add a condition to only message candidates in the ‘Interviewed’ stage if you want.”

---

# 🚨 When REX Must Escalate a Support Ticket

Escalate if:
- Workflows not firing for multiple users  
- Entire automation system down  
- Stage-change triggers failing globally  
- Webhook response errors (500-level)  
- Duplicate or repeated workflow behaviors  
- Automations stuck in retry loop  
- Candidate movement automation corrupt  
- Deal workflows failing  
- Slack or email actions break for all users  

Ticket must include:
- Workflow ID  
- Workspace ID  
- Trigger details  
- Action details  
- Logs from last run  
- Candidate/Lead IDs involved  
- REQ ID  
- Any payloads  
- Time of failure  

---

# 👤 Related Files

- `campaign-wizard.md`  
- `classification.md`  
- `pipelines.md`  
- `job-reqs.md`  
- `candidates.md`  
- `sendgrid-events.md`  
- `errors-and-troubleshooting.md`

⸻

