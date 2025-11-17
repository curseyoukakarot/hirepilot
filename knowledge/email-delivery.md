# Email Delivery & Notification System — Full Support Guide

email-delivery.md

(SendGrid, Gmail/Outlook OAuth, alerts, reply tracking, failures, troubleshooting)

## Purpose of This File

This file teaches REX how to:

- Understand HirePilot’s email delivery system  
- Diagnose failed emails  
- Troubleshoot Gmail/Outlook OAuth issues  
- Explain SendGrid behavior  
- Understand reply tracking  
- Explain event webhooks  
- Detect system-wide outages  
- Escalate deliverability issues  
- Walk users through re-auth workflows  

This is a major support topic — accuracy is critical.

---

# ⭐ HirePilot Email Architecture Overview

HirePilot uses a hybrid email system:

## 1. SendGrid
Used for:
- Campaign sending, Notifications, In-app transactional, Support automation, System alerts, Submission emails

## 2. Gmail OAuth
Used for:
- Sending “from your own email”, threaded conversations, reply tracking, inbox-style messaging, reducing spam

## 3. Outlook OAuth
Used for:
- Microsoft 365/Outlook users and corporate inboxes

## 4. Reply Routing
HirePilot uses:
- Custom reply domain (e.g., `reply.thehirepilot.com`) with SendGrid Inbound Parse  
- Replies → backend → mapped to message thread

## 5. Slack Notifications
Triggered for:
- New replies, new leads, campaign events, critical account alerts

---

# 📬 How Hiring Emails Are Sent

HirePilot supports two modes:

## Mode 1: Send From User's Own Email (Recommended)
(Gmail/Outlook OAuth)
- Highest deliverability, direct replies to user’s inbox, full threading, most authentic  
- Requires active OAuth with correct scopes

If OAuth breaks:
> Settings → Email Integrations → Reconnect

## Mode 2: Send Via HirePilot (SendGrid)
Used for: Submissions, Transactional, Notifications, some REX actions, automation sequences  
Sender: `notifications@thehirepilot.com` or workspace custom domain (if configured)  
Note: Users are NOT charged credits for email sending.

---

# 📥 How Email Replies Work (Reply Routing)

Flow:
SendGrid → Inbound Parse → HirePilot backend → message thread mapping  

Reply detection triggers: Slack alert, in-app notification, recruiter email, message marked “Replied”, campaign status update  

If routing fails:
- Replies won’t appear in HirePilot → escalate immediately  
Common causes: DNS misconfig, inbound endpoint down, OAuth broken for user-mode replies

---

# 🔔 System Notifications

Channels:
- Email, Slack, In-app, optional automations  

Examples:
- Candidate replied, lead converted, submission approved, Sniper job completed, REX finished, scraping done, failed login, billing issue

---

# 🛠️ Troubleshooting Email Issues

## ❌ User’s messages not sending
Causes: OAuth expired/invalid, wrong scopes, missing refresh token, formatting error  
Fix: Reconnect Gmail/Outlook → verify recipient/attachments → try plain-text

## ❌ Emails going to spam
Fix: Use OAuth mode, avoid large attachments/many links, warm mailbox, vary templates

## ❌ Client not receiving submission email
Causes: Spam filters, blocked reply domain, invalid email, SendGrid queue delay  
Fix: Check spam → resend → check SendGrid status → escalate if widespread

## ❌ Reply not showing in HirePilot
Causes: Inbound webhook down, DNS wrong, OAuth thread sync broken, different reply address  
Fix: Verify inbound webhook & DNS → ask which email was used → escalate if global

## ❌ Gmail integration breaks
Causes: Revoked tokens, password change, org policy  
Fix: Settings → Email Integrations → Disconnect → Reconnect → Approve all scopes

## ❌ Outlook integration breaks
Fix: Re-auth Microsoft account; ensure scopes; confirm tenant allows OAuth

## ❌ SendGrid bounce or block
Causes: Recipient domain block, DMARC failure, hard bounce, spam report  
Fix: Remove invalid email, try OAuth mode, avoid repeat sends; escalate if frequent

---

# 🧠 Diagnosing Email Delivery Flow (REX Workflow)

1) Determine email mode  
> “Are you sending from Gmail/Outlook or via HirePilot?”

2) Identify error type  
- Sending, receiving, spam, reply-routing?

3) Check integrations  
- Re-auth Gmail/Outlook as needed  
- If SendGrid incident suspected and multi-user impact → escalate

4) Provide tailored fix  
- Step-by-step guidance per symptom

5) Escalate if system error  
Include: Workspace ID, sender email, recipient email, message ID, timestamp, whether OAuth connected

---

# 💬 REX Conversational Scripts

How emails are sent:
> “HirePilot can send either through your Gmail/Outlook inbox or via our system. You still get full reply tracking.”

Gmail reconnect:
> “Your Gmail connection looks expired — let’s reconnect it in two clicks from Settings → Email Integrations.”

Submission not delivered:
> “Let’s resend and double‑check the client’s email. Occasionally the first message lands in spam.”

Reply not showing:
> “Looks like the reply didn’t route correctly. I’ll help fix your email connection and escalate if needed.”

---

# 🚨 When REX Must Escalate Immediately

- Replies not appearing in ANY threads  
- SendGrid inbound webhook down  
- Gmail/Outlook tokens rejecting system-wide  
- Messages not sending across multiple users  
- Submission emails not generating  
- DNS failures for reply routing  
- Auth errors after correct OAuth  
- Backend 500s from email endpoints  

Ticket must include:
- Workspace ID, Email type (Gmail/Outlook/SendGrid), Message or Candidate ID, Error text, User email, Recipient email, Workflow attempted

---

# 🔗 Related Files

- `gmail-outlook-integration.md`  
- `sendgrid-events.md`  
- `submissions-and-feedback.md`  
- `workflows-automation.md`  
- `errors-and-troubleshooting.md`

