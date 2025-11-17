# Plans, Credits & Usage Limits

plans-and-credits.md

(FOUNDATION → Understanding Plans, Credits & Limits)

## Who this is for
Users selecting a HirePilot plan, understanding credit usage, or needing help with why certain actions cost credits or have limits.

## TL;DR
- HirePilot uses **credits** for actions that directly create value: enrichment, sending outreach, and LinkedIn automation.  
- Each plan gives different amounts of **credits**, **seats**, **limits**, and **REX features**.  
- Credits reset monthly.  
- Credits = a safety system + performance control to protect user accounts and backend resources.
- If a user hits a limit, REX can suggest upgrades or guide them on optimizing usage.

---

# 🎛️ Overview of Plans

HirePilot currently includes:

### **1. Free Forever Plan**
- 350 total credits  
- Basic Leads & Candidates  
- Limited Campaigns  
- LinkedIn extension (manual capture)  
- Credit-gated enrichment  
- Basic REX support  
- No automation, no Agent Mode, limited integrations

### **2. Starter Plan**
- More monthly credits  
- Unlimited campaigns  
- Email + LinkedIn outreach  
- Basic REX workflows  
- Gmail/Outlook integration  
- No advanced automation

### **3. Pro Plan**
- Higher credit allocation  
- Advanced REX capabilities  
- LinkedIn automation (connection requests)  
- Sniper tools  
- Sales Navigator scraping  
- Team access unlocked  
- Workflows automation  
- Deals + Billing features

### **4. Team Plan**
- Everything in Pro  
- Multi-seat  
- Team Admin permissions  
- Guest Collaborators  
- Shared pipelines  
- Activity monitoring  
- Enterprise-grade integrations  
- Higher monthly credits + usage caps

---

# 📊 What Credits Are Used For (Critical)

Credits are how HirePilot fairly allocates resources across features that involve:
- API calls  
- Proxy costs  
- Scraping  
- Enrichment  
- Email sending  
- LinkedIn safety  
- REX processing tasks  

Here is the **cost breakdown**:

### **1 credit**
- Email send  
- Profile Enrichment (standard)  
- Contact Email Lookup  
- Basic LinkedIn Enrichment  

### **+1 credit (enhanced enrichment)**
Unlocks:
- Company revenue  
- Funding round  
- Tech stack  
- Industry keywords  
- Additional context  

### **10 credits**
- LinkedIn connection request (300-char message optional)  
Requires remote session + throttles.

### **Varies (0–?? credits)**  
Depending on:
- Apollo enrichment  
- Hunter.io  
- Skrapp.io  
- Decodo Site Unblocker usage  
(credits are charged automatically per lookup or scrape)

---

# 🔁 Monthly Credit Reset

Credits reset at:
- 00:00 UTC on the user’s billing renewal date  
- All unused credits expire  
- Team plans allocate credits *per workspace*, not per seat  

**REX rule:**  
If a user is out of credits, REX must:
1. Inform the user in a friendly, supportive way  
2. Recommend the next best plan  
3. Offer ways to conserve credits  
4. Offer to open the billing page for them  

---

# 🧮 Credit Safety & Throttles

HirePilot enforces:
- Daily send limits  
- LinkedIn rate limits  
- Enrichment caps  
- Proxy warm-up limits  
- Remote session safety cycles  

These protect account bans and maintain deliverability.

If a user hits a limit, REX will say:
> “This limit is in place to keep your LinkedIn/email account safe.  
> But here’s what we *can* do next…”

---

# 🚨 What Happens When Credits Run Out

When credits are 0:
- Email campaigns pause  
- LinkedIn requests disable  
- Enrichment halts  
- REX automations stop mid-task  
- Workflows skip scheduled actions  

REX should:
1. Detect the 0-credit state  
2. Explain impact  
3. Pull up the Billing page  
4. Guide user on increasing or conserving credits  
5. Offer to create a task or reminder  
6. Stop risky actions but complete safe ones

---

# 🧾 How Billing Works

- Users subscribe via Stripe  
- Each plan renews monthly  
- Team plans: seat count × price  
- Additional purchases (like more credits) appear as **Usage Add-Ons**

**Billing events REX can describe:**
- Card declines  
- Failed renewals  
- Subscription pauses  
- Upgrade/downgrade proration  
- Free trials → conversions  

---

# 💡 Usage Tips to Maximize Credits

### **For Outreach:**
- Use REX to personalize once → apply to multi-step sequences  
- Avoid sending unnecessary follow-ups  
- Use smart targeting (quality > quantity)

### **For Enrichment:**
- Enrich *after* capturing a lead  
- Avoid repeated enrichments  
- Let REX auto-select the right provider (Hunter/Skrapp/Apollo/Decodo)

### **For LinkedIn Automation:**
- Stay within daily quotas  
- Only send requests to truly qualified leads  
- Use Sniper settings to throttle automation safely  

---

# 🧵 Troubleshooting Credit Issues

### **“Why did my credits drop suddenly?”**
- Check **Activity Log**  
- Audit campaigns  
- REX can list last 10 credit actions  
- Check workflow triggers

### **“My enrichments aren’t working.”**
Possible causes:
- Out of credits  
- Provider responded with no data  
- API didn’t return expected contact info  
- LinkedIn block or rate limit  

### **“LinkedIn requests aren’t sending.”**
- Out of credits  
- LinkedIn throttled  
- Remote session inactive  
- Proxy / Browserless warm-up needed  

### **“Email send failed.”**
- Credits  
- Integration token expired  
- SendGrid suppression  
- Gmail/Outlook OAuth expired  

---

# 🔐 When to Escalate (Ticket Required)

REX should create a support ticket when:
- Credits were deducted incorrectly  
- Large unexpected usage spikes  
- Billing renewal didn’t reset credits  
- LinkedIn request cost charged but request didn’t send  
- Enrichment charged but returned empty data  
- A user claims their credits “disappeared”

---

# 👤 Related Files
- `overview.md`  
- `integration-gmail.md`  
- `integration-outlook.md`  
- `billing-invoicing.md`  
- `credit-usage.md`  
- `sending-limits.md`  


