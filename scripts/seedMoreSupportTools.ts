/**
 * Script: seedMoreSupportTools.ts
 * Description:
 * Seeds additional REX tool schemas into the support_knowledge table
 * so the Support Agent can explain them but not execute.
 */

const moreTools = [
  {
    type: 'tool',
    title: 'createCampaign',
    content: `Creates a new campaign linked to a Job REQ.
Input: jobReqId, campaignName, messageTemplates
Output: campaignId
Restricted: true
Explanation: "To create a campaign, go to Campaigns → New Campaign, choose your Job REQ, add your sequences, and launch."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'getPipelineView',
    content: `Retrieves pipeline stages and candidate status for a Job REQ.
Input: jobReqId
Output: list of stages with candidate summaries
Restricted: true
Explanation: "Pipelines show you where candidates are in the hiring process. Open a Job REQ and click the Candidates tab to see the full pipeline view."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'addCandidateNote',
    content: `Adds a note to a candidate profile, visible to all collaborators.
Input: candidateId, noteText
Output: confirmation
Restricted: true
Explanation: "To add a candidate note, open their drawer and scroll to the Notes section. Notes are shared with all collaborators."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'searchLeads',
    content: `Sources leads from Apollo, LinkedIn Sales Navigator, or other integrations.
Input: query params (title, company, filters)
Output: lead profiles
Restricted: true
Explanation: "To search leads, go to Leads → New Search. Choose Apollo or LinkedIn as your source and apply filters."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'convertLeadToCandidate',
    content: `Converts a lead into a candidate under a Job REQ pipeline.
Input: leadId, jobReqId
Output: candidateId
Restricted: true
Explanation: "To convert a lead, open the lead profile and click 'Convert to Candidate'. This moves them into your pipeline."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'trackMessageReplies',
    content: `Tracks replies from leads/candidates across LinkedIn or email.
Input: campaignId
Output: reply objects
Restricted: true
Explanation: "To see replies, go to the Replies tab in your campaign. You can also let REX monitor replies in Slack."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'scheduleInterview',
    content: `Schedules an interview with a candidate via integrations (Calendly, Slack, ATS).
Input: candidateId, time, calendarLink
Output: scheduled event confirmation
Restricted: true
Explanation: "To schedule an interview, open the candidate drawer and click 'Schedule'. Integrations like Slack and Calendly make this automatic."`,
    restricted: true,
  },
];

async function seedMoreTools() {
  const base = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || 'http://localhost:8080';
  const url = `${base.replace(/\/$/, '')}/api/support/ingest`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
    },
    body: JSON.stringify({ items: moreTools }),
  });

  if (!resp.ok) {
    console.error('❌ Failed to seed additional tools:', await resp.text());
    process.exit(1);
  }

  const body = await resp.json().catch(() => ({}));
  console.log('✅ Additional tools seeded successfully!', body);
}

seedMoreTools().catch((e) => { console.error(e); process.exit(1); });


