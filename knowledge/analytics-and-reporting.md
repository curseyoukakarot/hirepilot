# Analytics & Reporting in HirePilot  

analytics-and-reporting.md

(Dashboards, custom reports, metrics logic, troubleshooting, usage analysis)

### Complete Support Documentation for REX

---

## 🎯 Purpose of This File  

This file equips REX to:  

- Explain how analytics work  
- Help users create custom dashboards  
- Diagnose incorrect metrics  
- Guide users step-by-step through creating custom reports  
- Interpret pipeline, outreach, and hiring metrics  
- Troubleshoot broken charts  
- Explain sampling windows & refresh logic  
- Understand data sources behind every widget  

Analytics is one of HirePilot’s power features — users MUST feel your agent understands it flawlessly.

---

# 📊 Overview of Analytics in HirePilot

Analytics lives in two places:

1) Dashboards  
   - Fully customizable widgets/cards/charts  
   - Team-wide or private  

2) Custom Reports  
   - Table-based reports, summaries, aggregations  
   - Filter-driven, exportable (CSV/PDF)  
   - Used heavily for weekly client updates  

Both use the same data engine underneath.

---

# 📈 Types of Widgets / Reports Available

## 1) Outreach Metrics
- Total leads added  
- Leads contacted  
- Emails sent  
- Replies received  
- Positive replies  
- Campaign performance  
- LinkedIn requests sent  
- LinkedIn accepts  

## 2) Pipeline Metrics (by job, recruiter, or global)
- Sourced / Contacted / Interviewed / Offered / Hired / Rejected  
- Stage conversion %  
- Time in stage  

## 3) Deals & Revenue
- Opportunities created  
- Value by stage  
- Total revenue  
- Invoices created / paid  
- Forecasting  

## 4) User Activity & Productivity
- Messages sent, tasks completed, candidates moved  
- Submissions sent, calls logged, profiles scraped  

## 5) System Usage
- Logins, REX interactions, credits used, extension scraping  

---

# 🛠️ Data Refresh Logic

REX must know this cold.

- Most analytics update instantly (pipelines, submissions, campaigns)  
- Some analytics refresh every 1–5 minutes (heavier queries)  
- Revenue analytics may refresh every 5–10 minutes  
- Dashboards update independently, widget-by-widget  

If a user complains metrics are stale:
> “Your dashboard updates asynchronously. If a widget hasn’t refreshed yet, click ‘Refresh Widget.’ If that doesn’t update, I can check logs.”

---

# 🧮 How Metrics Are Calculated

## Pipeline Conversion
of candidates who reached a stage / # of candidates in the previous stage

## Reply Rate
replies received / messages sent

## Positive Reply Rate
positive replies / total replies

## Source Breakdown
grouped by: Apollo, LinkedIn Sniper, CSV import, Chrome extension, manual add

## Deals Value (Forecast)
expected value × stage probability (pipeline stage weighting)

## Revenue Metrics
paid invoices only (recognized revenue)

---

# 💡 REX Conversational Examples

“How does reporting work?”
> “HirePilot provides customizable dashboards. Drag-and-drop widgets, choose metrics, filter by job, recruiter, or timeframe, and export reports. I can help you set one up.”

Creating a dashboard:
> “Click ‘New Dashboard’, name it, then ‘Add Widget’. I can recommend the best metrics for your workflow.”

Numbers look wrong:
> “Let’s verify dashboard and widget filters — many charts are scoped by job, recruiter, or date.”

Weekly client report:
> “Build a custom report filtered by Job REQ, save it, and export to PDF. I can walk you through it now.”

---

# 🔍 Filters in Analytics

Filters apply at the widget, dashboard, and report level.

Common cause of empty charts:
- Dashboard filter + widget filter conflicts  
- Wrong job selected  
- “My assignments only” is active  
- Time range too narrow  

Fix:
1) Reset dashboard filters  
2) Reset widget filters  
3) Expand date range  

---

# 🧱 Building Custom Reports (Step-by-Step)

1) Go to Reports  
2) Click “New Report”  
3) Select data source (Leads, Candidates, Campaigns, Deals, Billing, Job REQs, Sniper, Tables)  
4) Add filters (date, recruiter, stage, source, etc.)  
5) Add columns  
6) Optional grouping  
7) Add aggregations (count, sum, average)  
8) Save & name the report  
9) Export (CSV or PDF)  

REX should guide conversationally through each step.

---

# 🧰 Troubleshooting Analytics Problems

## Wrong numbers / Missing data
Causes: dashboard/widget filters, hidden columns, timeframe empty, role-restricted views  
Fix:
> “Let’s clear filters and switch back to the default view.”

## Widgets not loading
Causes: API timeout, large query, cache, corrupted widget  
Fix: refresh widget; duplicate/replace; escalate on 500/blank

## Dashboard not saving
Causes: localStorage conflict, network, oversized widget definition, DB save error  
Fix: save again; remove complex widgets; try incognito

## Chart differs across teammates
Causes: personal filters, private dashboards, permissions differences  
Explain:
> “Views and filters are personal unless shared; roles can also limit data.”

## Deal analytics incorrect
Causes: deal not attached to REQ, missing value, stage probability 0%  
Fix: add value; attach REQ; adjust stage weights

---

# 🧠 Proactive Suggestions by REX

- “Track hired conversions?”  
- “Visualize team outreach volume?”  
- “See pipeline bottlenecks?”  
- “Forecast based on opportunity stages?”  
- “Candidate progression report for this job?”  

---

# 🚨 When REX MUST Escalate

Escalate for:
- Dashboard fails to load  
- Chart returns 500  
- Widget empty when data exists  
- Report export failures/timeouts  
- Data mismatches backend logs  
- Revenue analytics not updating  
- Client dashboard errors  
- Team dashboards with incorrect permission scoping  

Ticket should include:
- Workspace ID, Dashboard ID, Report ID (if relevant), User ID  
- Filters, time range, screenshot  

---

# 🔗 Related Files  

- `deals.md`  
- `pipelines.md`  
- `campaigns.md`  
- `tables.md`  
- `collaborators.md`  

