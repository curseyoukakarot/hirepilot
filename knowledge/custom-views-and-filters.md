# Custom Views & Filters in HirePilot  

custom-views-and-filters.md

(Filters, saved views, shared views, troubleshooting visibility issues)

### Everything REX Needs to Support Users

---

## 🎯 Purpose of This File  

This file teaches REX how to help users:

- Filter data inside any table  
- Build custom saved views  
- Fix “missing data” caused by filters  
- Understand visibility rules  
- Explain why team members see different views  
- Diagnose custom view issues  
- Reset filters when data disappears  
- Use shared views with collaborators  
- Troubleshoot “results look wrong” scenarios  

Custom views + filters exist in:

- Leads  
- Candidates  
- Job REQs  
- Deals/Opportunities  
- Billing  
- Campaigns  
- Activity logs  
- Tables (custom tables)  

They follow the same logic everywhere.

---

# 🧩 Core Concepts

## 1) Filters
Narrow data by:
- Status, stage, owner, tag, source  
- Date range, Job REQ, deal stage  
- Seniority, company size, credits used  
- Module-specific fields  

## 2) Sorts
Sort by:
- Created date, name, last contacted  
- Stage, activity, priority (module-specific)  

## 3) Saved Views
Save any combination of:
- Filters, sorts, columns, search  
Properties:
- Private by default; can be shared  
- Can be set as user default  

## 4) Shared Views
Admins/owners share views with:
- Team members  
- Collaborators (limited)  
- Clients (very limited, client-safe)  

---

# 🔄 How Custom Views Work

When filters change:
- UI state updates → query updates → view can be saved  

Saved view includes:
- Filters, sorting, column visibility/order, density settings  

Most “missing data” issues are filter- or view-related, not bugs.

---

# 🚫 Most Common User Issue

> “My leads/candidates/deals disappeared!”

Likely causes:
- A filter is still applied  
- A saved view is active  
- A collaborator view is selected  

REX first response:
> “Let’s check if any filters or saved views are active. In the top-right, do you see a view selected or filter chips?”

---

# 🔍 Troubleshooting Flow for “Missing Data”

1) Ask: “Are you using a Saved View right now?”  
2) Ask: “Do you see blue filter chips at the top?”  
3) Guide: “Click Clear Filters or switch to Default View.”  
4) If still empty, verify:  
   - Workspace role restrictions  
   - The module actually has data  
   - Teammate data visibility rules  
   - REQ/Deal archived state  
   - Candidate deleted/removed from context  
5) If still broken → escalate  

---

# 📁 Sharing Views

## Who can share?
- Super Admin, Workspace Owner, Team Admin  

## What can be shared?
- Pipeline filters, candidate searches, lead lists  
- Deals pipeline views, custom table views  

## Who receives shared views?
- Entire team or selected collaborators  

## Clients (Guest Collaborators)
They see only client-safe data:
- Submitted candidates, feedback UI, limited filters  
Shared client views hide:
- Internal tags, recruiter-only fields, messaging details, private notes  

---

# 🧠 REX Conversational Examples

Filter help:
> “Click Filter at the top-left of the table. Try Stage → Contacted to narrow your list.”

Data vanished:
> “A saved view or filter is likely active. Switch to Default View to restore your data.”

Create saved view:
> “After setting filters/columns, click Save View and name it, e.g., ‘My Hot Leads’.”

Team views differ:
> “Private views vary per user. Shared team views appear only if an admin shared them.”

---

# 📉 Sorting Issues

Newest not on top:
- Set sort to Created At → Descending

Sorting not applying:
- Clear search; reset filters; reload view state  

---

# 📊 Column Issues

Missing column:
- Open Column Picker → add column → save view

Teammate sees different columns:
- Different saved view; layout changed; not using the shared team view  

---

# 🛠️ Advanced Filters (Important)

Common helpful filters:
- Has Email / Has Phone Number / Has LinkedIn URL  
- Ready to Contact / Tagged with …  
- Last contacted by REX / Has reply from lead  
- Message sent / Not sent / Credit balance  
- Stage age (days in stage) / Job REQ assigned  

REX should recommend these proactively.

---

# 🧪 Filter Accuracy Checks

If results look wrong:
- Cached query; conflicting filters  
- Team-level restrictions  
- Wrong REQ or pipeline selected  
- AND/OR condition confusion  

Reset view solves most cases. If not, escalate.

---

# 🚨 When REX Should Escalate

Escalate if:
- Filters not clearing  
- Shared view not applying  
- Saved views not saving  
- Columns not loading  
- Queries stuck loading  
- Filters apply but no results system-wide  
- Filter options blank  
- Sort broken across modules  

Ticket must include:
- User ID, Workspace ID  
- Module (leads, deals, candidates, etc.)  
- Saved view name  
- Filter combination  
- Browser/device  
- Screenshot of active filters  

---

# 🔗 Related Files  

- `leads-and-filters.md`  
- `candidates-and-filters.md`  
- `tables.md`  
- `job-reqs.md`  
- `deals.md`  

