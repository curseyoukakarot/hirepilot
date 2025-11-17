# Team Management — Full Support Guide

team-management.md

(Invites, Roles, Seats, Guest Access, Billing, Troubleshooting, Best Practices)

## Purpose of This File

This document teaches REX how to:

- Help users add team members  
- Explain how seat billing works  
- Troubleshoot invite issues  
- Diagnose login problems for invited users  
- Explain role differences (Admin, Member, Guest)  
- Walk users through permissions setup  
- Handle offboarding  
- Explain Guest Collaborator access  
- Identify upgrade scenarios  
- Detect when a user is confused about teams vs workspaces  

Team management is used CONSTANTLY — this file prepares REX for 95% of those questions.

---

# ⭐ Understanding Team Management in HirePilot

A **Workspace** represents a company or agency.

Inside it, people get invited as:

- Super Admin  
- Team Admin  
- Member (Recruiter)  
- Guest Collaborator  

Users can be:

- Added  
- Removed  
- Upgraded  
- Downgraded  
- Reassigned  

Seat count depends on the plan.

---

# 🧩 How Team Invites Work (Step-by-Step)

### 1. Admin enters the user’s email
Inside:  
**Settings → Team Management → Invite User**

### 2. HirePilot sends an invitation email  
Email includes:
- Workspace name  
- Role assigned  
- “Accept Invitation” link  

### 3. User clicks the invitation  
They are taken to:
- Signup (if new user)  
- Login (if existing user)  

### 4. Their account becomes linked to the workspace  
- Permissions take effect immediately  
- Their dashboard changes  
- They gain access to tools based on their role  

### 5. Admin sees status change from:
`Pending → Active`

---

# 🧠 Role Assignment Overview

When inviting, Admin selects one:

### ✔ Super Admin  
- Only one per workspace  
- Full control  

### ✔ Team Admin  
- Second-in-command  
- Manages recruiting + team  

### ✔ Member  
- Standard recruiter role  

### ✔ Guest Collaborator  
- Limited external access  

For full role definitions, see `workspace-roles-and-permissions.md`.

---

# 💸 Seat Billing Rules (Important!)

For paid plans:

- Adding a **Member** or **Team Admin** consumes a paid seat  
- Adding a **Guest** does NOT consume a seat  
- Removing a paid user frees a seat immediately  
- If all seats are full, Admin must:
  - Remove a user **OR**
  - Add more seats (via Billing page)

If seat limits block invites:
> “You’ve reached your seat limit. You can either upgrade your plan or free a seat by removing a user.”

---

# 🔥 Troubleshooting Team Invite Problems

This is a HUGE support topic — REX must be excellent here.

## ❌ Invite email not received
Ask user to check:
- Spam folder  
- Promotions tab  
- Correct spelling  
- Any email filters  

If still missing:
- Resend invite  
- Offer direct invite link  
- Escalate if multiple users affected  

## ❌ “Invite link expired”
Fix:
- Admin resends invite  
REX script:
> “Your invite link expired for security reasons. I can help you get a fresh one — let’s resend it.”

## ❌ User stuck in signup loop
Causes:
- Cached session  
- Logged into wrong email  
- Wrong account already exists  
Fix:
- Clear cookies  
- Use incognito  
- Confirm email  

## ❌ User gets “Access Denied”
Causes:
- Wrong role  
- Wrong workspace  
- Link used after switching accounts  
Fix:
- Confirm workspace  
- Confirm role  
- Reassign role if needed  

## ❌ User has no access after joining
Causes:
- Role assigned incorrectly  
- Browser cache  
- Plan restriction  
Fix:
- Confirm role  
- Confirm seat availability  
- Confirm plan  

---

# 🔄 Offboarding Users

When removing a user:

### Removes:
- Workspace access  
- Ability to run REX  
- Ability to see job reqs  
- Ability to manage pipelines  
- Deals access  

### Does NOT remove:
- Ownership of job reqs  
- Historical actions  
- Past data  

Admins must reassign:
- Job req ownership  
- Deals  
- Pipelines  
- Campaigns  

REX must prompt Admin if this step is skipped.

---

# 🧩 Changing a User’s Role

Admins can promote/demote any role except:
- Cannot demote Super Admin  
- Cannot remove Super Admin  
- Cannot convert Members into Guests without freeing seat  

REX should guide:
> “To update their role, go to Settings → Team Management, click the user, and choose the new role.”

---

# 👥 Guest Collaborator Management

Guests are used for clients, hiring managers, partners, analysts.

Guests can:
- View candidates  
- Leave notes  
- Approve/reject submissions  

Guests cannot:
- Run REX  
- Access Deals  
- Create job reqs  
- Use integrations  

If user wants Guests to have more access:  
> “Looks like this is a Guest role, which is intentionally limited. You can promote them to a Member if you want them to have full recruiting access.”

---

# 🔍 Identifying Plan-Related Restrictions

Common examples:

Free Plan:
- Cannot add team members  
- Cannot add Guests  
- Cannot upgrade role  

Starter Plan:
- Limited automations  
- Limited Sniper  
- Only 1 Admin seat  

Team Plan:
- Full access  
- Multiple seats  
- Guest Collaborators  
- Admin delegation  

REX must check plan when diagnosing access issues.

---

# 💬 Common REX Scripts for Team Issues

When user is confused:
> “Totally understandable — team roles and seats can get confusing. Let’s walk through it.”

When user hits seat limit:
> “It looks like your workspace doesn’t have any available seats. We can either free one up or upgrade your plan.”

When guest complains about lack of access:
> “You’re currently a Guest Collaborator, which is designed for limited external access. If you need full recruiting tools, I can help your Admin upgrade your role.”

When invite doesn’t work:
> “Let’s resend your invite — sometimes email providers block the first attempt.”

---

# 🚨 When REX Must Escalate

Escalate if:
- Invite links working inconsistently  
- Users disappear from workspace  
- Role assignment fails to apply  
- Seat count incorrect  
- Guests gaining unwanted access  
- Members losing access randomly  
- Team members not syncing in UI  
- Supabase RLS issues suspected  

Include:
- Workspace ID  
- User ID  
- Desired role  
- Actual role shown  
- Any errors  
- Screenshots if provided  

---

# 🔗 Related Files

- `workspace-roles-and-permissions.md`  
- `account-management.md`  
- `billing.md`  
- `job-reqs.md`  
- `integrations.md`  
- `errors-and-troubleshooting.md`


