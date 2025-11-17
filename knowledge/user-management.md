# User Management in HirePilot  

user-management.md

(Accounts, roles, permissions, login issues, invitations, switching workspaces)

### Complete Support Documentation for REX (Support Agent)

---

## 🎯 Purpose of This File  

This file equips REX to:

- Help users manage their account  
- Explain role types & permissions  
- Troubleshoot login and access issues  
- Add/remove/invite users  
- Diagnose why someone “can’t see” something  
- Explain workspace ownership vs billing ownership  
- Understand collaborator rights  
- Walk through resetting passwords  
- Escalate platform-level authentication issues  
- Explain multi-workspace membership  

User management is a top 3 category of support requests.

---

# 👥 User Roles (The Core)

There are five main user role types inside HirePilot:

## 1. Super Admin
Full control of everything.  
Can:
- Manage billing  
- Access all data  
- Create/delete users  
- View all teams  
- Manage pipelines  
- Edit settings  
- Create/trigger automations  
- Access deals and revenue  
- Access REX tools  
- Delete workspaces  

## 2. Team Admin
Manages their team (not the entire workspace).  
Can:
- Invite/remove team members  
- Manage Job REQs  
- Manage deals  
- View team dashboards  
- Create pipelines  
- Share dashboards  
- Manage settings (team-level)  
Cannot:
- Delete workspace  
- View billing (unless granted)  

## 3. Member (Recruiter / Coordinator)
Can:
- Run campaigns  
- Add leads  
- Manage candidates  
- Use Sniper  
- Create Job REQs  
- Manage own + shared data  
Cannot:
- Manage billing  
- Remove users  
- Access restricted dashboards  
- Edit global pipelines  

## 4. Guest Collaborator (Client Access)
Can:
- View candidates submitted to them  
- Approve/reject  
- Request interviews  
- Leave comments  
Cannot:
- Access full ATS  
- Create REQs  
- View internal notes  
- Use campaigns  
- View other jobs unless shared  

## 5. Read-Only
Early version for external auditors.  
Can:
- View shared data  
Cannot:
- Change status  
- Move candidates  
- Send messages  

---

# 📨 Invitations

Users are invited via:
- Workspace → Team → Invite User  
- Client Portal → Add Collaborator  

Invitation email contains:
- Magic link  
- Email verification  
- Role assignment  

Common issues:
- Invitation expired  
- Wrong email  
- Firewall blocked email  
- User already exists in workspace under another email  

REX fix:
> “Let’s resend your invitation — it will refresh the link and ensure you can get in.”

---

# 👤 Logging In (Support Flow)

Login relies on:
- Email + password  
- Magic link (optional)  
- Reset password flow  
- Email verification  

Common errors & fixes:

## “I never got the login email”
Causes: spam, corporate block, wrong spelling, not verified  
Fix: resend; whitelist domain; verify email; check for typo  

## “Password not working”
Fix:
> “Click ‘Forgot Password?’ — you’ll receive a reset link immediately.”

## “Account says suspended”
Causes: trial expired, billing failed, deactivated by admin  
Fix: route to billing/workspace owner  

## “Link expired”
Fix: send a fresh magic link  

---

# 🔄 Switching Workspaces

Users may belong to multiple workspaces (companies, client workspaces, internal testing).  
Switch: avatar (top-right) → select workspace.

Support flow:
> “Let’s check if you’re in the right workspace. Click your profile picture and pick the correct workspace.”

If workspace not visible:
- Not added yet  
- Invitation pending  
- Wrong email used  

---

# 🔐 Permissions Matrix (High-Level)

## Leads
- Super Admin: all  
- Team Admin: team leads  
- Member: own (unless shared)  
- Collaborator: none  

## Candidates
- Super Admin: all  
- Team Admin: all team REQs  
- Member: assigned REQs  
- Collaborator: submitted candidates only  

## Pipelines
- Editable: Super Admin, Team Admin  

## Deals & Billing
- Visible: Super Admin, Team Admin, Members (limited)  
- Not visible: Collaborators  

## Messaging / Campaigns
- Member: own only  
- Team Admin: team-level  
- Super Admin: all  
- Collaborator: none  

---

# 🧪 Common User Confusions (And REX Responses)

## “Why can’t I see candidates my teammate added?”
> “You’re likely on different Job REQs. Candidates belong to their assigned REQ. Let’s confirm which REQ your teammate used.”

## “Why can’t I see deals?”
> “Deals are permission-based. You might need Team Admin access to view the Deals module.”

## “Why can’t my client see this candidate?”
> “Clients only see candidates submitted to them. Let’s confirm a submission was sent for this Job REQ.”

## “Why can’t I move stages?”
> “You might not have permission to edit pipelines. I’ll check your role.”

---

# 🔄 Adding / Removing Users

## Add User
1) Team → Invite  
2) Enter email  
3) Assign role  
4) Send  

## Remove User
1) Team → Members  
2) Select user  
3) Remove/deactivate  
4) Reassign candidates, leads, deals  

REX should ask:
> “Do we need to reassign their records before removal?”

---

# 🗃️ Ownership Rules

## Workspace Owner
- Created the workspace  
- Ultimate permission  
- Cannot be removed by others  
- Can transfer ownership  

## Billing Owner
- Manages subscription  
- Receives Stripe invoices  
- Updates payment method  

## Team Admin
- Manages hiring team  
- Cannot manage subscription or delete workspace  

---

# 🔔 Notifications & User Management

Notifications fire on:
- Invitation sent/accepted  
- User removed  
- Role changed  
- Workspace ownership transferred  

---

# ⚠️ Troubleshooting Access Problems

## “User cannot see their REQ”
Check assignment, team, REQ archived state, correct workspace  

## “User cannot see candidates”
Check candidate assignment, team permissions, pipeline lock, private candidates  

## “Client cannot log into portal”
Resend portal link; ensure email matches; confirm at least one submission; avoid forwarded links  

## “User cannot upgrade plan”
Only billing/workspace owner; check payment failure  

---

# 🚨 When REX MUST Escalate

Escalate if:
- User permanently locked out  
- Login failing for multiple users  
- Email verification API failing  
- Team permissions not applying  
- Collaborators see internal data  
- Users see other clients’ data (critical)  
- Workspace ownership lost  
- Stripe subscription corrupted  

Ticket must include:
- User email, Workspace ID, Role  
- Browser/device  
- Steps taken, screenshot  
- Associated REQ/candidate (if relevant)  

---

# 🔗 Related Files  

- `client-portal.md`  
- `authentication.md`  
- `billing-and-subscription.md`  
- `collaborators.md`  
- `pipelines.md`  

