// backend/src/rex/knowledge.widget.ts
export type FlowId = 'launch_campaign'|'connect_email'|'import_leads'|'set_followups'|'book_demo';

export const canonicalFlows: Record<FlowId, { title: string; steps: string[]; source_url: string }> = {
  launch_campaign: {
    title: 'Launch a Campaign',
    steps: [
      'Go to Campaigns → New Campaign',
      'Choose Audience (role, geo, seniority)',
      'Add Messaging (intro + follow-ups)',
      'Import leads (CSV, Apollo, or Sales Navigator)',
      'Review & Launch'
    ],
    source_url: 'https://thehirepilot.com/blog/flow-of-hirepilot'
  },
  connect_email: {
    title: 'Connect Email',
    steps: [
      'Open Settings → Integrations',
      'Connect SendGrid or Google/Outlook',
      'Verify sender and warm up if needed'
    ],
    source_url: 'https://thehirepilot.com/blog/email-troubleshooting'
  },
  import_leads: {
    title: 'Import Leads',
    steps: [
      'Prepare CSV with name, email, company',
      'Go to Leads → Import CSV',
      'Map columns and validate',
      'Import and dedupe'
    ],
    source_url: 'https://thehirepilot.com/blog/import-csv'
  },
  set_followups: {
    title: 'Set Follow-ups',
    steps: [
      'Open Templates → Tiered Messages',
      'Add follow-ups with spacing',
      'Attach template to campaign'
    ],
    source_url: 'https://thehirepilot.com/blog/campaign-wizard'
  },
  book_demo: {
    title: 'Book a Demo',
    steps: ['Pick a time on Calendly', 'Join Zoom from confirmation email'],
    source_url: 'https://thehirepilot.com/pricing'
  }
};

export type Page = { slug: string; title: string; url: string; excerpt: string };
export const whitelistPages: Page[] = [
  { slug: 'home', title: 'Home', url: 'https://thehirepilot.com/', excerpt: 'HirePilot is an AI recruiting platform with campaigns, automations and support.' },
  { slug: 'pricing', title: 'Pricing', url: 'https://thehirepilot.com/pricing', excerpt: 'Plans and tiers with features and limits.' },
  { slug: 'flow-of-hirepilot', title: 'Flow of HirePilot', url: 'https://thehirepilot.com/blog/flow-of-hirepilot', excerpt: 'End-to-end flow: campaigns, audience, messaging, import leads, launch.' }
];

export function searchSupport(q: string, top_k = 5) {
  const query = q.toLowerCase();
  const scored = whitelistPages.map(p => ({ p, score: (p.title + ' ' + p.excerpt).toLowerCase().includes(query) ? 1 : 0 }));
  return scored
    .filter(s => s.score > 0)
    .slice(0, top_k)
    .map(s => ({ title: s.p.title, url: s.p.url, snippet: s.p.excerpt }));
}
