/**
 * Script: seedSupportTools.ts
 * Description:
 * Seeds the support_knowledge table with REX tool schemas
 * so the Support Agent can explain them (restricted only).
 */

const fetchFn: typeof fetch = (globalThis as any).fetch;

const tools = [
  {
    type: 'tool',
    title: 'moveCandidateStage',
    content: `Moves a candidate from one pipeline stage to another.
Input: candidateId, stageId
Output: success/failure
Restricted: true
Explanation: "To move a candidate, open your pipeline, drag the candidate card to the new stage, or ask REX in chat."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'enrichCandidate',
    content: `Enriches a candidate profile with additional data from Apollo, LinkedIn, or enrichment providers.
Input: candidateId
Output: enrichment fields (email, company, title, etc.)
Restricted: true
Explanation: "To enrich a candidate, open their profile drawer and click 'Enrich'. REX can also do this for you in chat."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'sendLinkedInRequest',
    content: `Sends a LinkedIn connection request with an optional note.
Input: candidateId, message
Output: success/failure
Restricted: true
Explanation: "To send a connection request, open the candidate drawer → LinkedIn → 'Send Request'. REX can also do this in Slack or chat."`,
    restricted: true,
  },
  {
    type: 'tool',
    title: 'generateMessage',
    content: `Generates outreach messages using AI templates.
Input: campaignId, candidateId
Output: message draft
Restricted: true
Explanation: "To generate a message, open the Message Generator tab inside your campaign."`,
    restricted: true,
  },
];

async function seedTools() {
  const base = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || 'http://localhost:8080';
  const url = `${base.replace(/\/$/, '')}/api/support/ingest`;
  const resp = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
    },
    // Backend expects { items: [...] }
    body: JSON.stringify({ items: tools }),
  });

  if (!resp.ok) {
    console.error('❌ Failed to seed tools:', await resp.text());
    process.exit(1);
  }

  const body = await resp.json().catch(() => ({}));
  console.log('✅ Tools seeded successfully!', body);
}

seedTools().catch((e) => { console.error(e); process.exit(1); });


