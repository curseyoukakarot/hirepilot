# Workspace Roles & Permissions — Full Support Guide

workspace-roles-and-permissions.md

(All roles, access rules, plan restrictions, troubleshooting, REX scripts)

## Purpose of This File

This document teaches REX how to:

- Understand every workspace role in HirePilot  
- Explain access rights clearly and conversationally  
- Troubleshoot “Access Denied” issues  
- Help users assign or change roles  
- Determine whether a user’s plan restricts access  
- Provide upgrade-safe scripts  
- Distinguish role limitations vs. system errors  
- Identify when a permissions issue is actually a bug  

This is one of the most critical pieces of the Support Agent’s knowledge.

---

# ⭐ Workspace Roles Overview

HirePilot has **5 user types**:

1. **Super Admin**  
2. **Team Admin**  
3. **Member (Recruiter)**  
4. **Guest Collaborator**  
5. **Read-Only Stakeholder** *(rare, internal only)*  

Each role determines:
- Which pages they can access  
- Which actions they can perform  
- What they can create, edit, delete  
- What automation they can trigger  
- What billing they can see  

---

# 🥇 1. Super Admin

**Highest-level workspace access.**  
Role is typically the founder or owner of the account.

### Permissions
- Full access to everything in workspace  
- Manage users & roles  
- Create/delete job reqs & opportunities  
- Access Deals (Clients, Billing, Revenue, Opportunities)  
- Access Pipelines  
- Full Admin Console access  
- API keys  
- Billing + subscription settings  
- Delete workspace  
- Add integrations (Gmail/Outlook/Slack/Chrome/SendGrid)  
- Trigger REX Admin functions  
- Run Sniper across all seats  

### REX Script Example
> “You’re a Super Admin, which means you have unrestricted access to all workspace features.”

---

# 🥈 2. Team Admin

**The operational admin for a workspace.**  
Often used by agency co-founders or managers.

### Permissions
- Manage users (but **cannot** remove Super Admin)  
- Create/edit/delete job reqs  
- Manage Pipelines  
- Manage Deals (Clients & Opportunities)  
- Upload files  
- Assign team members  
- Trigger all REX tools  
- Configure integrations  
- Access workspace dashboards  

### Cannot
- Access **billing** unless workspace owner grants it  
- Delete workspace  
- Remove Super Admin  

### REX Script Example
> “You have Team Admin rights, which gives you full recruiting management access, but billing is restricted to the workspace owner.”

---

# 🥉 3. Member (Recruiter Role)

Standard user type.

### Can
- View job reqs assigned to them  
- View leads & campaigns they own  
- View candidates  
- Manage their own tasks  
- Run REX for assigned reqs  
- Create campaigns & send messages  
- View reports relevant to them  

### Cannot
- Change workspace roles  
- Edit billing  
- Access Admin settings  
- Create new Opportunities unless permissioned  
- See Private Pipelines  

### REX Script Example
> “You’re a Member, which means you can fully recruit and use REX, but you don’t have workspace admin permissions.”

---

# 👥 4. Guest Collaborator

Used for clients, hiring managers, external partners.

### Can
- View candidates for assigned job reqs  
- Add comments or notes  
- Approve/disapprove candidates  
- Upload files  
- Review submissions  

### Cannot
- Run REX or Sniper  
- Access Deals  
- Create job reqs  
- Use Chrome Extension  
- Send campaigns  
- Access internal pipelines  

### REX Script Example
> “Guest Collaborators can review candidates and leave feedback, but recruiting tools like REX, Pipelines, and bulk actions are reserved for internal members.”

---

# 👁 5. Read-Only Stakeholder (Internal Only)

Enterprise-only scenarios.
- View dashboards only  
- Cannot interact, edit, or run automations  

---

# 🚫 Plan-Based Restrictions (Free vs Paid)

## Free Plan Limits
- No Deals/Billing/Revenue  
- Limited daily automations  
- Limited campaigns  
- Limited Sniper usage  
- No Gmail/Outlook sync  
- No team members  
- No Guest Collaborators  
- No REX long-running actions  
- Limited candidate submissions  

### REX Script Example
> “That feature is part of the Starter or Pro plan. I can show you how it works if you’d like to explore upgrading!”

## Starter Plan
- Basic automation & REX  
- Sniper limited  
- 1 Admin  
- Email integration enabled  

## Pro Plan
- Everything included  
- Higher usage thresholds  
- Sniper full power + Browserless + Decodo  
- Deals fully unlocked  
- Multi-admin access  

## Team Plan
- For agencies  
- Multiple seats + Guest Collaborators  
- Full Deals + Billing  
- Custom pipelines  
- Team Admin delegation  

---

# 🧩 Why Permission Errors Happen

Common causes:
1) Role mismatch (e.g., Member changing pipeline templates)  
2) Plan restriction (e.g., Free plan accessing Deals)  
3) Guest trying internal tools (e.g., run REX)  
4) Workspace misconfiguration (Admin forgot to assign access)  
5) Real UI bug (REX must escalate)  

---

# 🔍 Troubleshooting Access Issues (REX Workflow)

### Step 1: Identify the user’s role
- Ask email if unknown; use MCP lookup when possible

### Step 2: Determine the attempted action
- Ask for a screenshot, link, and last action

### Step 3: Determine if it’s
- Role restriction, Plan restriction, Integration restriction, Workspace misconfiguration, or Product bug

### Step 4: Provide tailored guidance
If role-limited:
> “You don’t have access to this section, but here’s how your Admin can grant it…”

If plan-limited:
> “This feature is part of the Pro plan — would you like me to explain what’s included?”

If misconfigured:
> “Looks like this page isn't linked to your role. Here’s how we can fix it…”

If bug:
> “That doesn’t look right — I’ll log this for you immediately.”

---

# 🛠 When REX Should Escalate Permissions Issues

- Super Admin reports access denied  
- Team Admin unable to modify core items  
- Guest seeing internal pages  
- Users losing access after upgrade  
- UI hiding elements incorrectly  
- Role upgrade flows failing  
- New role not applying instantly  
- Changes not syncing from Supabase  

Escalation includes:
- Workspace ID, User ID, Expected role, Actual role  
- Action attempted, Error message, Browser/device details  

---

# 💬 Conversational Scripts for REX

When user confused about access:
> “Totally understandable — roles can get confusing. Let’s check what role you have and make sure it’s set correctly.”

When user needs upgrade:
> “This feature is part of the Pro plan. If you want, I can walk you through what’s included so you can see if upgrading makes sense.”

When user hits “Access Denied”:
> “Let’s take a look — this is usually either a role or permission setting, and I can help you adjust it.”

---

# 🔗 Related Files

- `billing.md`  
- `team-management.md`  
- `job-reqs.md`  
- `pipelines.md`  
- `deals.md`  
- `errors-and-troubleshooting.md`


