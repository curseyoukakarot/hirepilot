# Deliverability & Sending Reputation — Full Support Guide

deliverability.md

(Email deliverability, domain reputation, warm-up, throttling, bounce logic, troubleshooting)

## Purpose of this File

This guide teaches REX how to:

- Explain deliverability in simple, non-technical language
- Help users fix sending issues
- Identify reputation problems early
- Troubleshoot Gmail/Outlook/SendGrid deliverability concerns
- Interpret bounce categories
- Guide users through warm-up best practices
- Enforce HirePilot safety guardrails
- Escalate issues when the system detects serious problems

---

# ✉️ What Is Deliverability?

Deliverability means:

- How likely an email is to reach the inbox
- How Gmail/Outlook decide to trust or block you
- How clean your sending patterns look to spam filters

It is determined by:

1. Sending volume  
2. Bounce rates  
3. Spam complaints  
4. Reputation of your domain  
5. Quality of your email content  
6. Message frequency  
7. Engagement (opens, clicks, replies)

HirePilot has **automatic guardrails** to protect your domain from being burned.

---

# 🧩 How HirePilot Protects Deliverability

HirePilot automatically:

- Limits sending speed  
- Limits daily send volume  
- Delays sequences after bounces  
- Warns users on high bounce patterns  
- Tracks domain reputation signals  
- Prevents rapid-fire outreach  
- Automatically retries soft bounces  
- Stops sending after hard bounces  
- Auto-pauses campaigns if too many errors occur  

REX must be able to say:

> “HirePilot is slowing down or pausing your sends to protect your domain reputation. You’ll be able to resume once your reputation stabilizes.”

---

# 🔥 Warm-Up Logic (Critical!)

REX must enforce these rules:

### When a user first connects Gmail/Outlook:

- Day 1: ~20–40 emails  
- Day 2–4: ~40–70  
- Day 5–7: ~70–120  
- Week 2+: up to 150–250 per day  
- Week 3+: up to 250–350 per day (max recommended)  

NEVER allow:

- 500+ sends/day on new domains  
- Sending 100 emails immediately  
- Running multiple huge campaigns on day 1  

REX must advise:

> “Let’s warm up your domain more slowly — it protects your inbox from being flagged.”

---

# 📤 Sending Windows & Safety Caps

HirePilot enforces:

- Daily limit from user settings  
- Hard max daily cap (for safety)  
- Time-of-day sending windows  
- Delays when O365/Gmail rate-limit  

Typical delays:

- 4–9 seconds between sends  
- Longer delays if provider throttles  

---

# 📊 Bounce Categories (REX MUST KNOW THESE)

## **Soft Bounce**

Temporary issue:

- Inbox full  
- Server busy  
- Greylisting  
- Temporary block  
- DNS delay  

HirePilot retries soft bounces automatically.

---

## **Hard Bounce**

Permanent issue:

- Invalid email  
- Domain doesn't exist  
- Mailbox disabled  
- Anti-spam system blocked permanently  

HirePilot will:

- Mark lead as “Invalid”  
- Stop future sends  
- Recommend finding a new email  

---

# 🚫 Spam Complaints

If someone marks your email as spam:

- SendGrid reports it to HirePilot  
- Lead automatically removed  
- Campaign paused  
- Account reputation marked as “At Risk”  

REX must respond with:

> “Your domain received a spam complaint. This is serious — let’s slow down sending and improve message personalization.”

If 2+ complaints occur in a week:

- Auto-send pause  
- Super Admin alerted  
- Support ticket recommended  

---

# 🧭 Diagnosing Deliverability Issues (REX scripts)

When user says:

**“My emails aren’t landing / no one is replying / deliverability seems low.”**

REX must ask:

- “How old is your domain?”  
- “How many emails are you sending per day?”  
- “Have you sent any bulk campaigns recently?”  
- “Are you using Gmail, Outlook, or SendGrid?”  
- “Are you seeing bounces?”  
- “Were any emails marked as spam?”  

---

# 🔍 Key Things REX Must Check

## 1. **Domain Age**

New domains (0–30 days) are HIGH RISK.

## 2. **Campaign Volume**

Too many sends too quickly.

## 3. **Email Content**

Red flags:

- Spammy subject lines  
- Too many links  
- Large images  
- Attachments  

## 4. **Bounce Rates**

> 5% bounce rate = warning  
> 10% = domain at risk  
> 20% = serious danger  

## 5. **Spam Reports**

ANY complaints = immediate pause.

## 6. **Authentication**

REX should ensure:

- SPF set  
- DKIM set  
- DMARC recommended  

HirePilot checks this automatically.

---

# 🛠️ Troubleshooting Deliverability Problems

## **Problem: No replies**

Possible:

- Too many links  
- Poor personalization  
- Domain reputation low  

REX should offer to rewrite messaging.

---

## **Problem: Emails going to spam**

Causes:

- New domain  
- High sending volume  
- Bad templates  
- Spammy wording  
- Too many images / signatures  

REX must help rewrite.

---

## **Problem: Campaign paused automatically**

CAUSES:

- Spam complaint  
- High bounce rate  
- Reputation drop  
- User exceeded daily cap  

REX must explain why and recommend next steps.

---

## **Problem: Gmail/Outlook rate-limited**

Symptoms:

- Delays  
- “Temporary send failure” errors  
- Campaign stuck in Queue  

Fixes:

- Reduce sending speed  
- Spread sends across hours  
- Improve email content  
- Reduce large attachments  

---

## **Problem: High bounce rate**

Ask user:

- “Where did these emails come from?”  
- “Has this list been verified?”  
- “Do you want me to run enrichment to find valid emails?”  

---

# 🧠 Recommended Best Practices (REX should offer proactively)

- Personalized messages (no templates overused)  
- Use only 1–2 links per message  
- Avoid heavy HTML  
- Keep subject lines simple  
- Run enrichment to validate emails  
- Warm up domain slowly  
- Use smaller lists (20–30 at a time)  
- Avoid spammy trigger words  
- Add DMARC for extra trust  

---

# 🚨 When REX Must Escalate

Ticket required if:

- User cannot send ANY emails  
- SPF/DKIM validation repeatedly failing  
- SendGrid events failing to log  
- Gmail/Outlook OAuth repeatedly breaking  
- Campaigns stuck in “Sending” for 30+ minutes  
- Sudden spike in spam blocks  
- Domain flagged by Google/Microsoft  
- Multiple users in same workspace reporting issues  

Ticket includes:

- User email provider  
- Daily sending volume  
- Bounce logs  
- Spam reports  
- Campaign IDs  
- Workspace ID  
- Error messages  

---

# 👤 Related Files

- `gmail-outlook-integration.md`  
- `sendgrid-events.md`  
- `campaign-wizard.md`  
- `classification.md`  
- `leads.md`  
- `errors-and-troubleshooting.md`

⸻


