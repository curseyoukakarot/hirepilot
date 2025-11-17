# Pipelines — Full Support Guide

pipelines.md

(Pipeline logic, stages, movement rules, troubleshooting, automation triggers)

## Purpose of This File

This file teaches REX how to:

- Explain what pipelines are in HirePilot  
- Describe how pipelines differ from REQs  
- Help users customize pipeline stages  
- Move candidates between stages  
- Explain automation triggers tied to stages  
- Troubleshoot stuck or missing candidates  
- Handle permissions & visibility issues  
- Escalate true pipeline bugs

---

# 🎯 What Is a Pipeline?

A Pipeline represents the **candidate journey** for a Job REQ.

It is:
- A visual Kanban-style board  
- A customizable set of stages  
- A structured workflow for candidate progression  
- A system that triggers automations  
- Connected to a specific REQ  

Each REQ has:
- Its **own pipeline instance**  
OR  
- A pipeline template applied to it  
(depending on workspace settings)

---

# 🧩 Default Pipeline Stages

Users can change order, rename, or hide stages, but the standard default stages are:

- **Sourced**  
- **Contacted**  
- **Interviewed**  
- **Offered**  
- **Hired**

REX must know:
> “These stages represent the full lifecycle of a candidate moving through your recruiting pipeline.”

---

# 🧭 How Pipelines Work

### Each stage contains candidates  
Candidates appear **inside** a stage based on:
- Manual movement  
- Automatic conversion rules  
- Workflow automations  

### Drag-and-Drop Movement  
Users can:
- Drag a candidate from one stage to another  
- Trigger an on-stage-change automation  
- Update candidate status  
- Log pipeline activity  

REX should guide users:
> “Drag the candidate into the next column — that will automatically update their stage and trigger any related automations.”

---

# 🔗 Relationship Between REQs and Pipelines

- **REQ = Job**  
- **Pipeline = Workflow for that job**  
- **Candidate = Person going through that workflow**

Pipeline is tied directly to a Job REQ.

Multiple REQs can use the same **pipeline template**, but each REQ keeps its own **separate instance** so movement doesn’t affect other roles.

---

# ⚙️ Customizing Pipeline Stages

Users can:
- Add new stages  
- Remove stages  
- Rename stages  
- Reorder stages  
- Restore defaults  

REX must guide users through:
1. Go to **Settings → Pipelines**  
2. Select a pipeline  
3. Modify stages  
4. Save changes  

### NOTE:
Changes apply to new REQs using the template, not existing REQs unless user enables “Apply changes to existing.”

---

# ⚡ Automation Triggers by Stage

REX MUST KNOW these:

## **When a candidate moves to Contacted**
- Trigger follow-up reminders  
- Log first outreach  
- Optional: send warm intro or template  

## **When a candidate moves to Interviewed**
- Trigger scheduling workflows  
- Add to Interview queue  
- Notify hiring manager(s)  

## **When a candidate moves to Offered**
- Trigger offer letter workflow  
- Notify client/hiring manager  
- Begin compensation negotiation  

## **When a candidate moves to Hired**
- Automatically finalize REQ  
- Trigger billing workflow  
- Push to Deals → Billing  
- Optionally: send “Congratulations” email  
- Notify admin  
- Log placement  

This stage is **VERY IMPORTANT** for revenue reporting.

---

# 🛠️ Troubleshooting Pipeline Issues (REX scripts)

## ❌ Problem: “Candidate isn’t showing in a stage”
REX should check:
- “Are you inside the correct REQ?”  
- “Did you accidentally archive this candidate?”  
- “Is the candidate filtered out by tags, source, or owner filter?”  
- “Do you have permission to access this REQ?”  
- “Is the REQ marked Closed or On Hold?”  

## ❌ Problem: “Pipeline not loading / appears blank”
Causes:
- Browser cache  
- Network latency  
- Large REQ with 200+ candidates  
- Database sync delay  
- User switched workspaces  
Solutions:
- Hard refresh  
- Check workspace dropdown  
- Filter to smaller subsets  

## ❌ Problem: “Candidate stuck between stages”
Possible reasons:
- Stage moved or deleted  
- Duplicate candidate  
- Backend validation error  
- Workflow rules blocking movement  
- Candidate missing required field  
Ask:
> “Did you recently update your pipeline stages?”
If YES → ask if stage was renamed/deleted.

## ❌ Problem: “Candidate won’t move when dragged”
Possible:
- Permission issue  
- REQ locked or closed  
- Candidate archived  
- Browser drag event blocked  
REX helps debug step-by-step.

## ❌ Problem: “Stages missing”
Causes:
- User switched pipeline templates  
- Workspace admin changed templates  
- Stages hidden by filter  
Guide:
**Settings → Pipelines → Edit template**

## ❌ Problem: “Pipeline automations not triggering”
Check:
- Automation enabled?  
- Stage matches automation logic?  
- Candidate assigned to REQ?  
- Candidate actually moved (not dragged to same stage)?  
If automation works for some users but not others → permissions/ownership issue.

---

# 🧠 REX Conversational Helpers

### Helping a user modify stages:
> “Go to Settings → Pipelines → Edit. You can drag to reorder or click a stage to rename it.”

### Helping move a candidate:
> “Open the REQ pipeline, then drag the candidate card into Interviewed. This will automatically update their status.”

### Helping understand pipeline logic:
> “Pipelines reflect where each candidate is in the hiring process — they help you track progress visually and trigger automations automatically.”

---

# 🚨 When REX Must Escalate a Ticket

Escalate if:
- Pipeline fails to load for ANY REQ  
- Stages appear duplicated or order resets  
- Template changes not applying correctly  
- Candidate cards disappear fully  
- Automations tied to stages not firing  
- Stage movement returns error codes  
- Adding/removing stages returns 500 errors  
- Candidate shows in two stages at once  
- REQ pipeline appears corrupted  

Ticket must include:
- REQ ID  
- Pipeline template ID  
- Candidate ID (if relevant)  
- Workspace ID  
- Stage structure before change  
- Stage structure after change  
- Any related error logs  

---

# 👤 Related Files
- `job-reqs.md`  
- `candidates.md`  
- `candidates-add.md`  
- `workflows-automation.md`  
- `deals.md`  
- `errors-and-troubleshooting.md`


