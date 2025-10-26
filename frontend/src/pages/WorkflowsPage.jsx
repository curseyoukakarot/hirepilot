import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import WorkflowRecipeModal from '../components/WorkflowRecipeModal';

export default function WorkflowsPage() {
  const [selected, setSelected] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [integrationStatus, setIntegrationStatus] = useState({ slack:false, zapier:false, sendgrid:false, stripe:false, linkedin:false });

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        // Fetch consolidated status from backend settings endpoint if available
        const base = import.meta.env.VITE_BACKEND_URL || '';
        const res = await fetch(`${base}/api/user-integrations`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) {
          const js = await res.json();
          const hasZapier = Boolean(js?.zapier_api_key || js?.api_keys?.zapier);
          const hasSendgrid = Boolean(js?.sendgrid_api_key || js?.api_keys?.sendgrid || js?.sendgrid?.has_keys);
          setIntegrationStatus(s => ({ ...s, zapier: hasZapier, sendgrid: hasSendgrid }));
        }
      } catch {}
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: slackRow } = await supabase.from('slack_accounts').select('id').eq('user_id', user.id).maybeSingle();
          setIntegrationStatus(s => ({ ...s, slack: Boolean(slackRow) }));
        }
      } catch {}
      try {
        const base = import.meta.env.VITE_BACKEND_URL || '';
        const { data: { session } } = await supabase.auth.getSession();
        const stripeRes = await fetch(`${base}/api/stripe/status`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
        const stripeJs = await stripeRes.json().catch(() => ({}));
        setIntegrationStatus(s => ({ ...s, stripe: Boolean(stripeJs?.has_keys || stripeJs?.connected_account_id) }));
      } catch {}
      try {
        const base = import.meta.env.VITE_BACKEND_URL || '';
        const { data: { session } } = await supabase.auth.getSession();
        const liRes = await fetch(`${base}/api/linkedin/check`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
        const liJs = await liRes.json().catch(() => ({}));
        setIntegrationStatus(s => ({ ...s, linkedin: Boolean(liJs?.connected) }));
      } catch {}
    })();
  }, []);

  // Curated in-app workflow recipes (mirrors public /workflows)
  const workflows = [
    // Lead & Prospecting (Sourcing)
    { id: 1, title: 'Apollo → Smart Enrichment & Warm Tagging', category: 'Sourcing', trigger: 'Lead arrives from Apollo', action: "Auto-enrich, score, and tag 'Warm'", tools: ['Apollo', 'HirePilot'], description: "When a lead arrives from Apollo, HirePilot enriches, scores interest, and tags them 'Warm'.", setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Connect your Apollo API key in Settings → Integrations.',
      'Enable “Auto-enrich new Apollo leads” in Workflows.',
      'Optionally set scoring rules under Messaging → Scoring.',
      'Save and test with a sample lead.'
    ] },
    { id: 2, title: 'LinkedIn Connect → Slack Introduction', category: 'Sourcing', trigger: 'New LinkedIn connection (Chrome Extension)', action: 'Tag lead + post Slack message', tools: ['Chrome Extension', 'HirePilot', 'Slack'], description: 'When a connection is made, tag the lead and announce in Slack.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Install/enable the HirePilot Chrome Extension and sign in.',
      'On LinkedIn, click the “LinkedIn Request” button in the extension to send the request.',
      'HirePilot will tag the lead "LinkedIn Request Made" automatically.',
      'In Workflows, create a trigger for leads tagged "LinkedIn Request Made".',
      'Add an action to post a Slack message to your desired channel.'
    ] },
    { id: 3, title: 'Hunter Verified → Send Intro Email via SendGrid', category: 'Sourcing', trigger: 'Email verified by Hunter', action: 'Send personalized intro using SendGrid template', tools: ['Hunter', 'HirePilot', 'SendGrid'], description: 'Auto-send a personalized intro once a verified email is found.', setupTime: '5–10 min', difficulty: 'Beginner', setupSteps: [
      'Connect Hunter: Settings → Integrations → Hunter → paste API key → Connect.',
      'Connect SendGrid: Settings → Integrations → SendGrid → add API key (Mail Send).',
      'Choose or create a Messaging → Template with personalization tokens (e.g., {{lead.first_name}}, {{lead.company}}).',
      'Open the workflow card → confirm trigger (source = Hunter, status = Verified) → select your SendGrid template → Deploy Recipe.',
      'Test: add a new lead via Hunter or Chrome Extension; when verified, an intro email is sent. Check Activity Log → Messaging Events.'
    ] },
    { id: 5, title: 'Lead Tagged “Hiring Manager” → Create Client in CRM', category: 'Sourcing', trigger: "Lead tagged 'Hiring Manager'", action: 'Create client record in Monday.com', tools: ['HirePilot', 'Monday.com'], description: 'Tag leads as “Hiring Manager” to auto-create a client in your CRM.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'When you tag a lead as “Hiring Manager” in HirePilot, this workflow creates a new Client in your Monday.com CRM.',
      'It maps key fields: Name → Lead Name + Company; Email → Lead Email; Status → Prospect; Source → HirePilot.',
      'Open the card → select your Monday board and group (e.g., “Active Clients”).',
      'Confirm trigger filter: tag equals “Hiring Manager”.',
      'Deploy, then tag a test lead to verify the new client appears in Monday.'
    ], copyZap: `⚡ Zap Summary\n\nTrigger: Lead Tagged "Hiring Manager" (from HirePilot)\nAction: Create Client in Monday.com CRM\n\nGoal: When a recruiter tags a lead as “Hiring Manager,” HirePilot automatically creates a Client record in the team’s CRM workspace — using Monday.com’s Boards + Items system.\n\n⸻\n\n🧩 Zap Steps Breakdown\n\nStep 1: Trigger — Lead Tagged “Hiring Manager”\n\nApp: HirePilot\nEvent: lead_tag_added\nFilter: payload.tag == "hiring manager"\n\nThis fires every time a recruiter manually or automatically applies the tag “Hiring Manager” to a lead.\nHirePilot emits this event via its Universal Events API:\n\nGET /api/zapier/triggers/events?event_type=lead_tag_added&since={{now}}\n\nSample payload:\n\n{\n  "event_type": "lead_tag_added",\n  "payload": {\n    "entity": "leads",\n    "entity_id": "lead_123",\n    "tag": "hiring manager",\n    "lead": {\n      "name": "Alex Rivera",\n      "company": "CloudSync Labs",\n      "email": "alex@cloudsync.io"\n    }\n  }\n}\n\n⸻\n\nStep 2: Filter (Optional)\n\nOnly continue if:\n\nTag = "Hiring Manager"\n\nThis ensures that only hiring decision-makers get converted into clients, not general leads.\n\n⸻\n\nStep 3: Action — Create Client Record in Monday.com\n\nApp: Monday.com\nEvent: Create Item\nBoard: “Clients” (or your CRM board)\nGroup: “Active Clients” (default group or configurable)\n\nHirePilot sends the payload to Monday’s GraphQL API through your connected integration.\nExample request:\n\nmutation {\n  create_item(\n    board_id: 1234567890,\n    group_id: "active_clients",\n    item_name: "Alex Rivera - CloudSync Labs",\n    column_values: "{\\\"email\\\":\\\"alex@cloudsync.io\\\",\\\"company\\\":\\\"CloudSync Labs\\\",\\\"status\\\":\\\"Prospect\\\"}"\n  ) {\n    id\n  }\n}\n\n✅ Result:\nA new Client item is created in your CRM board under Active Clients, pre-filled with:\n  • Client Name: Lead name + company\n  • Email: Lead email\n  • Source: HirePilot\n  • Status: Prospect (or configurable)\n  • Owner: Recruiter who tagged the lead\n\n⸻\n\nStep 4 (Optional): Notify in Slack\n\nAdd an optional step to alert your team:\nApp: Slack\nEvent: Post message\nChannel: #client-updates\nMessage:\n\n🧑‍💼 New client added: Alex Rivera (CloudSync Labs) from HirePilot.\n\n⸻\n\n🧱 What the User Actually Configures\n\nWhen setting up the card in guided mode, the user selects:\n  1. Trigger Source: HirePilot → Lead Tagged\n  2. Tag Filter: Hiring Manager\n  3. Action App: Monday.com\n  4. Board: Select their CRM board\n  5. Group: Choose where new clients should go (e.g., “Prospects”)\n  6. Field Mapping:\n    • Name → Lead Name + Company\n    • Email → Lead Email\n    • Notes → Auto-filled with “Imported from HirePilot”\n\nThen they hit Deploy Recipe.\n\n⸻\n\n🕒 Example Timeline\n  • 12:05 PM → Recruiter tags a lead as “Hiring Manager.”\n  • 12:06 PM → HirePilot emits event → Zap triggers.\n  • 12:07 PM → Monday.com client item created + Slack alert sent.\n` },

    // Messaging & Campaigns
    { id: 6, title: 'Lead Replied → Notify Recruiter in Slack', category: 'Messaging', trigger: 'Reply detected', action: 'Post Slack alert with message text', tools: ['HirePilot', 'Slack'], description: 'Real-time Slack alerts when prospects or candidates reply.', setupTime: '3 min', difficulty: 'Beginner', setupSteps: [
      'Enable Slack Notifications: Go to Settings → Integrations → Slack in HirePilot. Click Connect Slack, choose your workspace, and approve access.',
      'Select a Notification Channel: After connecting, choose the Slack channel for reply alerts (e.g., #recruiting-alerts) and save as your default.',
      'Turn On Reply Alerts: Navigate to Settings → Notifications and toggle on “Lead or Candidate Replies”.',
      'What Happens: Whenever a lead or candidate replies, HirePilot instantly sends a Slack notification (e.g., “Alex from CloudSync Labs just replied to your message about ‘Senior Product Manager.’”). No Zapier/Make needed.'
    ] },
    { id: 7, title: 'Lead Source: Skrapp → Launch Warm-Up Sequence', category: 'Messaging', trigger: 'Lead from Skrapp', action: "Start 'Intro + Reminder' sequence with SendGrid tracking", tools: ['Skrapp', 'HirePilot', 'SendGrid'], description: 'Warm up Skrapp leads with a gentle sequence and tracking.', setupTime: '5–10 min', difficulty: 'Beginner', setupSteps: [
      'Automatically warm up new Skrapp-sourced leads the moment they’re verified.',
      'HirePilot detects the lead, connects it to your SendGrid sender, and launches a prebuilt warm-up email sequence — no manual setup needed.'
    ], copyZap: `⚙️ Setup Steps\n\t1.\tConnect Skrapp\n\t•\tGo to Settings → Integrations → Skrapp in HirePilot.\n\t•\tAdd your Skrapp API Key so HirePilot can detect new verified emails from Skrapp.\n\t•\tOnce connected, HirePilot automatically tracks new leads with the source "skrapp".\n\t2.\tSelect or Create a Sequence Template\n\t•\tNavigate to Messaging → Sequences in HirePilot.\n\t•\tChoose an existing “Warm-Up” template or create a new one with 2–3 light-touch emails.\n\t•\tCopy the template_id (you’ll use it in your API request).\n\t3.\tConnect SendGrid Sender\n\t•\tIn Settings → Senders, connect your SendGrid account.\n\t•\tVerify the domain and choose a default “from” sender to power the sequence.\n\t4.\tActivate the API Trigger\nUse HirePilot’s lead_source_added trigger to detect new Skrapp leads:\n\nGET /api/zapier/triggers/events?event_type=lead_source_added&since={{now}}\n\nThen filter for Skrapp leads and launch your sequence:\n\ncurl -X POST https://api.thehirepilot.com/api/messages/bulk-schedule \\\n-H "X-API-Key: YOUR_API_KEY" \\\n-H "Content-Type: application/json" \\\n-d '{\n  "template_id": "warmup_template_001",\n  "lead_ids": ["{{lead_id}}"],\n  "sender": "sendgrid"\n}'\n\n\n\t5.\tTest the Recipe\n\t•\tAdd a new Skrapp lead.\n\t•\tConfirm HirePilot logs the event and SendGrid sends your warm-up sequence automatically.\n\n⸻\n\n💡 What Happens\n\nEvery time a verified lead is imported from Skrapp, HirePilot automatically triggers your SendGrid warm-up sequence using your selected message template — keeping new contacts engaged immediately, with zero manual effort.\n` },
    { id: 8, title: 'Campaign Relaunched → Team Announcement + Stats', category: 'Messaging', trigger: 'Campaign relaunched', action: 'Push stats summary to Slack', tools: ['HirePilot', 'Slack'], description: 'Announces when a campaign is relaunched, sharing last run metrics and alerting the team that a new send is underway.', setupTime: '3 min', difficulty: 'Beginner', setupSteps: [
      'Connect your Slack workspace in HirePilot → Settings → Integrations.',
      'Enable the Campaign Relaunched trigger in the Workflows tab.',
      'Add a Slack message action using your desired channel (e.g., #campaign-updates).',
      'Save & run — HirePilot will auto-post relaunch updates with recent performance stats.'
    ], copyZap: `⚙️ Workflow: Campaign Relaunched → Team Announcement + Stats (Pre-Send Version)\n\n🧠 What It Does\n\nAs soon as someone relaunches a campaign in HirePilot, this workflow posts a Slack update announcing the relaunch — showing how the campaign performed last time and what’s about to go out next.\nIt keeps everyone in sync before the next send wave begins.\n\n⸻\n\n🚀 Setup Steps\n\t1.\tConnect Slack\n\t•\tIn HirePilot → Settings → Integrations, connect your Slack workspace.\n\t•\tChoose a default channel like #campaign-updates.\n\t2.\tEnable the Trigger\n\t•\tThis automation listens for the campaign_relaunched event from HirePilot’s Zapier or API trigger feed:\n/api/zapier/triggers/events?event_type=campaign_relaunched\n\t3.\tPull the Previous Metrics Snapshot\n\t•\tFetch the latest campaign stats to include:\n/api/sourcing/campaigns/{{campaign_id}}/stats?emit=true\n\t•\tCommon fields: sent, open_rate, reply_rate, click_rate.\n\t4.\tPost to Slack\n\t•\tUse a Slack webhook or the HirePilot Slack integration to send a formatted message:\n\n📢 *{{campaign.name}}* relaunched!\n• Last Run: {{stats.sent}} sent\n• Opens: {{stats.open_rate}}%\n• Replies: {{stats.reply_rate}}%\n• Clicks: {{stats.click_rate}}%\n\nNext batch is queued and sending now 🚀\n\n\n\n⸻\n\n💬 Example Slack Message\n\n📢 Tech Sales Outreach (Q4) relaunched!\n• Last Run: 420 sent\n• Opens: 56%\n• Replies: 21%\n• Clicks: 8%\n\nNext batch is queued — keep an eye on the replies channel 👀` },
    { id: 9, title: 'High-Performing Template → Clone to New Campaign', category: 'Messaging', trigger: '>45% open rate detected', action: "Clone template to 'Top Performers' folder", tools: ['HirePilot'], description: 'Automatically surface winning templates for reuse.' },
    { id: 10, title: 'Reply Detected → Update Candidate Profile in Notion', category: 'Messaging', trigger: 'Reply received', action: "Append last message to candidate's Notion timeline", tools: ['HirePilot', 'Notion'], description: 'Keep Notion profiles updated with latest replies.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Connect Notion in HirePilot → Settings → Integrations.',
      'Enable the Reply Detected trigger in the workflow builder.',
      'Choose your target Notion database (e.g., “Candidate Tracker”).',
      'Map HirePilot reply fields (name, job, reply text, timestamp) to Notion properties, then save & deploy.'
    ], copyZap: `⚙️ Workflow: Reply Detected → Update Candidate Profile in Notion\n\n🧠 How It Works\n\nWhenever a prospect or candidate replies inside HirePilot, this automation instantly updates their record inside your connected Notion database, keeping your notes and reply history perfectly synced.\n\n⸻\n\n💡 Modal One-Line + 4-Step Overview\n\nWhat This Does:\nAutomatically updates your Notion candidate profiles whenever a new reply is detected in HirePilot.\n\nSetup Steps:\n1️⃣ Connect Notion in HirePilot → Settings → Integrations.\n2️⃣ Enable the Reply Detected trigger in the workflow builder.\n3️⃣ Choose your target Notion database (e.g., “Candidate Tracker”).\n4️⃣ Map HirePilot reply fields (name, job, reply text, timestamp) to Notion properties, then save & deploy.\n\n⸻\n\n🔧 Zapier Detailed Setup\n\nTrigger:\n\t•\tApp: HirePilot\n\t•\tEvent: Reply Detected (/api/zapier/triggers/events?event_type=message_reply)\n\t•\tOutput Fields: candidate name, email, job title, message body, reply timestamp.\n\nAction:\n\t•\tApp: Notion\n\t•\tEvent: “Update Database Item” (or “Create Database Item” if new).\n\t•\tChoose your Notion database: Candidate Profiles.\n\nMap Fields:\n\nHirePilot Field\tNotion Property\tExample\ncandidate.name\tName\t“Sarah Johnson”\njob.title\tRole\t“Frontend Engineer”\nmessage.body\tLatest Reply\t“Hi! I’m open to a chat.”\nmessage.timestamp\tLast Contacted\t2025-10-25T19:32Z\n\nOptional: Add a filter step — only update if reply contains specific keywords like “interested” or “available”.\n\nResult:\nEvery time a reply arrives, your Notion workspace reflects the latest conversation details automatically — no manual copy/paste.\n` },

    // Client & CRM
    { id: 11, title: 'Client Created → Auto-Enrich + Slack Welcome', category: 'Client Experience', trigger: 'client_created', action: "Enrich company + send Slack 'Client added'", tools: ['HirePilot', 'Slack'], description: 'New clients are enriched and announced instantly.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Connect Slack under HirePilot → Settings → Integrations.',
      'Enable the Client Created trigger (/api/events/client_created).',
      'Add Auto-Enrich Client as the first action to pull company details (industry, size, revenue).',
      'Add Slack Notification to announce the client in #client-updates or your chosen channel.'
    ], copyZap: `⚙️ Workflow: Client Created → Auto-Enrich + Slack Welcome\n\n🧠 What It Does\n\nWhenever a new client record is created in HirePilot, the system automatically enriches their company data (using built-in enrichment APIs) and posts a welcome announcement in your team’s Slack channel.\n\n⸻\n\n💡 Modal Overview (1-line + 4 Steps)\n\nWhat This Does:\nAutomatically enriches new clients and sends a Slack “Welcome” message with company info.\n\nSetup Steps:\n1️⃣ Connect Slack under HirePilot → Settings → Integrations.\n2️⃣ Enable the Client Created trigger (/api/events/client_created).\n3️⃣ Add Auto-Enrich Client as the first action to pull company details (industry, size, revenue).\n4️⃣ Add Slack Notification to announce the client in #client-updates or your chosen channel.\n\n⸻\n\n🔧 Zapier / API Detailed Setup\n\nTrigger (HirePilot):\n\t•\tEvent: client_created\n\t•\tEndpoint:\n\nGET /api/zapier/triggers/events?event_type=client_created&since={{now}}\n\n\n\t•\tSample Payload:\n\n{\n  "id": "evt_321",\n  "event_type": "client_created",\n  "created_at": "2025-10-25T18:50:00Z",\n  "payload": {\n    "client_id": "cli_987",\n    "client_name": "Acme Corporation",\n    "contact": "Trish Kapos",\n    "email": "trish@acmecorp.com",\n    "created_by": "recruiter@hirepilot.com"\n  }\n}\n\n\n\n⸻\n\nAction 1 – Enrich Client (HirePilot):\n\t•\tEndpoint:\n\nPOST /api/clients/:id/sync-enrichment\n\n\n\t•\tBody Example:\n\n{\n  "id": "cli_987"\n}\n\nReturns updated fields such as:\n\n{\n  "company_size": "200-500",\n  "industry": "Fintech",\n  "website": "https://acmecorp.com",\n  "founded_year": 2012\n}\n\n\n\n⸻\n\nAction 2 – Slack Notification:\n\t•\tApp: Slack\n\t•\tEvent: “Send Channel Message”\n\t•\tChannel: #client-updates\n\t•\tMessage Template:\n\n🎉 New client added: *{{payload.client_name}}*\n👤 Contact: {{payload.contact}}  \n🌐 Website: {{enrichment.website}}  \n🏢 Industry: {{enrichment.industry}}  \n👥 Team Size: {{enrichment.company_size}}  \nAdded by: {{payload.created_by}}\n\n\n\n⸻\n\nResult:\nEach time a client is added in HirePilot, your team sees an instant Slack message like:\n\n🎉 Acme Corporation added to HirePilot!\n🌐 acmecorp.com | 🏢 Fintech | 👥 200–500 employees\nAdded by: @Trish Kapos\n` },
    { id: 12, title: 'Client Updated → Send Snapshot to Notion CRM', category: 'Client Experience', trigger: 'client_updated', action: 'Update Notion CRM card via Make.com', tools: ['HirePilot', 'Make.com', 'Notion'], description: 'Sync client updates to your Notion CRM automatically.', setupTime: '5–10 min', difficulty: 'Beginner', setupSteps: [
      'Connect Make.com and Notion in HirePilot → Settings → Integrations.',
      'Enable the Client Updated trigger (/api/events/client_updated).',
      'Choose your target Notion database (e.g., “CRM – Clients”).',
      'Map client fields (name, company size, owner, notes) to Notion properties, then deploy.'
    ], copyMake: `⚙️ Make.com Setup (Advanced Automation)\n\nTrigger (HTTP Module):\n\t•\tType: Watch Events\n\t•\tURL: https://api.thehirepilot.com/api/zapier/triggers/events?event_type=client_updated\n\t•\tPoll interval: Every 5 minutes\n\nStep 1 – Transform JSON:\nUse “Parse JSON” to extract fields (client_name, industry, owner, website, etc.)\n\nStep 2 – Notion (Update Database Item):\n\t•\tDatabase: “Clients”\n\t•\tMap:\n\t•\tName → client_name\n\t•\tIndustry → industry\n\t•\tWebsite → website\n\t•\tLast Updated → updated_at\n\t•\tOwner → owner\n\nStep 3 (Optional) – Slack Notification:\nAfter updating Notion, add a “Send Message” action to announce:\n\n“📊 Client Nova Tech was updated in Notion CRM. Owner: John Rivera.”\n\n⸻\n\nResult:\nEvery time a client’s details are changed in HirePilot, the corresponding Notion page updates within seconds — keeping all CRM dashboards perfectly aligned without manual syncing.\n`, copyZap: `⚙️ Workflow: Client Updated → Send Snapshot to Notion CRM\n\n🧠 What It Does\n\nEach time a client record is updated in HirePilot — such as new notes, recent activity, or enrichment changes — a structured snapshot of the client’s data is automatically sent to your Notion CRM, ensuring your team always sees the latest details.\n\n⸻\n🔧 Zapier Detailed Setup\n\nTrigger (HirePilot):\n\t•\tEvent: client_updated\n\t•\tEndpoint:\n\nGET /api/zapier/triggers/events?event_type=client_updated&since={{now}}\n\n\n\t•\tSample Payload:\n\n{\n  "id": "evt_992",\n  "event_type": "client_updated",\n  "created_at": "2025-10-25T18:50:00Z",\n  "payload": {\n    "client_id": "cli_567",\n    "client_name": "Nova Tech",\n    "industry": "AI SaaS",\n    "website": "https://novatech.ai",\n    "company_size": "50-100",\n    "owner": "John Rivera",\n    "last_activity": "Contract review scheduled",\n    "updated_at": "2025-10-25T18:49:00Z"\n  }\n}\n\n\n\n⸻\n\nAction (Zapier → Notion):\n\t•\tApp: Notion\n\t•\tEvent: “Update Database Item”\n\t•\tDatabase: CRM – Clients\n\t•\tMap Fields:\n\nHirePilot Field\tNotion Property\tExample\nclient_name\tName\t“Nova Tech”\nindustry\tIndustry\t“AI SaaS”\ncompany_size\tSize\t“50–100”\nowner\tAccount Owner\t“John Rivera”\nlast_activity\tNotes\t“Contract review scheduled”\n\n\nOptional: Add a “Find Page in Notion” step before updating, to prevent duplicates.\n` },
    { id: 13, title: 'Contact Added → Schedule Intro Email', category: 'Client Experience', trigger: 'Contact created', action: 'Send intro email via SendGrid after 15 minutes', tools: ['HirePilot', 'SendGrid'], description: 'New contacts get a timely intro email queued by HirePilot.', setupTime: '3–5 min', difficulty: 'Beginner', setupSteps: [
      'Connect SendGrid in HirePilot → Settings → Integrations.',
      'Enable the Lead Created trigger (/api/events/lead_created).',
      'Choose or create your Intro Email Template inside SendGrid.',
      'HirePilot automatically schedules the message when new contacts are added.'
    ], copyZap: `⚙️ Workflow: Contact Added → Schedule Intro Email\n\n🧠 What It Does\n\nWhen a new contact (lead or client) is added in HirePilot, a personalized intro email is automatically scheduled through your connected SendGrid sender — keeping engagement instant and effortless.\n\n⸻\n\n\n\n🔧 Zapier Detailed Setup\n\nTrigger (HirePilot):\n\t•\tEvent: lead_created\n\t•\tEndpoint:\n\nGET /api/zapier/triggers/events?event_type=lead_created&since={{now}}\n\n\n\t•\tSample Payload:\n\n{\n  "id": "evt_201",\n  "event_type": "lead_created",\n  "created_at": "2025-10-25T20:00:00Z",\n  "payload": {\n    "lead_id": "lead_452",\n    "first_name": "Emily",\n    "last_name": "Parker",\n    "email": "emily@zenflow.io",\n    "source": "chrome_extension",\n    "tags": ["client", "warm"]\n  }\n}\n\n\n\n⸻\n\nAction (SendGrid):\n\t•\tApp: SendGrid\n\t•\tEvent: “Send Dynamic Template Email”\n\t•\tTo Email: {{payload.email}}\n\t•\tTemplate ID: your Intro Template ID (example: d-intro-2025)\n\t•\tDynamic Data Example:\n\n{\n  "first_name": "{{payload.first_name}}",\n  "source": "{{payload.source}}",\n  "intro_message": "It’s great to connect! Let’s explore how HirePilot can help you fill your open roles faster."\n}\n\n\n\nOptional Filter (Zapier):\nAdd a conditional filter:\n\nOnly continue if tags contains “client” or “prospect” — to limit who receives intro emails.\n\n⸻\n\nResult:\nEvery new lead or contact added to HirePilot receives an immediate intro email such as:\n\n“Hey Emily — thanks for connecting! I’m excited to collaborate and share how we can help you build your team.”\n\nYour SendGrid dashboard tracks delivery and open rates automatically.\n\n⸻\n` },
    { id: 14, title: 'New Client → Create Monday Board + Slack Channel', category: 'Client Experience', trigger: 'client_created', action: 'Create Monday board + dedicated Slack channel', tools: ['HirePilot', 'Monday.com', 'Slack'], description: 'Kick off client projects with auto-created boards and channels.', setupTime: '5–10 min', difficulty: 'Beginner', setupSteps: [
      'Connect Monday.com and Slack in HirePilot → Settings → Integrations.',
      'Enable the Client Created trigger (/api/events/client_created).',
      'Choose a Monday board template to duplicate (e.g., “Client Project Template”).',
      'Auto-name your Slack channel after the client (e.g., #client-acmecorp) and send a welcome message.'
    ], copyZap: `🔧 Zapier Detailed Setup\n\nTrigger (HirePilot):\n\t•\tEvent: client_created\n\t•\tEndpoint:\n\nGET /api/zapier/triggers/events?event_type=client_created&since={{now}}\n\n\n\t•\tSample Payload:\n\n{\n  "id": "evt_512",\n  "event_type": "client_created",\n  "created_at": "2025-10-25T18:50:00Z",\n  "payload": {\n    "client_id": "cli_001",\n    "client_name": "Acme Corporation",\n    "primary_contact": "Trish Kapos",\n    "email": "trish@acmecorp.com",\n    "owner": "Brandon Omoregie"\n  }\n}\n\n\n\n⸻\n\nAction 1 – Monday.com:\n\t•\tApp: Monday.com\n\t•\tEvent: “Create Board”\n\t•\tBoard Name: {{payload.client_name}} Recruiting Board\n\t•\tWorkspace: Select “Client Projects”\n\t•\tTemplate Board (optional): Choose your preferred client template to duplicate\n\t•\tAdd Columns: Job Titles, Pipeline Stage, Activity Log, Recruiter Owner\n\n⸻\n\nAction 2 – Slack:\n\t•\tApp: Slack\n\t•\tEvent: “Create Channel”\n\t•\tChannel Name: client-{{payload.client_name | lowercase | replace(" ", "-")}}\n\t•\tPrivate Channel: Yes (recommended)\n\t•\tInvite Members: Tag the recruiter ({{payload.owner}}) and client contact if integrated\n\nAction 3 – Slack Welcome Message:\n\t•\tEvent: “Send Message”\n\t•\tMessage Template:\n\n👋 Welcome to the #client-{{payload.client_name | lowercase}} channel!\nThis space will track all activity for {{payload.client_name}}’s hiring project.\nMonday board: {{monday_board_url}}\nClient Owner: {{payload.owner}}\n\n`, copyMake: `⚙️ Make.com Setup (Advanced)\n\nTrigger (HirePilot HTTP Watcher):\n\t•\tURL:\nhttps://api.thehirepilot.com/api/zapier/triggers/events?event_type=client_created\n\nStep 1 – Monday Module:\n\t•\t“Create a Board” → Name it {{payload.client_name}} Recruiting Board\n\t•\tUse a board template or predefine structure\n\nStep 2 – Slack Module:\n\t•\t“Create Channel” → client-{{payload.client_name | lowercase}}\n\t•\t“Send Message” → Post welcome with embedded Monday board link\n\nStep 3 – (Optional)\nAdd “Invite Team Members” or “Create Folder in Google Drive” for each new client.\n\n⸻\n\nResult:\nEach new client added in HirePilot automatically gets:\n\t•\tA ready-to-go Monday.com board for tracking hires\n\t•\tA dedicated Slack channel for communication\n\t•\tA welcome post linking both\n\nEverything launches instantly — no manual setup required. 🚀\n` },

    // Deals & Placements
    { id: 16, title: 'Candidate Hired → Create Stripe Invoice + Slack Win Alert', category: 'Billing', trigger: 'candidate_hired', action: 'Create invoice + confetti Slack alert', tools: ['HirePilot', 'Stripe', 'Slack'], description: 'Celebrate wins and bill instantly on hire.', setupTime: '5–10 min', difficulty: 'Beginner', setupSteps: [
      'Connect Stripe and Slack in HirePilot → Settings → Integrations.',
      'Enable the Candidate Hired trigger (/api/events/candidate_hired).',
      'Map your placement fee or flat rate field in the Stripe action.',
      'HirePilot will auto-create the invoice and post a win message to Slack.'
    ], copyZap: [
      '🔧 Zapier Detailed Setup',
      '',
      'Trigger (HirePilot):',
      '\t•\tEvent: candidate_hired',
      '\t•\tEndpoint:',
      '',
      'GET /api/zapier/triggers/events?event_type=candidate_hired&since={{now}}',
      '',
      '\t•\tSample Payload:',
      '',
      '{',
      '  "id": "evt_701",',
      '  "event_type": "candidate_hired",',
      '  "created_at": "2025-10-25T19:30:00Z",',
      '  "payload": {',
      '    "candidate_id": "cand_208",',
      '    "candidate_name": "Jordan Lewis",',
      '    "job_title": "Product Manager",',
      '    "client_company": "BrightPath Analytics",',
      '    "placement_fee": 18000,',
      '    "start_date": "2025-11-04",',
      '    "owner": "Brandon Omoregie"',
      '  }',
      '}',
      '',
      '⸻',
      '',
      'Action 1 – Stripe:',
      '\t•\tApp: Stripe',
      '\t•\tEvent: “Create Invoice”',
      '\t•\tCustomer: Match client_company or auto-create a new customer.',
      '\t•\tLine Item Description: Placement fee for {{payload.candidate_name}} - {{payload.job_title}}',
      '\t•\tAmount: {{payload.placement_fee}}',
      '\t•\tCurrency: USD',
      '\t•\tAuto-finalize: ✅ Yes',
      '',
      '⸻',
      '',
      'Action 2 – Slack:',
      '\t•\tApp: Slack',
      '\t•\tEvent: “Send Channel Message”',
      '\t•\tChannel: #placements (or your internal wins channel)',
      '\t•\tMessage Template:',
      '',
      '🎉 **New Hire Confirmed!**',
      'Candidate: {{payload.candidate_name}}',
      'Role: {{payload.job_title}}',
      'Client: {{payload.client_company}}',
      'Placement Fee: ${{payload.placement_fee}}',
      'Owner: {{payload.owner}}',
      'Invoice automatically created in Stripe 💸',
      '',
      '\t•\tEmoji Reaction: 🥂 or 🚀',
    ].join('\n'), copyMake: `⚙️ Make.com Setup (Advanced Flow)\n\nTrigger (HirePilot HTTP Watcher):\n\t•\tURL:\nhttps://api.thehirepilot.com/api/zapier/triggers/events?event_type=candidate_hired\n\nStep 1 – Stripe (Create Invoice):\n\t•\tCustomer: Find or create by company name.\n\t•\tAdd Line Item: Placement Fee for {{payload.candidate_name}} ({{payload.job_title}})\n\t•\tAmount: {{payload.placement_fee}}\n\t•\tAuto-send invoice.\n\nStep 2 – Slack (Post Message):\n\t•\tChannel: placements\n\t•\tMessage: As above (include invoice URL dynamically from Stripe module).\n\nStep 3 – (Optional)\nAdd “Send Email to Client” via SendGrid to share the official invoice automatically.\n\n⸻\n\nResult:\nWhen a recruiter marks a candidate as Hired, HirePilot instantly:\n✅ Generates and sends a Stripe invoice for the placement fee\n✅ Posts a celebratory win in Slack\n✅ Keeps billing, morale, and reporting all perfectly in sync 🎯\n` },
    { id: 17, title: 'Candidate Submitted → Create DocuSign Offer Letter', category: 'Pipeline', trigger: 'candidate_submitted', action: 'Generate & send DocuSign offer', tools: ['HirePilot', 'DocuSign'], description: 'Streamline offer letter creation and delivery.', setupTime: '5–10 min', difficulty: 'Beginner', setupSteps: [
      'Connect DocuSign in HirePilot → Settings → Integrations.',
      'Enable the Candidate Submitted trigger (/api/events/candidate_submitted).',
      'Select your DocuSign Offer Letter Template and map key fields (name, job, rate, start date).',
      'HirePilot automatically sends the letter for signature to both candidate and client.'
    ], copyZap: `🔧 Zapier Detailed Setup\n\nTrigger (HirePilot):\n\t•\tEvent: candidate_submitted\n\t•\tEndpoint:\n\nGET /api/zapier/triggers/events?event_type=candidate_submitted&since={{now}}\n\n\n\t•\tSample Payload:\n\n{\n  "id": "evt_882",\n  "event_type": "candidate_submitted",\n  "created_at": "2025-10-25T19:45:00Z",\n  "payload": {\n    "candidate_id": "cand_302",\n    "candidate_name": "Ariana Vega",\n    "job_title": "Marketing Director",\n    "company_name": "Everbright Media",\n    "start_date": "2025-11-10",\n    "salary": "135000",\n    "submitted_by": "Brandon Omoregie",\n    "candidate_email": "ariana.vega@example.com",\n    "client_email": "recruiting@everbright.com"\n  }\n}\n\n\n\n⸻\n\nAction – DocuSign:\n\t•\tApp: DocuSign\n\t•\tEvent: “Create and Send Envelope from Template”\n\t•\tTemplate: Choose your Offer Letter Template\n\t•\tRecipients:\n\t•\tSigner 1: {{payload.candidate_email}} (Candidate)\n\t•\tSigner 2: {{payload.client_email}} (Client or HR contact)\n\t•\tCustom Fields:\n\nField\tValue\nCandidate Name\t{{payload.candidate_name}}\nJob Title\t{{payload.job_title}}\nCompany Name\t{{payload.company_name}}\nSalary\t$ {{payload.salary}}\nStart Date\t{{payload.start_date}}\n\n\n\t•\tSubject Line: Offer Letter for {{payload.job_title}} – {{payload.company_name}}\n\t•\tMessage:\n\nHi {{payload.candidate_name}},\n\nCongratulations! Please review and sign your official offer letter for the {{payload.job_title}} role at {{payload.company_name}}.\n\nOnce signed, both parties will receive confirmation automatically.\n`, copyMake: `⚙️ Workflow: Candidate Submitted → Create DocuSign Offer Letter\n\n🧠 What This Does\n\nWhen a candidate is moved to the Submitted stage in HirePilot, an offer letter is automatically generated in DocuSign using your pre-built template — complete with role, compensation, and company details. The candidate and client both receive it instantly for e-signature.\n\n⸻\n\n💡 Modal Overview (1-line + 4 Steps)\n\nWhat This Does:\nAuto-generate and send offer letters for submitted candidates through DocuSign.\n\n⚙️ Make.com Setup (Advanced Flow)\n\nTrigger (HirePilot HTTP Watcher):\n\t•\tURL:\nhttps://api.thehirepilot.com/api/zapier/triggers/events?event_type=candidate_submitted\n\nStep 1 – DocuSign Module:\n\t•\t“Create Envelope from Template”\n\t•\tMap all template fields and recipient roles.\n\t•\tEnable “Auto Send” for immediate delivery.\n\nStep 2 – (Optional)\nAdd a Slack message:\n\n“📄 Offer letter for {{payload.candidate_name}} has been sent via DocuSign for {{payload.job_title}}.”\n\nStep 3 – (Optional)\nAttach the signed PDF back to HirePilot or your ATS folder once completed.\n\n⸻\n\nResult:\nEvery time a recruiter submits a candidate, HirePilot:\n✅ Generates a personalized offer letter in DocuSign\n✅ Sends it instantly for e-signature to both candidate and client\n✅ Optionally notifies the team in Slack or updates your CRM\n\nAll automated. All compliant. All done in seconds. ⚡\n` },
    { id: 18, title: 'Pipeline Stage Updated → Update Google Sheet Tracker', category: 'Pipeline', trigger: 'pipeline_stage_updated', action: 'Append change to master Google Sheet', tools: ['HirePilot', 'Google Sheets'], description: 'Keep your master pipeline spreadsheet in sync.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Connect Google Sheets in HirePilot → Settings → Integrations.',
      'Enable the Pipeline Stage Updated trigger (/api/events/pipeline_stage_updated).',
      'Choose your Google Sheet and specify the worksheet tab for tracking.',
      'Map columns like Candidate, Company, Role, Current Stage, Updated Date, and Owner.'
    ], copyZap: `🔧 Zapier Detailed Setup\n\nTrigger (HirePilot):\n\t•\tEvent: pipeline_stage_updated\n\t•\tEndpoint:\n\nGET /api/zapier/triggers/events?event_type=pipeline_stage_updated&since={{now}}\n\n\n\t•\tSample Payload:\n\n{\n  "id": "evt_914",\n  "event_type": "pipeline_stage_updated",\n  "created_at": "2025-10-25T20:00:00Z",\n  "payload": {\n    "candidate_id": "cand_055",\n    "candidate_name": "Tessa Clark",\n    "job_title": "UX Designer",\n    "company_name": "NovaTech Labs",\n    "previous_stage": "Interviewing",\n    "current_stage": "Offer Sent",\n    "updated_at": "2025-10-25T19:58:00Z",\n    "owner": "Brandon Omoregie"\n  }\n}\n\n\n\n⸻\n\nAction – Google Sheets:\n\t•\tApp: Google Sheets\n\t•\tEvent: “Update Spreadsheet Row”\n\t•\tSpreadsheet: Select your Pipeline Tracker sheet.\n\t•\tWorksheet: “Active Pipelines” or “Candidates”\n\t•\tLookup Column: Candidate ID ({{payload.candidate_id}})\n\t•\tUpdate Fields:\n\nSheet Column\tData\nCandidate Name\t{{payload.candidate_name}}\nCompany\t{{payload.company_name}}\nJob Title\t{{payload.job_title}}\nStage\t{{payload.current_stage}}\nUpdated At\t{{payload.updated_at}}\nOwner\t{{payload.owner}}\n\n\n\t•\tIf Not Found: Create a new row automatically.\n\n⸻\n\nCopy Make.com Blueprint:\nKeep your Google Sheet pipeline tracker in real-time sync with HirePilot.\n\n⚙️ Make.com Setup (Advanced Flow)\n\nTrigger (HirePilot HTTP Watcher):\n\t•\tURL:\nhttps://api.thehirepilot.com/api/zapier/triggers/events?event_type=pipeline_stage_updated\n\nStep 1 – Google Sheets Module:\n\t•\t“Search Rows” → Find the matching Candidate ID.\n\t•\tIf found: “Update Row.”\n\t•\tIf not found: “Add Row” with all payload data.\n\nStep 2 – (Optional)\nAdd conditional logic to flag high-value candidates or stages:\n\nExample: If current_stage = "Offer Sent" → send Slack alert #placements.\n\nStep 3 – (Optional)\nAppend the update history to a “Stage Log” sheet for performance analytics.\n\n⸻\n\nResult:\nEvery pipeline stage update in HirePilot automatically:\n✅ Updates your Google Sheet tracker with the latest stage and metadata\n✅ Maintains a real-time sync between CRM and reporting tools\n✅ Optionally notifies your team for key stage transitions\n\nNo more exports. No more manual tracking. Just live data — always up to date. 📊\n` },
    { id: 19, title: 'Candidate Rejected → Send “Keep Warm” Message', category: 'Messaging', trigger: 'candidate_rejected', action: 'Send follow-up to keep candidate engaged', tools: ['HirePilot', 'SendGrid'], description: 'Maintain relationships even when candidates are not a fit.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Connect SendGrid under HirePilot → Settings → Integrations.',
      'Enable the Candidate Rejected trigger (/api/events/candidate_rejected).',
      'Select a SendGrid template (e.g., “Keep Warm Follow-Up”).',
      'Customize message variables and Save — HirePilot auto-sends when a rejection is logged.'
    ], copyZap: `⸻\n\n⚙️ Workflow: Candidate Rejected → Send “Keep Warm” Message\n\n🧠 What It Does\n\nAutomatically sends a thoughtful follow-up message to candidates who were marked as rejected in a Job REQ pipeline — keeping your relationships active for future opportunities.\n\n\n🔧 Zapier / API Detailed Setup\n\nTrigger (HirePilot):\n\t•\tEvent: candidate_rejected\n\t•\tEndpoint:\n\nGET /api/zapier/triggers/events?event_type=candidate_rejected&since={{now}}\n\n\n\t•\tSample Payload:\n\n{\n  "id": "evt_901",\n  "event_type": "candidate_rejected",\n  "created_at": "2025-10-25T18:50:00Z",\n  "payload": {\n    "candidate_id": "cand_123",\n    "candidate_name": "Sarah Johnson",\n    "email": "sarah@domain.com",\n    "job_title": "Product Manager",\n    "job_req_id": "req_456",\n    "reason": "Not a fit for current role"\n  }\n}\n\n\n\n⸻\n\nAction (SendGrid):\n\t•\tApp: SendGrid\n\t•\tEvent: “Send Dynamic Template Email”\n\t•\tTemplate ID: your pre-saved “Keep Warm” message (e.g., d-keepwarm-template123)\n\t•\tTo Email: {{payload.email}}\n\t•\tDynamic Template Data:\n\n{\n  "candidate_name": "{{payload.candidate_name}}",\n  "job_title": "{{payload.job_title}}",\n  "recruiter_name": "{{user.name}}",\n  "message": "We really enjoyed connecting with you, and we’d love to stay in touch for future roles that may be a stronger fit."\n}\n\n\n\n⸻\n\nOptional (Make it smarter):\n✅ Add a filter step to skip sending if candidate already in “Talent Pool” tag.\n✅ Add a Slack notification to alert your team that the “Keep Warm” message was sent.\n\n⸻\n\nResult:\nEach time a candidate is rejected, they automatically receive a kind, professional email like:\n\n“Hi Sarah, thank you so much for your time during the process! While we’ve moved forward with another candidate for the Product Manager role, we’d love to stay in touch for future openings.”\n\n` },
    { id: 20, title: 'New Application → Create Task in Monday.com', category: 'Pipeline', trigger: 'application_created', action: "Add task card to client's Monday board", tools: ['Monday.com', 'HirePilot'], description: 'Ensure new applications create actionable tasks.' },

    // Team & Collaboration
    { id: 21, title: 'Collaborator Added → Send Slack Welcome', category: 'Team', trigger: 'collaborator_added', action: 'Send Slack intro with links & next steps', tools: ['Slack', 'HirePilot'], description: 'Welcome new collaborators with helpful context.' },

    // Sniper & REX Automation
    // Removed Sniper Target card per request
    { id: 25, title: 'REX Chat → Generate Daily Summary in Notion', category: 'REX Intelligence', trigger: 'Daily at 6:00 PM', action: "Create a Notion 'Recruiting Summary' page", tools: ['REX', 'Notion', 'HirePilot'], description: 'REX writes a daily summary of hires, campaigns, and conversations.', setupTime: '3–5 min', difficulty: 'Beginner', setupSteps: [
      'Enable Daily Summary under REX Automations.',
      'Connect your Notion Integration in HirePilot Settings.',
      'Choose a Notion page or database for storing summaries.',
      'REX automatically writes a daily recap of activity each evening.'
    ], copyZap: `Zapier Setup\n\nTrigger:\n\t•\tApp: HirePilot\n\t•\tEvent: “Daily Summary Generated” (rex_summary_generated)\n\t•\tPayload Example:\n\n{\n  "hires": 2,\n  "new_campaigns": 3,\n  "open_conversations": 15,\n  "summary_text": "2 hires today, 3 new campaigns, and 15 ongoing conversations.",\n  "notion_page": "Recruiting Summary Log"\n}\n\n\nAction – Notion:\n\t•\tEvent: “Create Database Item”\n\t•\tDatabase: Recruiting Daily Logs\n\t•\tFields:\n\t•\tDate: {{zap_meta_human_now}}\n\t•\tSummary: {{summary_text}}\n\t•\tCampaigns: {{new_campaigns}}\n\t•\tHires: {{hires}}\n\n(Optional Action) Slack alert → “🧠 REX added today’s summary to Notion.”`, copyMake: `Make.com Setup\n\nTrigger:\n\t•\tHTTP module → watch /api/rex/intelligence/generate_summary events.\n\nSteps:\n1️⃣ Retrieve Summary (HTTP GET → /api/rex/intelligence/generate_summary)\n2️⃣ Create Notion Page or Database Entry → map data to columns: Date, Hires, Campaigns, Replies.\n3️⃣ Add Slack Module (optional) → post summary to team channel.\n4️⃣ Schedule Cron (optional) to run this flow daily at 6 PM.` },

    // AI-Enhanced Automations (optional bonus)
    { id: 26, title: 'REX Detects Unresponsive Campaign → Suggest A/B Test', category: 'REX Intelligence', trigger: 'Low reply rate detected', action: 'Draft alternate subject line', tools: ['REX', 'HirePilot'], description: 'REX proposes A/B test ideas when performance drops.', setupTime: '5 min', difficulty: 'Beginner', setupSteps: [
      'Enable Campaign Monitoring under REX Automations.',
      'Connect SendGrid or your email provider for tracking.',
      'Define performance thresholds (e.g., <20% open rate, <3% reply rate).',
      'REX will suggest improved variants automatically in your Campaign tab.'
    ], copyZap: `Zapier Setup\n\nTrigger:\n\t•\tApp: HirePilot\n\t•\tEvent: “Campaign Underperforming” (rex_campaign_stagnation)\n\t•\tSample Payload:\n\n{\n  "campaign_id": "cmp_203",\n  "campaign_name": "Outbound AE Search",\n  "open_rate": 15.2,\n  "reply_rate": 1.3,\n  "suggestions": [\n    "Try new subject line: 'Still open to new opportunities?'",\n    "Shorten email body to under 80 words"\n  ]\n}\n\n\nAction – Slack:\n\t•\tMessage:\n“⚠️ {{campaign_name}} is underperforming ({{open_rate}}% opens / {{reply_rate}}% replies).\nREX recommends testing:\n\t•\t{{suggestions[0]}}\n\t•\t{{suggestions[1]}}”\n\n(Optional Action – HirePilot):\n\t•\tEvent: “Create Draft Variant”\n\t•\tAutomatically queue suggested A/B versions.`, copyMake: `Make.com Setup\n\nTrigger:\n\t•\tHTTP module → watch /api/rex/intelligence/detect_stagnation.\n\nSteps:\n1️⃣ Receive campaign metrics payload.\n2️⃣ Add Slack module → post suggestions in #marketing or #campaigns.\n3️⃣ Create new A/B variant via HirePilot API:\nPOST /api/campaigns/variants/create with subject, body_change.\n4️⃣ (Optional) Send summary to Notion “Optimization Log” page.` },
    { id: 27, title: 'REX Detects Hiring Gap → Build Outreach Sequence', category: 'REX Intelligence', trigger: 'Open role without candidates', action: 'Draft and launch new outreach campaign', tools: ['REX', 'HirePilot'], description: 'Fill role gaps by auto-building a fresh outreach sequence.', setupTime: '5–10 min', difficulty: 'Beginner', setupSteps: [
      'Ensure REX Intelligence is active in your HirePilot Settings.',
      'Enable the Hiring Gap Detection trigger under REX Automations.',
      'Connect your preferred sourcing tools (Apollo, Sales Navigator, or Skrapp).',
      'REX will auto-build and queue a new outreach campaign when it detects a role needs filling.'
    ], copyZap: `Zapier Setup (Optional External Trigger)\n\nTrigger:\n\t•\tApp: HirePilot\n\t•\tEvent: “Hiring Gap Detected” (rex_hiring_gap_detected)\n\t•\tSample Payload:\n\n{\n  "job_title": "Senior Data Engineer",\n  "location": "Austin, TX",\n  "reason": "Campaign ended with no hires",\n  "detected_at": "2025-10-25T09:00:00Z"\n}\n\n\nAction 1 – HirePilot:\n\t•\tEvent: “Create Campaign”\n\t•\tMap fields:\n\t•\tCampaign Name: Auto Outreach - {{job_title}}\n\t•\tTarget Source: Apollo\n\t•\tMessage Template: “Standard Technical Outreach v2”\n\nAction 2 – Slack (optional):\n\t•\tSend a message to #recruiting\n“🚀 REX detected a gap for {{job_title}} — a new outreach sequence has been created automatically.”`, copyMake: `Make.com Setup\n\nTrigger:\n\t•\tHTTP Module watching rex_hiring_gap_detected webhook from HirePilot API.\n\t•\tURL: https://api.thehirepilot.com/api/rex/intelligence/detect_gap\n\nSteps:\n1️⃣ Create Campaign in HirePilot (HTTP module → POST /api/campaigns/create)\n2️⃣ Generate Email Sequence (POST /api/sequences/create with job_title, template_id, owner_id)\n3️⃣ (Optional) Slack module → “Send Message” with campaign summary.\n4️⃣ (Optional) Update your Notion hiring tracker or dashboard.` },
  ];

  const filtered = useMemo(() => {
    if (!query) return workflows;
    const q = query.toLowerCase();
    return workflows.filter(
      (w) => w.title.toLowerCase().includes(q) || (w.description || '').toLowerCase().includes(q)
    );
  }, [query]);

  const openRecipe = (wf) => {
    setSelected(wf);
    setIsOpen(true);
  };

  const closeRecipe = () => {
    setIsOpen(false);
    setTimeout(() => setSelected(null), 200);
  };

  const byCategory = useMemo(() => {
    const groups = {};
    filtered.forEach((w) => {
      const key = w.category || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    });
    return groups;
  }, [filtered]);

  const colorClasses = {
    indigo: 'bg-indigo-900 text-indigo-300',
    purple: 'bg-purple-900 text-purple-300',
    green: 'bg-green-900 text-green-300',
    teal: 'bg-teal-900 text-teal-300',
    red: 'bg-red-900 text-red-300',
    amber: 'bg-amber-900 text-amber-300',
  };

  const toFormulaString = (wf) => {
    if (wf?.recipeJSON) {
      try { return JSON.stringify(wf.recipeJSON, null, 2); } catch (_) {}
    }
    const obj = { name: wf.title, trigger: wf.trigger, actions: (wf.actions || (wf.action ? [{ name: wf.action }] : [])) };
    try { return JSON.stringify(obj, null, 2); } catch (_) { return String(obj); }
  };

  return (
    <div id="main-content" className="bg-slate-950 min-h-screen text-white">
      {/* Top Bar */}
      <header id="header" className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Workflows</h1>
          <div className="relative">
            <input
              type="text"
              placeholder="Search workflows..."
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pl-10 w-80 focus:outline-none focus:border-indigo-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
          </div>
        </div>
        <button className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 rounded-lg font-semibold hover:scale-105 transition">
          <i className="fa-solid fa-plus mr-2"></i>
          Add Workflow
        </button>
      </header>

      {/* Page Content */}
      <main id="workflows-main" className="p-8 space-y-8">
        {/* Header Hero */}
        <section id="header-hero" className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl">
          <h1 className="text-3xl font-bold mb-2">Automate Everything.</h1>
          <p className="text-slate-100 mb-4 text-lg">Install or customize ready-made recruiting workflows — powered by REX.</p>
          <button className="px-6 py-3 bg-white text-indigo-700 font-semibold rounded-lg shadow hover:scale-105 transition">
            Explore Workflow Library
          </button>
        </section>

        {/* Connected Integrations */}
        <section id="integrations-status" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Connected Integrations</h2>
            <a href="/settings/integrations" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Manage All <i className="fa-solid fa-arrow-right ml-1"></i>
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-slack text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Slack</h4>
              <span className={`text-xs mt-2 ${integrationStatus.slack ? 'text-green-400' : 'text-red-400'}`}>{integrationStatus.slack ? '✅ Connected' : '⚠️ Not Connected'}</span>
              <button onClick={() => window.open('/settings/integrations#slack', '_self')} className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <img src="/zapier_trigger_watermarked.png" alt="Zapier" className="w-12 h-12 rounded-lg mb-3" />
              <h4 className="font-semibold text-sm">Zapier</h4>
              <span className={`text-xs mt-2 ${integrationStatus.zapier ? 'text-green-400' : 'text-red-400'}`}>{integrationStatus.zapier ? '✅ Connected' : '⚠️ Not Connected'}</span>
              <button onClick={() => window.open('/settings/integrations#zapier', '_self')} className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <img src="/sendgrid.png" alt="SendGrid" className="w-12 h-12 rounded-lg mb-3" />
              <h4 className="font-semibold text-sm">SendGrid</h4>
              <span className={`text-xs mt-2 ${integrationStatus.sendgrid ? 'text-green-400' : 'text-red-400'}`}>{integrationStatus.sendgrid ? '✅ Connected' : '⚠️ Not Connected'}</span>
              <button onClick={() => window.open('/settings/integrations#sendgrid', '_self')} className="mt-3 text-xs px-3 py-1 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition">Connect</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-stripe text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">Stripe</h4>
              <span className={`text-xs mt-2 ${integrationStatus.stripe ? 'text-green-400' : 'text-red-400'}`}>{integrationStatus.stripe ? '✅ Connected' : '⚠️ Not Connected'}</span>
              <button onClick={() => window.open('/settings/integrations#stripe', '_self')} className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center hover:bg-slate-800 transition">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-3">
                <i className="fa-brands fa-linkedin text-white text-xl"></i>
              </div>
              <h4 className="font-semibold text-sm">LinkedIn</h4>
              <span className={`text-xs mt-2 ${integrationStatus.linkedin ? 'text-green-400' : 'text-red-400'}`}>{integrationStatus.linkedin ? '✅ Connected' : '⚠️ Not Connected'}</span>
              <button onClick={() => window.open('/settings/integrations#linkedin', '_self')} className="mt-3 text-xs px-3 py-1 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition">Connect</button>
            </div>

            {/* Calendly removed because integration is not native/direct */}
          </div>
        </section>

        {/* Workflow Library */}
        <section id="workflow-library" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Workflow Recipes Library</h2>
          </div>

          {/* Category Filters (static UI for now) */}
          <div id="category-filters" className="flex gap-2 flex-wrap">
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium">All</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Messaging</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Pipeline</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">Billing</button>
            <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition">REX</button>
          </div>

          {/* Grouped by category */}
          {Object.keys(byCategory).map((group) => (
            <div key={group} className="space-y-4">
              <h3 className="text-xl font-semibold">{group}</h3>
              <div id="workflow-grid" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {byCategory[group]?.map((wf) => (
                  <div key={wf.id} className="bg-slate-900 rounded-xl p-6 hover:bg-slate-800 transition group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold pr-2">{wf.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${colorClasses[wf.color] || 'bg-slate-800 text-slate-300'}`}>
                        <span className="mr-1">{wf.icon}</span>{wf.category}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">{wf.description}</p>
                    <div className="flex gap-2">
                      <button onClick={() => openRecipe({ title: wf.title, summary: wf.description, tools: wf.tools || [wf.category], setupTime: wf.setupTime || '', difficulty: wf.difficulty || '', formula: toFormulaString(wf), setupSteps: wf.setupSteps || [], copyZap: wf.copyZap || '', copyMake: wf.copyMake || '' })} className="px-3 py-2 bg-indigo-500 rounded-lg text-xs font-semibold text-white hover:bg-indigo-400 transition">View Recipe</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>

      <WorkflowRecipeModal
        isOpen={isOpen}
        onClose={closeRecipe}
        title={selected?.title || ''}
        summary={selected?.summary || ''}
        tools={selected?.tools || []}
        setupTime={selected?.setupTime || ''}
        difficulty={selected?.difficulty || ''}
        formula={selected?.formula || ''}
        setupSteps={selected?.setupSteps || []}
        copyZap={selected?.copyZap || ''}
      />
    </div>
  );
}


