# Billing & Subscription Management in HirePilot  

billing-and-subscription.md

(Stripe logic, trials, credits, upgrades, invoices, payment failures, limits)

### Complete Internal Documentation for REX (Support Agent)

---

## 🎯 Purpose of This File  

This file equips REX to:

- Explain billing plans & credits  
- Guide users through upgrading/downgrading  
- Resolve failed payments  
- Understand credit usage  
- Explain plan limits  
- Troubleshoot Stripe errors  
- Handle trial expirations  
- Send users to the Stripe customer portal  
- Manage team member seat billing  
- Explain invoices & receipts  
- Escalate critical billing failures  

REX must treat billing issues with urgency and clarity.

---

# 💳 HirePilot Billing Overview

All billing runs through Stripe.

Billing includes:
- Subscription plans  
- Seats (Team/Agency plans)  
- Credits (usage-based add-ons)  
- Trials  
- Coupon codes  
- Invoicing and proration  

Stripe handles:
- Taxes, invoices, receipts  
- Payment methods and retries  

HirePilot handles:
- Applying plan limits  
- Blocking usage when plan expires  
- Credit issuance/refresh  
- Enabling plan-specific features  

---

# 🪙 CREDIT SYSTEM (The Backbone)

Credits are used for:
- Enrichment (Apollo, Hunter, Skrapp, Decodo)  
- Enhanced enrichment (+1)  
- LinkedIn connection requests (10)  
- Sniper automation and scraping jobs  
- Other REX tasks that consume external APIs  

Reference pricing:
- 1 credit = verified email or standard enrichment  
- +1 credit = enhanced enrichment (only if data found)  
- 10 credits = LinkedIn connection request  
- Scraping costs vary by job/plan  

Credits refresh monthly per plan or via purchased add-ons.

Common question:
> “Why did my credits drop unexpectedly?”

REX should check:
- Sniper action logs  
- REX tool usage  
- Enrichment logs  
- Chrome extension activity  
- Team member actions  

---

# 🧪 PLAN TYPES & LIMITS

## 1) Free Plan
Includes:
- Basic ATS  
- 350 one-time credits  
- Basic campaign limits  
- Limited REX  
- No LinkedIn automation  
- No Deals/Billing  

REX guidance:
> “To unlock Sniper, Deals, unlimited campaigns, and more REX abilities, upgrade to Starter or Pro.”

## 2) Starter Plan
Includes:
- Monthly credits  
- Full campaigns  
- Basic Sniper usage  
- Core REX tools  
- Seat cap (team members up to plan limit)  

## 3) Pro Plan
Includes:
- Higher monthly credits  
- Advanced Sniper  
- REX automations  
- Enhanced enrichment  
- Unlimited campaigns  
- Deals & Billing  
- Chrome extension full features  

## 4) Team/Agency Plan
Includes:
- Everything in Pro  
- Additional seats (seat-based billing)  
- Role-based permissions  
- Client collaboration features  
- Audit logs & admin controls  

---

# 🧩 TRIAL LOGIC

Defaults (configurable):
- 7-day free trial  
- Card optional  
- Most Pro features enabled  
- Credits included for trial usage  

When trial ends:
- Access is restricted  
- User must upgrade  
- Emails paused, Sniper disabled  
- Deals locked, REX limited  

REX guidance:
> “Your trial has ended — let’s get your workspace reactivated so nothing pauses unexpectedly.”

---

# ⚠️ FAILED PAYMENTS (Critical)

When Stripe cannot charge:
- Subscription enters past_due  
- Stripe retries up to 4 times (configurable)  
- After final attempt, subscription cancels  
- Workspace becomes restricted  

Common causes:
- Insufficient funds  
- Card expired  
- Bank blocks subscription  
- Billing address mismatch  
- 3D Secure (SCA) failure  

REX fix:
> “I’ll send you a secure Stripe billing portal link to update your card.”

Never ask for card details directly.

---

# 🧾 INVOICES & RECEIPTS

Users can access:
- All invoices and payment history  
- Download receipts  
- Line items and seat charges  

Where:
- Stripe customer portal (secure link)  
- HirePilot → Billing section  

---

# 🔄 UPGRADES / DOWNGRADES

## Upgrading
Stripe prorates:
- Remaining time on current plan  
- Charges a prorated amount for the new plan  

REX:
> “Stripe prorates your upgrade so you only pay the difference.”

## Downgrading
- Changes apply next billing cycle  
- Current cycle features remain until renewal  

---

# 🧑‍🤝‍🧑 SEAT BILLING (Team/Agency Plans)

Seat = billable user.

Adding a seat:
- Stripe prorates added cost immediately  
- New user gains access right away  

Removing a seat:
- No mid-cycle refunds  
- Seat removal effective next cycle  

REX clarify:
> “Removing a user now adjusts at the next billing cycle.”

---

# 🔧 TROUBLESHOOTING BILLING ISSUES

## “My card keeps declining”
REX steps:
- Ask if bank is blocking recurring charges  
- Suggest contacting card issuer  
- Send Stripe portal link to update method  

## “I upgraded but still see Free features”
Causes: Stripe webhook delay, workspace state not refreshed, wrong workspace  
Fix: refresh billing state; confirm workspace ID; re-check subscription status  

## “My plan says canceled but I didn’t cancel it”
Causes: final failed retry; auto-renew off; billing owner changed plan  
Fix: restore subscription in Stripe portal; verify billing owner actions  

## “Credits didn’t refresh”
Causes: webhook delay; mid-cycle timing; custom plan misapplied  
Fix: refresh credits through admin tools (if allowed) or escalate  

## “My invoice looks wrong”
Check: proration math, seat counts, add-ons, coupon expiration  

---

# 🧠 REX Conversational Examples

Plan limits:
> “Your plan includes X credits/month. You’ve used Y this cycle, and Sniper actions cost 10 credits each. Want me to help optimize usage?”

Trial expired:
> “It looks like your trial ended. I can help you pick a plan so everything stays active.”

Failed payment:
> “Understood — these happen. I’ll send a secure billing link to update your card right now.”

---

# 🚨 WHEN REX MUST ESCALATE IMMEDIATELY

Escalate if:
- Stripe webhooks failing (system-wide)  
- Subscription state mismatched across backend  
- User charged twice  
- Credits deducted incorrectly  
- Over-billing seats or duplicate invoices  
- Paying user locked out  
- Billing tied to wrong workspace  
- Plan corrupted or features missing  

Ticket must include:
- Workspace ID  
- User ID  
- Stripe Customer ID (if visible)  
- Stripe Subscription ID  
- Recent invoices  
- Current plan  
- Steps user took and timestamps  

---

# 🔗 Related Files  

- `authentication.md`  
- `subscriptions-api.md`  
- `credits.md`  
- `user-management.md`  
- `integrations.md`  

