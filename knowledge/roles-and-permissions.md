# Roles & Permissions in HirePilot

roles-and-permissions.md

(FOUNDATION → Access, Roles & Team Structure)

## Who this is for
Anyone working in a team or collaborative workspace, or anyone confused about why certain features appear locked/hidden/disabled.  
Also used heavily by the Support Agent to route issues correctly.

## TL;DR
- HirePilot has 4 primary roles: **Super Admin**, **Team Admin**, **Member**, and **Guest Collaborator**.
- Each role determines what a user can see, edit, automate, send, and integrate.
- Permissions are enforced at workspace level and sometimes at object level (Deals, REQs, Candidates).
- Many “I can’t see this feature” issues are permission-related; REX must always check the user role before suggesting actions.

---

# 🎭 The Four Core Roles

## 1. Super Admin (Owner)
This role is assigned to the person who created the workspace.  
Super Admins have unlimited control and full visibility.

### **Capabilities**
- Manage billing & subscriptions  
- Add/remove Team Admins & Members  
- View all Deals, REQs, Candidates, Pipelines  
- Configure global integrations (Slack, SendGrid, Apollo, Browserless)  
- Control REX access & limits  
- Full credit allocation management  
- View all activity logs  
- Manage all Tables & Dashboards  
- Access to all workflow triggers  
- Override permissions  
- Approve enterprise integrations  
- Assigned automatically to the workspace creator

### **Cannot**
- Nothing (full system permissions)

---

## 2. Team Admin
This is a manager-level seat, designed for recruiting leads, ops leads, and agency managers.

### **Capabilities**
- Add Members & Collaborators  
- Manage team-level access  
- Assign REQ and Opportunity ownership  
- Configure team-level Slack notifications  
- View all Deals within the workspace  
- Manage pipelines  
- Manage workflows  
- Access LinkedIn Automation (Pro+)  
- Create custom dashboards for the team  
- View and manage all Lead/Candidate records (unless privacy flags applied)

### **Cannot**
- Manage workspace billing  
- Change subscription or credit add-ons  
- Access certain owner-only integrations  
- Delete the workspace

---

## 3. Member
General seat for individual recruiters, sourcers, and coordinators.

### **Capabilities**
- Create/edit Leads  
- Create/edit Candidates  
- Run campaigns (email + LinkedIn)  
- Use REX tools  
- Add notes, upload files  
- Move candidates through REQ pipelines  
- Create Opportunities (but not manage Billing)  
- Capture from Chrome Extension  
- Use enrichment (within workspace credit limits)

### **Cannot**
- Manage billing  
- Manage team roles  
- Create or edit global workflows  
- Access admin-only integrations  
- Change workspace-wide settings  
- Access all Deals unless assigned  
- Create Invoices (Team Admin+ only)

---

## 4. Guest Collaborator
Perfect for:
- Clients  
- Hiring managers  
- Contract recruiters  
- External partners

Limited and safe by design.

### **Capabilities**
- View assigned REQs  
- View assigned Candidates  
- Add notes & feedback  
- Upload attachments (resume, assessments)  
- Approve/decline submissions  
- Comment on candidate status  
- View limited pipeline progress  
- Participate in shared Dashboards

### **Cannot**
- View Leads  
- Launch campaigns  
- Enrich data  
- View Deals, Billing, Revenue  
- Use REX automations  
- Create new REQs  
- Access Chrome extension features  
- Manage settings or users  

---

# 🧱 Permission Layers Explained
HirePilot uses **3 layers of access control**:

## Layer 1 — Role-Based Permissions  
Determine the user’s “scope” and capabilities.

## Layer 2 — Object Ownership  
For example:
- A Member may only see Opportunities they created  
- A Guest sees only REQs assigned to them  
- A Team Admin sees all REQs but not global billing  
- REX must always check ownership before suggesting actions

## Layer 3 — Feature Flags (Plan-Based)
Some capabilities depend on plan:
- LinkedIn automation → Pro+  
- Advanced enrichment → paid plans  
- Workflow automations → Pro+  
- Deals + Billing → Pro / Team  

---

# 🤖 How REX Uses Permissions
REX should always:

### Step 1: Identify the user’s role  
Using the MCP `lookup_user` tool, the system can check:
- Role  
- Permissions  
- Plan  
- Seat type  
- Available credits  

### Step 2: Tailor responses  
Examples:

**If user = Guest**  
> “You won’t be able to launch a campaign, but you *can* review candidates assigned to you.”

**If user = Member**  
> “You can create Opportunities, but only Team Admins can generate invoices.”

**If user = Free Plan**  
> “LinkedIn automation isn’t included in the Free Plan, but email outreach still works.”

### Step 3: Avoid suggesting unavailable actions  
If user cannot perform an action, REX should:
- Explain why  
- Offer alternatives  
- Suggest upgrade if useful  
- Or escalate to a Team Admin if role mismatch is suspected

---

# 🧪 Troubleshooting Permissions Issues

### **“I can’t see a REQ.”**
Possible reasons:
- Not assigned  
- Team Admin removed your seat  
- Client is a Guest Collaborator  
- You are on Free Plan  
REX should check assignment first.

### **“I can’t run LinkedIn automations.”**
Possible reasons:
- Plan is Free/Starter  
- Role = Guest  
- LinkedIn session not connected  
- Credits at 0  

### **“I can’t create invoices.”**
- Must be Team Admin or Super Admin  
- Access via Deals → Billing tab

### **“I can’t edit dashboards.”**
- Only Super Admin / Team Admin  
- Members can view but not modify

---

# 🔐 When to Escalate (Create a Ticket)
REX must create a ticket if:
- Roles were changed incorrectly  
- Access is inconsistent with plan  
- User was removed from workspace unexpectedly  
- Invoices or Deals are missing data due to permission errors  
- Member cannot view Leads they created  
- Admin access controls glitch  

---

# 👤 Related Files
- `overview.md`  
- `account-settings.md`  
- `billing-invoicing.md`  
- `getting-started.md`  


