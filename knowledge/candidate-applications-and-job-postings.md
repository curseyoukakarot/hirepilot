# Candidate Applications & Job Posting Workflows  

candidate-applications-and-job-postings.md

(Public job posts, application flows, automations, attachments, parsing, and triage)

### Full Internal Documentation for REX (Support Agent)

---

## 🎯 Purpose of This File  

This file trains REX to clearly explain:

- How users publish job postings  
- How public application links work  
- How candidates move into pipelines  
- How resumes are parsed  
- How the Hiring Manager & Recruiter views differ  
- How application screening logic works  
- How to fix common issues  
- How special scenarios (guest collaborators, agencies, clients) behave  
- How to troubleshoot pipeline misconfigurations  
- How automations (REX, Zapier, Make) are triggered by new applicants  

This workflow must be explained CONVERSATIONALLY with step-by-step clarity.

---

# 📢 How Users Create Job Postings

Recruiters can create job postings (“Job REQs”) in:

- Job REQs page  
- Deals → Opportunities (attach Job REQ)  
- From Candidates page (Create REQ quickly)

Each Job REQ includes:

- Title  
- Department / Category  
- Location (hybrid, remote, onsite)  
- Compensation  
- Job description  
- Custom questions (optional)  
- Hiring team (team members + guest collaborators)  
- Pipeline template  
- Application settings  
- Notification rules  

---

# 🔗 PUBLIC JOB POST LINK

Every Job REQ automatically generates a public job link:

Example:  
`https://hirepilot.com/jobs/{slug}`

The link is:

- Shareable on LinkedIn, Indeed, social media  
- Embeddable on company websites  
- Copyable from the Job REQ sidebar  
- Indexed in the workspace’s Job Board (if enabled)

A user can disable the link via “Application Settings.”

---

# 📝 APPLICATION FORM (Public)

Applicants fill out a job-specific form:

- Name  
- Email  
- Phone (optional)  
- Resume (PDF, DOCX)  
- LinkedIn URL  
- Answers to custom questions  
- Cover letter (optional)  
- Portfolio links (optional)  

HirePilot does:

- Resume parsing  
- Skill extraction  
- Experience + title mapping  
- Candidate creation  
- Pipeline placement  
- Notifications  

---

# 🎯 HOW APPLICANTS BECOME CANDIDATES

When an applicant submits:

1) HirePilot creates a Candidate record  
2) Candidate is tied to the Job REQ  
3) Candidate is placed in Stage #1 of the REQ’s pipeline  
4) Candidate is visible in:  
   - Candidate Drawer  
   - Job REQ → Candidates tab  
   - Global Candidates page  
5) Resume is parsed and displayed  
6) Recruiter + Hiring Manager get notified  
7) Any automations tied to “new applicant” fire:  
   - REX workflows  
   - Zapier triggers  
   - Make.com flows  
   - Slack notifications  
   - Email alerts  

---

# 🧠 RESUME PARSING LOGIC

HirePilot parses:  

- Job titles  
- Seniority  
- Skills  
- Tenure  
- Summary  
- Education  
- Keywords  
- Location  
- Languages  
- Email + phone  

Parsed data is shown in the candidate drawer.

Common issues:

- Old resume formats (“photo résumé”)  
- Image-only PDF (OCR required)  
- Multiple resumes in zip file  

REX guidance:
> “Can you upload a standard PDF or DOCX? The resume on file lacks text we can extract.”

---

# 🧩 ATTACHMENTS & ADDITIONAL FILES

Candidates can upload:

- Resume  
- Cover letter  
- Portfolio  
- Work samples  
- Certifications  

Recruiters can upload additional files later:

- Offer letters  
- Docs from interviews  
- Assessments  
- Technical projects  

---

# 🧪 CUSTOM APPLICATION QUESTIONS

Users can add questions:

- Short answer  
- Long answer  
- Dropdown  
- Multiple-choice  
- File upload  

Data is saved to:

- Candidate profile  
- Job REQ  
- Tables (if configured)  
- Zapier / Make triggers  

REX guidance example:
> “To add custom questions, go to your Job REQ → Application Settings → Add Question.”

---

# 🧱 PIPELINE PLACEMENT LOGIC

HirePilot uses the pipeline defined on the Job REQ.

Common stages:

- Applied  
- Screen  
- Interview  
- Final Interview  
- Offer  
- Hired  
- Rejected  

Pipeline is customizable.

---

# 📣 NOTIFICATIONS (Critical)

When a new candidate applies:

## Recruiter notification options:
- Email  
- Slack channel  
- In-app notification  
- Zapier trigger  
- Make.com trigger  
- REX workflow trigger  

## Hiring manager options:
- Email  
- Slack DM  
- In-app  

If notifications fail:
> “Let me re-enable your notifications — sometimes email settings need a refresh.”

---

# 🔧 TROUBLESHOOTING COMMON ISSUES

## “Applicants aren’t showing up.”
Possible causes:
- Public link disabled  
- Wrong workspace  
- Wrong REQ selected  
- Candidate filtered out  
- Duplicate suppression  
- Parsing failed  
Fix:
- Check REQ settings  
- Re-enable public link  
- Refresh candidate list  
- Search by email  

## “Candidates aren’t going to the right stage.”
Causes:
- Pipeline edited after creation  
- Automations changing stages  
- Zapier flow overwriting stage  
Fix:
- Reset pipeline  
- Disable faulty workflow  

## “Resume parsing failed.”
Causes:
- Image-only PDF  
- Password-protected PDF  
- Corrupt file  
Fix:
- Ask for new PDF  

## “Hiring manager didn’t receive new applicant notification.”
Fix:
- Add hiring manager to Job REQ team  
- Ensure email is verified  
- Check notification toggles  
- Check spam folder  

---

# 🎛 APPLICATION SETTINGS

Options include:

- Require resume  
- Allow cover letter  
- Allow multiple file uploads  
- Enable job board visibility  
- Enable/disable public link  
- Require applicant questions  
- Choose pipeline template  

---

# 🧩 HOW GUEST COLLABORATORS WORK

Guest collaborators can:

- View candidates  
- Leave notes  
- Move candidates through stages  
- Download resumes  

They CANNOT:

- Change application settings  
- Edit job description  
- Modify pipeline  
- Delete candidates  
- Access Deals or Billing  

---

# ⚙️ AUTOMATIONS ON APPLICATION SUBMISSION

## REX Automations:
- Auto-tag candidate  
- Auto-screen (keyword matching)  
- Auto-reject  
- Auto-send nurture email  
- Auto-request assessment  
- Auto-update Tables  

## Zapier Workflows:
- Send new applicant to ATS  
- Add to spreadsheet  
- Send intro email  
- Notify hiring manager  
- Push to Monday.com  

## Make.com Workflows:
- Push to CRM  
- Add to Recruiting OS  
- Send text messages  
- Trigger background check APIs  

---

# 💡 REX Conversational Examples

Posting a job:
> “Go to Job REQs → New Job → fill in the details → then copy the public link. Want me to generate a job description for you?”

Candidate not visible:
> “Let me look them up — what email did they apply with?”

Embedding the job:
> “You can paste the embed code on your site — I can generate it for you.”

Adding more questions:
> “Great idea — let’s add custom application questions to screen better up front.”

---

# 🔗 Related Files  

- `job-reqs.md`  
- `candidates.md`  
- `pipelines.md`  
- `applications-api.md`  
- `rex-automations.md`  

