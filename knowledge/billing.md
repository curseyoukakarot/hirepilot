# Billing — Full Support Guide

billing.md

(Invoices, Fees, Revenue, Payments, Automation, Troubleshooting)

## Purpose of This File

This file teaches REX how to:

- Explain how billing works inside HirePilot  
- Guide users in creating invoices  
- Understand fee structures for each type of recruiting model  
- Walk through invoice logic step-by-step  
- Explain how retained vs contingency billing works  
- Help troubleshoot missing or incorrect invoices  
- Explain revenue reporting  
- Know when billing issues need escalation  

Billing is extremely important for agencies, so REX must know this cold.

---

# 💰 What Is Billing in HirePilot?

Billing is the financial center of the Deals system.

It allows users to:

- Generate invoices  
- Track pending & paid invoices  
- Calculate recruiting fees  
- Log payments  
- Calculate revenue  
- Report on performance  
- Sync workflow triggers (Slack, email, Zapier, Make)  

REX must guide users through both the business logic and the UI steps.

---

# 🧩 How Billing Connects to the Rest of HirePilot

### Billing depends on:
- **Deals**
- **Job REQs**
- **Candidates**
- **Candidate Stages**
- **Salary or fee data**
- **Invoice settings**

### Billing drives:
- Revenue reporting  
- Paid vs unpaid invoices  
- Deal lifecycle  
- Performance analytics  

### When a candidate is placed (Hired):
1. REQ updated  
2. Deal runs fee calculation  
3. Invoice created  
4. Revenue logged as “Pending”  
5. When user marks invoice Paid → Revenue recognized  

---

# 📦 Supported Billing Models

HirePilot supports the three primary recruiting business models.

## **1. Contingency Billing**  
**Fee = Salary × Fee Rate%**

Example:  
- Salary = $150,000  
- Fee Rate = 25%  
- Invoice = $37,500  

HirePilot automatically:
- Detects when candidate stage = Hired  
- Pulls salary from candidate record or offer details  
- Applies contingency rate  
- Generates invoice  
- Logs revenue as pending  

Users may override fee manually.

## **2. Retained Search Billing**  
Used for:
- Executive search  
- High-level roles  
- Ongoing retained partnerships  

Retainers can be:
- **Fixed fee**  
- **Split into installments**  
- **Hybrid (retainer + success fee)**  

HirePilot supports:
- Manual invoice creation  
- Scheduled invoices  
- Fee templates per client  
- Notes for installment breakdown  

## **3. Contract Staffing Billing**  
*In early version:*  
- Bill Rate × Hours  
- Ongoing weekly or monthly invoices  

HirePilot supports:
- Manual entry  
- Recurring invoices  
- Custom notes  
- Client-specific rates  

---

# 🧾 Invoices — Deep Explanation

Invoices contain:

- Invoice number  
- Deal  
- Client  
- REQ  
- Candidate (if placement)  
- Amount due  
- Due date  
- Payment status  
- Description  
- Notes  

Invoices can be:
- Automatically created (from candidate hire)  
- Manually created (retainers, contract staffing)  

REX must walk users through step-by-step:
1. Where to click  
2. What each field means  
3. How amounts are generated  
4. How to override fields  

---

# 🧮 Fee Calculation Logic

REX must understand the full logic.

## **Contingency Fee Calculation**
Fee = Salary × Fee %

If missing salary:
- REX must prompt user:  
  “I’ll need a salary to calculate the fee. What is the agreed annual comp for this role?”

If missing fee %:
- Use Deal template  
- If blank, ask user:  
  “What fee percentage do you charge for this client?”

## **Retained Billing Calculation**
Can be:
- One-time fixed amount  
- Three-payment model (⅓ at kickoff, ⅓ at shortlist, ⅓ at hire)  
- Monthly retainer  
- Hybrid model  

HirePilot does not enforce rules here.  
REX must assist conversationally:
> “Would you like to split this fee into multiple installments?”

## **Contract Staffing Fee Calculation**
Early version supports:
- Manual amounts  
- Recurring invoices  
- Notes for hours worked  

---

# 📊 Revenue Reporting

Revenue tab displays:

- **Forecasted revenue** (pending invoices)  
- **Actual revenue** (paid invoices)  
- **Revenue by client**  
- **Revenue by recruiter**  
- **Revenue by period** (weekly/monthly/year-to-date)  

REX must help users understand:
- Why some revenue isn’t showing  
- Why a report looks incorrect  
- How revenue ties back to deals & invoices  

---

# 🛠️ Common Billing Actions (REX scripts)

## ✔ Creating a Contingency Invoice
> “Let’s walk through creating a contingency placement invoice together.”

Steps:
1. Go to **Deals → Billing**  
2. Click **New Invoice**  
3. Choose **Placement (Contingency)**  
4. Select Deal  
5. Select Candidate  
6. Enter Salary  
7. Confirm fee %  
8. Review calculated amount  
9. Add due date  
10. Save  

## ✔ Creating a Retainer Invoice
> “Is this a one-time invoice or part of a multi-installment retainer?”
Steps similar but without salary.

## ✔ Marking an Invoice Paid
> “Open the invoice and click ‘Mark as Paid.’ This moves the revenue into your recognized totals.”

## ✔ Fixing a Fee Calculation
REX can:
- Recalc fee  
- Adjust salary  
- Adjust fee %  
- Edit notes  

---

# 🛠️ Troubleshooting (HIGH IMPORTANCE)

## ❌ “No invoice was created when candidate was hired”
Checks:
- Was the Deal type set to Contingency?  
- Was the candidate attached to the correct REQ?  
- Was salary missing?  
- Was fee % missing?  
- Was the candidate moved directly to Hired from Sourced (skipping Interviewed/Offered)?  
- Does user have permission?  
If multiple users affected → escalate.

## ❌ “Fee is incorrect”
Likely:
- Wrong salary  
- Fee % default updated  
- Deal fee structure changed  
REX should ask:
> “What fee rate did you agree on with this client?”

## ❌ “Revenue not showing”
Check:
- Invoice marked paid?  
- Invoice linked to a Deal?  
- Deal linked to a REQ?  
- REQ linked to the candidate?  
- Filters in the Revenue tab?  

## ❌ “Duplicate invoices”
Occurs when:
- Candidate moved back/forth between stages  
- Stage-trigger automation misfired  
- User clicked “generate invoice” twice  
REX should:
- Help delete/merge duplicates  
- Identify root cause  

## ❌ “Cannot mark invoice as paid”
Check:
- Invoice exists?  
- Does user have permission?  
- Did multiple invoices get created?  

## ❌ “Wrong client or REQ is showing”
Fix:
- Reassign invoice to correct deal or REQ  

## ❌ “Installment schedule not working”
Reason:
- User must manually create installments  
- HirePilot does not enforce installment logic  
REX should explain limitations.

---

# 🚨 When REX Must Escalate a Support Ticket

Billing issues often require escalation.

Escalate if:
- Invoice creation fails system-wide  
- API error generating invoices  
- Revenue not updating for multiple users  
- Salary-trigger logic failing across workspaces  
- Contingency fee calculation broken  
- Retainer schedule corrupted  
- Payments not saving  
- Revenue reporting incorrect globally  
- Deal + REQ + candidate linking breaks  

Ticket must include:
- Workspace  
- Deal ID  
- Invoice ID  
- Candidate ID  
- Trigger event  
- Error logs  
- User steps  
- Expected vs actual behavior  
- Screenshot if given  

---

# 👤 Related Files

- `deals.md`  
- `job-reqs.md`  
- `candidates.md`  
- `pipelines.md`  
- `workflows-automation.md`  
- `errors-and-troubleshooting.md`


