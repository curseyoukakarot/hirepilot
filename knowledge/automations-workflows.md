# HirePilot Automations Workflow Engine  

automations-workflows.md

(Triggers → Conditions → Actions, REX Automations, Zapier/Make flows, error states, limits, and debugging)

### Internal Documentation for REX (Support Agent)

---

## 🎯 Purpose  

This file trains REX to fully understand the automation engine used across HirePilot:

- REX-native workflows  
- Pipeline-triggered automations  
- Candidate-triggered automations  
- Deal/Billing triggers  
- Sniper / LinkedIn automation triggers  
- Email & messaging triggers  
- Zapier / Make.com integrations  
- Trigger → Condition → Action logic  
- Retry logic  
- Logging  
- Escalation requirements  

This enables REX to:  
- Explain how workflows function  
- Diagnose automation failures  
- Suggest best practices  
- Generate or modify automations for users conversationally  
- Trigger appropriate tools (MCP) to fix or create workflows  
- Decide when to escalate issues  

---

# 🧠 What Is an Automation in HirePilot?

Automations = If THIS happens → THEN do THAT.

HirePilot supports three layers:

## 1) REX Automations (internal AI engine)
Server-run, credit-aware, deeply integrated.

Examples:
- Auto-source leads every Monday  
- Auto-send LinkedIn connection requests  
- Auto-enrich new leads  
- Auto-screen candidates  
- Auto-assign job applications  
- Auto-reject non-qualified candidates  
- Auto-notify recruiter in Slack  

## 2) Workflow Builder (user-facing)
Visual builder where users set: Trigger → Conditions → Actions

Example:  
Trigger: Candidate rejected  
Action: Send nurture email + add to “Not a fit for now” table

## 3) External Integrations (Zapier + Make.com)
Webhooks, zap_events, outbound triggers, and two-way flows.

---

# 🔥 Triggers (What Starts a Workflow)

Master list of supported triggers:

## Leads & Candidates
- Lead created / enriched / converted / responded  
- Candidate created / updated / tagged / interviewed / offered / hired / rejected  
- Application submitted  

## Pipeline & Job REQs
- Candidate moved to stage  
- Pipeline stage updated  
- Job REQ created / updated / closed  

## Messaging
- Message sent  
- Message reply received  
- Email bounced  

## Deals & Billing
- New client added  
- Opportunity created  
- Opportunity stage changed  
- Invoice created / paid / overdue  

## REX / Sniper / Extension
- Sniper search completed  
- Sniper enrichment completed  
- Bulk scrape completed  
- Connection requests completed  
- Chrome extension scrape finished  

## User Activity
- User signed up / completed onboarding  
- Chrome extension installed  
- CSV imported  

---

# 🧩 Conditions (Optional Logic Layer)

Refine triggers with rules like:
- Seniority = “Senior”  
- Pipeline stage = “Interview”  
- Lead source = “LinkedIn Navigator”  
- Enrichment score > 60  
- Company headcount > 1000  
- Email reply contains “interested”  
- Trial user / plan = Pro or Team  

REX should help design conditions conversationally and validate them against data fields.

---

# ⚡ Actions (What Happens After Trigger)

## Email & Messaging
- Send email / follow-up / nurture / rejection  
- Notify via Slack / email / hiring manager / team admin  

## Lead/Candidate Data
- Update pipeline stage  
- Add tag  
- Assign recruiter  
- Add to Table  
- Update Job REQ field  
- Convert lead to candidate  

## Automation Control
- Delay X hours/days  
- Wait for reply  
- Re-check condition  
- Stop / restart workflow  

## Sniper Actions
- Run Sales Navigator scraper  
- Send LinkedIn connection requests  
- Run enrichment cycle  
- Scrape job leads  

## REX Agent Actions
- Generate outreach message  
- Draft candidate summary  
- Summarize email thread  
- Screen applicant  
- Categorize lead  
- Extract skills from resume  

## Deal & Billing
- Create invoice  
- Send invoice  
- Update opportunity stage  
- Add revenue  
- Mark invoice as paid  

---

# 🧠 Automation Flow Logic

General structure:  
Trigger → Conditions (optional) → Actions → Delays/Waits (optional) → Output Events (zap_event)

Every automation creates logs containing:
- Trigger event & payload  
- Matched conditions (truth table)  
- Actions taken (with results)  
- Success/failure state  
- Timestamps and durations  

REX must reference logs when diagnosing failures.

---

# 🩻 Troubleshooting Automations

## “My automation didn’t fire.”
Check: trigger emitted? automation enabled? conditions too strict? plan limits exceeded? Sniper limits? workflow paused?  
Ask: “When did the event occur and which object (lead/candidate/etc.) was targeted?”  
Verify: pipeline edits after creation may break stage-based triggers.

## “Automation ran more than once.”
Causes: duplicate events; firing on every stage update; Zapier loop; overlapping automations; self-retrigger.  
Fix: add `previous_stage != new_stage`; `run_once_per_object` guard; de-duplicate triggers; refactor workflows.

## “Sniper automation failed.”
Look for: LinkedIn throttling (429), invalid cookies, Browserless failure, proxy flagged, daily limit exceeded, missing credits.  
Check: Sniper logs, proxy health, credit balance, Remote Session status.

## “Nurture email didn’t send.”
Check: SendGrid errors, verified sender, template mapping, unsubscribed status, bounces/suppressions.

## “Automations delayed.”
Causes: queue congestion, heavy Sniper runs, rate limiting, batch jobs.  
Fix: adjust schedules; split queues; monitor system status.

---

# 🧩 Zapier & Make.com (External Automations)

Exposed zap_events (examples, not exhaustive):
- lead_converted, lead_enriched, lead_sourced, lead_responded  
- candidate_created, candidate_updated, candidate_tagged  
- pipeline_stage_updated, candidate_interviewed, candidate_offered, candidate_hired, candidate_rejected  
- pipeline_created  
- message_sent, message_reply, email_bounced  
- calendar_scheduled  

Use cases:
- CRM sync, Google Sheets logs, Slack notifications, Monday.com workflows, billing automations, client notifications.

REX should generate step-by-step instructions for users to connect Zaps/Scenarios, send test events, and map fields.

---

# 💡 REX Conversational Examples

Building a workflow:
> “Great—what should trigger it? For example, ‘candidate moved to Interview’ or ‘lead responded’.”

Troubleshooting:
> “Your conditions filtered the event out—want me to help rewrite them?”

Nurture sequences:
> “We can build a nurture workflow that sends staged follow-ups automatically.”

Automate sourcing:
> “Let’s set a REX Automation to source leads every Monday and add them to a new campaign.”

---

# 🚨 Escalation Scenarios

Escalate immediately if:
- Workflow stuck in loop  
- Billing/Stripe linked to misfires  
- Sniper proxies repeatedly failing  
- Workflow corruption (missing trigger/action)  
- Server not emitting events  
- Zapier receiving no triggers (global)  
- Make receiving malformed payloads (global)  
- Candidate pipeline corruption  

Ticket must include:
- Workflow ID  
- Trigger, conditions, actions  
- Object ID (lead/candidate/etc.)  
- Relevant logs and timestamps  
- Workspace ID and user context  

---

# 🔗 Related Files  

- `rex-tools.md`  
- `messaging.md`  
- `pipelines.md`  
- `sniper-settings.md`  
- `zapier-make-automations.md`  

