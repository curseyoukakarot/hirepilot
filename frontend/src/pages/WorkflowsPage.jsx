import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import WorkflowRecipeModal from '../components/WorkflowRecipeModal';
import { ZapierModalFrame } from '../screens/SettingsIntegrations.jsx';
import { AnimatePresence, motion } from 'framer-motion';
import { INTENT_WORKFLOWS, INTENT_CATEGORY, estimateDiscoveryCredits } from '../data/intentWorkflows';

export default function WorkflowsPage() {
  const [selected, setSelected] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'mine'
  const [savedWorkflows, setSavedWorkflows] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hp_my_workflows_v1') || '[]'); } catch { return []; }
  });
  const [integrationStatus, setIntegrationStatus] = useState({ slack:false, zapier:false, sendgrid:false, stripe:false, linkedin:false });
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [showZapierModal, setShowZapierModal] = useState(false);
  const [zapierApiKey, setZapierApiKey] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const base = import.meta.env.VITE_BACKEND_URL || '';
        // 1) Best-effort consolidated settings (may not include Zapier)
        try {
          const res = await fetch(`${base}/api/user-integrations`, { headers: { Authorization: `Bearer ${session.access_token}` } });
          if (res.ok) {
            const js = await res.json();
            const hasSendgrid = Boolean(js?.sendgrid_api_key || js?.api_keys?.sendgrid || js?.sendgrid?.has_keys);
            setIntegrationStatus(s => ({ ...s, sendgrid: hasSendgrid }));
          }
        } catch {}
        // 2) Canonical: check /api/apiKeys (service role) → any key means Zapier/Make is enabled
        try {
          const keysRes = await fetch(`${base}/api/apiKeys`, { headers: { Authorization: `Bearer ${session.access_token}` } });
          if (keysRes.ok) {
            const keysJs = await keysRes.json().catch(() => ({}));
            const keys = Array.isArray(keysJs?.keys) ? keysJs.keys : [];
            const hasAnyKey = keys.length > 0;
            if (hasAnyKey) setIntegrationStatus(s => ({ ...s, zapier: true }));
          }
        } catch {}
      } catch {}
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          // Primary check: slack_accounts row
          // Some deployments use different PK/columns; avoid selecting a non-existent field
          const { data: slackRow } = await supabase
            .from('slack_accounts')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          let slackConnected = Boolean(slackRow);
          // Fallback: user_settings webhook/token from new OAuth flow
          if (!slackConnected) {
            try {
              const { data: settings } = await supabase
                .from('user_settings')
                .select('slack_webhook_url, slack_channel')
                .eq('user_id', user.id)
                .maybeSingle();
              slackConnected = Boolean(settings?.slack_webhook_url || settings?.slack_channel);
            } catch {}
          }
          // SendGrid fallback via user_sendgrid_keys
          try {
            const { data: sgRow } = await supabase
              .from('user_sendgrid_keys')
              .select('api_key, default_sender')
              .eq('user_id', user.id)
              .maybeSingle();
            if (sgRow?.api_key || sgRow?.default_sender) {
              setIntegrationStatus(s => ({ ...s, sendgrid: true }));
            }
          } catch {}
          // Zapier fallback via api_keys (same table used by /api/apiKeys)
          try {
            const { data: keyRows } = await supabase
              .from('api_keys')
              .select('id')
              .eq('user_id', user.id);
            if (Array.isArray(keyRows)) {
              const hasAny = keyRows.length > 0;
              if (hasAny) setIntegrationStatus(s => ({ ...s, zapier: true }));
            }
          } catch {}

          setIntegrationStatus(s => ({ ...s, slack: slackConnected }));
          const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
          const roleLc = String(roleRow?.role || user?.user_metadata?.role || '').toLowerCase();
          setIsFree(roleLc === 'free');
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
        // Use existing check-cookie endpoint (POST) to avoid 404s
        const base = import.meta.env.VITE_BACKEND_URL || '';
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const res = await fetch(`${base}/api/linkedin/check-cookie`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id })
          });
          if (res.ok) {
            const js = await res.json().catch(() => ({}));
            setIntegrationStatus(s => ({ ...s, linkedin: Boolean(js?.exists) }));
          }
        }
      } catch {/* optional; not critical for workflows */}
    })();
  }, []);

  useEffect(() => {
    if (!showAddedToast) return;
    const timer = setTimeout(() => setShowAddedToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showAddedToast]);

  // Curated in-app workflow recipes (mirrors public /workflows: exact 18)
  const workflows = [
    // Tranche 1 — Discovery + Lead Intelligence
    {
      id: 1,
      title: 'Website Visitor → Auto-Enrich → Auto Email',
      category: 'Discovery + Lead Intelligence',
      tools: ['RB2B','SendGrid','HirePilot'],
      description: 'Enrich website visitors (name, title, company, email, LinkedIn) and send a personalized email automatically.',
      setupTime: '5–10 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Connect RB2B or your visitor webhook.',
        'Enable auto-enrichment for new visitors.',
        'Select a SendGrid template for the first-touch email.'
      ],
      copyZap: `✅ WORKFLOW 1: Website Visitor → Auto-Enrich → Auto Email (RB2B Pattern)

Purpose
Automatically detect anonymous website visitors from RB2B, create them as leads in HirePilot, enrich them using HirePilot’s enrichment endpoint, and then send a personalized email using SendGrid.

⸻

✅ PART 1 — Trigger Step Setup in Zapier

Step 1: Choose App
• Click “Create Zap”
• Search for Webhooks by Zapier
• Select Trigger: Catch Hook

Step 2: Copy the Webhook URL
Zapier will generate a URL like:
https://hooks.zapier.com/hooks/catch/1234567/abcdef/

Step 3: Paste this URL in RB2B
• Go to RB2B settings → Webhooks
• Add new webhook
• Paste your Zapier URL
• Choose “Website Visitor Identified” (or equivalent event)

Step 4: Test Trigger
• Visit your website
• RB2B should send test data
• Zapier will show raw JSON payload from RB2B

You MUST confirm you can see fields like:
• visitor_name
• email
• company
• location
• linkedin
• raw_payload

If fields are nested, Zapier will show them as:
• data__visitor_name
• data__email
• data__company

✅ If you see the data — click Continue.

⸻

✅ PART 2 — Create Lead in HirePilot

Step 5: Add Action
• Click “+”
• Choose Webhooks by Zapier
• Choose POST

Step 6: Configure POST
URL:
https://api.thehirepilot.com/api/leads/create

Payload Type: JSON

Headers:
• Key: X-API-Key
  Value: <YOUR_API_KEY>
• Key: Content-Type
  Value: application/json

Data (Body): Click JSON editor and paste:
{
  "name": "{{visitor_name}}",
  "email": "{{visitor_email}}",
  "company": "{{visitor_company}}",
  "linkedin_url": "{{visitor_linkedin}}",
  "source": "RB2B",
  "location": "{{visitor_location}}",
  "source_payload": {{raw_json_from_rB2B}}
}

⚠️ Important Notes
• If the RB2B payload is nested under data__visitor_email, use that instead.
• For source_payload, choose Custom → Raw Body to capture entire JSON.

Step 7: Test
Zapier should return a JSON response with:
{
  "id": "lead_123",
  "email": "example@example.com"
}

✅ Save the Lead ID — you will need it.

⸻

✅ PART 3 — Enrich the Lead

Step 8: Add New Action
• Choose “Webhooks by Zapier”
• Method: POST

URL:
https://api.thehirepilot.com/api/leads/{{id_from_step7}}/enrich

Headers Again:
• X-API-Key: <YOUR_API_KEY>
• Content-Type: application/json

Body: leave empty

Step 9: Test
You should receive a full enriched object with Apollo/Hunter/Skrapp fields.
If enrichment fails, response will still succeed with: "errors": []

⸻

✅ PART 4 — Flatten the Enrichment Response

Zapier struggles with nested JSON objects.
So we fix it with a Code by Zapier – JavaScript step.

Step 10: Add Action
• Choose Code by Zapier
• Choose Run JavaScript

Paste:
let raw = inputData.data;
let obj = JSON.parse(raw);
let apollo = obj.enrichment_data?.apollo || {};
return {
  first_name: apollo.first_name || obj.first_name || "",
  last_name: apollo.last_name || obj.last_name || "",
  title: apollo.title || obj.title || "",
  email: obj.email || apollo.email || "",
  company: apollo.organization?.name || obj.company || "",
  linkedin: apollo.linkedin_url || obj.linkedin_url || "",
  city: apollo.city || "",
  state: apollo.state || "",
  country: apollo.country || ""
};

Input → “data”
Select Step 9 → Raw Body.

Step 11: Test
Should produce:
• first_name
• last_name
• title
• email
• company
• linkedin

✅ These are now clean, easy-to-use fields.

⸻

✅ PART 5 — Send Personalized Email (EXAMPLE EMAIL)

Step 12: Add Action
• Choose SendGrid
• Choose Send Email

Step 13: Configure Email
• To: {{Step10.email}}
• From: your SendGrid sender
• Subject: Quick question {{Step10.first_name}}

HTML Body Template (use this)
<p>Hey {{first_name}},</p>
<p>Brandon here from HirePilot — I noticed you were on our site today exploring how AI can improve outbound hiring.</p>
<p>Before I send anything else your way, let me ask something simple:</p>
<p><strong>Are you currently hiring for any roles right now?</strong></p>
<p>If yes, I can get you 30–50 enriched candidates in under 10 minutes (no pitch, just results).</p>
<br/>
<p>
<strong>Brandon Omoregie</strong><br/>
<strong>Founder and CEO @ HirePilot</strong><br/>
<a href="https://www.thehirepilot.com">www.thehirepilot.com</a><br/>
<a href="https://calendly.com/hirepilot/30min">Schedule a call with me!</a>
</p>

Be sure to replace variables with Zapier dynamic fields.

⸻

✅ PART 6 — Optional Branching: Change Message Based on Job Title

You MUST add a Zap Filter.

Step 14: Add Filter
• Add a Filter step between enrichment + email.

Example:
Title contains “CEO” or “Founder”
• Choose Step 10 → title
• Condition: “Text Contains”
• Value: “Founder”

✅ This sends founder-specific messaging.
Repeat the Zap with variations.

⸻

✅ PART 7 — Error Handling

Add Path A / Path B
If enrichment email missing:
• Add Filter Step
• Condition: Step10 email “Exists”
• Path B = send fallback message or skip.`,
      copyMake: `MAKE.COM BLUEPRINT — Website Visitor → Auto-Enrich → Auto Email

Goal
Detect website visitors via webhook, create a lead, enrich it, flatten the JSON, and send a personalized email — all inside Make.com.

Modules (high-level)
1) Webhooks → Custom webhook (RB2B)
2) Tools → JSON > Create JSON / Parse JSON (optional, to inspect payload)
3) HTTP → Make a request (POST /api/leads/create)
4) HTTP → Make a request (POST /api/leads/{{id}}/enrich)
5) Tools → Functions / JSON → Parse to flatten fields
6) SendGrid → Send an email (or HTTP if using API)
7) Filters (diamond steps) for branching and error handling

Detailed Steps
1) Webhooks → Custom webhook
• Add a new webhook: “rb2b_visitor”
• Copy the webhook URL and paste into RB2B → Webhooks → “Website Visitor Identified”
• Click “Redetermine data structure” and send a test visitor from RB2B
• Confirm fields like visitor_name, email, company, location, linkedin; if nested, you’ll see them under data.*

2) (Optional) Tools → JSON module
• Use “Parse JSON” to store the entire body if you need to pass a raw payload downstream.

3) HTTP → Make a request (create lead)
• Method: POST
• URL: https://api.thehirepilot.com/api/leads/create
• Headers:
  - X-API-Key: <YOUR_API_KEY>
  - Content-Type: application/json
• Body (Raw, JSON):
{
  "name": "{{visitor_name}}",
  "email": "{{visitor_email}}",
  "company": "{{visitor_company}}",
  "linkedin_url": "{{visitor_linkedin}}",
  "source": "RB2B",
  "location": "{{visitor_location}}",
  "source_payload": {{bundle.wholePayload}}
}
• Map fields from the Webhook output. For source_payload, you can map the entire raw webhook body if desired.
• Save; run once to get a sample output. Capture lead.id for next step.

4) HTTP → Make a request (enrich lead)
• Method: POST
• URL: https://api.thehirepilot.com/api/leads/{{lead.id}}/enrich
• Headers: same as above
• Body: leave empty
• Run once, confirm enriched response fields (apollo, hunter, etc.)

5) Flatten enrichment
Option A: Tools → JSON → Parse JSON and map nested fields.
Option B: Tools → Function (JavaScript) to normalize:
/*
  Input: raw enrichment JSON
  Output: first_name, last_name, title, email, company, linkedin, city, state, country
*/
var obj = JSON.parse(input.enrichment_json || '{}');
var apollo = (obj.enrichment_data && obj.enrichment_data.apollo) || {};
return {
  first_name: apollo.first_name || obj.first_name || '',
  last_name: apollo.last_name || obj.last_name || '',
  title: apollo.title || obj.title || '',
  email: obj.email || apollo.email || '',
  company: (apollo.organization && apollo.organization.name) || obj.company || '',
  linkedin: apollo.linkedin_url || obj.linkedin_url || '',
  city: apollo.city || '',
  state: apollo.state || '',
  country: apollo.country || ''
};

6) SendGrid → Send an email (or HTTP)
Option A: Use Make’s SendGrid module (Send a dynamic template email or Send email)
• To: {{flattened.email}}
• Subject: Quick question {{flattened.first_name}}
• Body (HTML):
  Use the same HTML template from the Zapier step and map Make variables.

Option B: HTTP to SendGrid API
• POST https://api.sendgrid.com/v3/mail/send
• Header: Authorization: Bearer <SG_API_KEY>, Content-Type: application/json
• JSON body maps “to”, “from”, “subject”, and “content” with your variables.

7) Filters / Branching
• Add a filter before email: only continue if flattened.email exists.
• Add additional filters for title contains “Founder” or “CEO” to personalize copy.

Testing
• Send a live RB2B visitor event
• Verify: lead created → enriched → email sent
• Add error paths for missing email or failed enrichment (route to a Slack module or Data Store for review).`
    },
    {
      id: 2,
      title: 'LinkedIn Sales Navigator Scraper → Enrich → Queue Outreach',
      category: 'Discovery + Lead Intelligence',
      tools: ['Chrome Extension','Sales Navigator','HirePilot'],
      description: 'Paste a Sales Navigator search URL, extract profiles with contact info, then queue to outreach.',
      setupTime: '5–10 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Open Sales Navigator and copy the search URL.',
        'Use the Chrome Extension to scrape and send results to HirePilot.',
        'Enable auto-enrichment and queue to a campaign.'
      ],
      copyZap: [
        'Trigger: Chrome Extension → “Scrape SalesNav Search”',
        'Action: POST /api/leads/bulk-create',
        'Action: For each lead → /api/leads/:id/enrich',
        'Action: /api/campaigns/:id/addLead'
      ].join('\n')
    },
    {
      id: 19,
      title: 'LinkedIn Connect → Slack Introduction',
      category: 'Discovery + Lead Intelligence',
      tools: ['Chrome Extension','Slack','HirePilot'],
      description: 'When someone connects with you on LinkedIn, automatically post a formatted intro into Slack.',
      setupTime: '3–5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Install the HirePilot Chrome Extension and log in.',
        'Add a Zapier Catch Hook URL to the extension under Settings → Webhooks.',
        'Choose event “linkedin_connection_accepted” and select a Slack channel.'
      ],
      copyZap: `🚀 WORKFLOW — LinkedIn Connect → Slack Introduction

Purpose
When someone connects with you on LinkedIn (tracked via the Chrome Extension), HirePilot automatically pushes a formatted “new prospect” intro into Slack.

⸻
✅ PART 1 — Trigger Setup (Chrome Extension Event)
Step 1: Create New Zap → Trigger
• App: Webhooks by Zapier
• Event: Catch Hook

Step 2: Copy Webhook URL
Zapier generates something like:
https://hooks.zapier.com/hooks/catch/1234567/abc123/

Step 3: Add to Chrome Extension Settings
HirePilot Chrome Extension → Settings → Webhooks:
• Paste the webhook URL
• Choose event: “linkedin_connection_accepted”

Step 4: Test Trigger
Send a test event from the extension (test button). You should see:
{
  "event": "linkedin_connection_accepted",
  "connection": {
    "name": "Chris Doe",
    "title": "VP Growth",
    "company": "X Corp",
    "profile_url": "https://linkedin.com/in/chris",
    "location": "Austin, TX",
    "timestamp": "2025-11-09T06:52:11.129Z"
  },
  "user_id": "02a42..."
}
✅ Continue.

⸻
✅ PART 2 — (Optional) Formatter Safety
Step 5: Add “Formatter → Text → Replace”
• Input: {{connection.name}}
• If empty → replace with “Unknown Visitor”
Repeat for title/company if desired.

⸻
✅ PART 3 — Send Slack Message
Step 6: Add Action
• App: Slack
• Event: Send Channel Message

Step 7: Map fields
• Channel: #new-prospects
• Message (Block-style text):
*🚀 New LinkedIn Connection!*
*Name:* {{connection.name}}
*Title:* {{connection.title}}
*Company:* {{connection.company}}
*Location:* {{connection.location}}
🔗 Profile: {{connection.profile_url}}
🕒 Connected: {{connection.timestamp}}

⚠️ If sending as a bot, toggle “Send As Bot”.

⸻
✅ PART 4 — Error Handling
Step 8: Add Filter Before Slack
• Field: connection.name
• Rule: “Exists”
This avoids blank alerts.

✅ DONE — Workflow ready.`,
      copyMake: `MAKE.COM BLUEPRINT — LinkedIn Connect → Slack Introduction
Modules
1) Webhooks → Custom webhook (from Chrome Extension “linkedin_connection_accepted”)
2) Tools → Text functions (optional replace if fields missing)
3) Slack → Create a message (channel: #new-prospects)

Steps
1) Webhooks: Create a new webhook and paste URL into the Chrome Extension settings under Webhooks (event: linkedin_connection_accepted). Click “Redetermine data structure” and send a test.
2) (Optional) Tools: Replace empty name/title/company with defaults (e.g., “Unknown Visitor”).
3) Slack: Post message using mapped fields:
  • Name, Title, Company, Location, Profile URL, Timestamp.

Filters
• Add a filter to require connection.name exists before posting.`
    },
    {
      id: 3,
      title: 'Sniper Target Captured → Convert to Candidate + Enrich',
      category: 'Discovery + Lead Intelligence',
      tools: ['Sniper','HirePilot'],
      description: 'When Sniper finds a promising lead, auto-create a candidate, enrich, and attach to an open job.',
      setupTime: '3–5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Create or choose a Sniper target (keyword or post).',
        'Enable auto-convert to candidate + enrichment.',
        'Select a default Job REQ to attach candidates to.'
      ],
      copyZap: [
        'Trigger: sniper_target_captured (HirePilot)',
        'Action: POST /api/candidates/createFromLead',
        'Action: POST /api/candidates/:id/enrich',
        'Action: /api/pipeline/addCandidate'
      ].join('\n')
    },
    {
      id: 4,
      title: 'Lead Replied → Slack Alert',
      category: 'Discovery + Lead Intelligence',
      tools: ['HirePilot','Slack'],
      description: 'Instant Slack alerts when a lead replies, with name, email, and full message.',
      setupTime: '3 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Connect Slack in Settings → Integrations.',
        'Select a channel for reply alerts.',
        'Enable reply notifications in Notifications.'
      ],
      copyZap: `🚀 WORKFLOW — Lead Replied → Slack Alert

Purpose
When a lead replies through any HirePilot channel, notify Slack with message content, lead info, and campaign name.

⸻
✅ PART 1 — Trigger Setup (HirePilot Reply Event)
Step 1: Trigger
• App: Webhooks by Zapier (Catch Hook) or HirePilot Webhooks
• Event: lead_replied (reply_detected)

Payload Example:
{
  "event_type": "lead_replied",
  "lead": {
    "id": "lead_123",
    "name": "Jessica Ray",
    "email": "jessica@startup.com",
    "company": "Startup Labs"
  },
  "reply": {
    "message": "Hey Brandon — yes we’re hiring!",
    "timestamp": "2025-11-09T10:32:15Z",
    "campaign": "AE Hiring 2025"
  }
}

⸻
✅ PART 2 — Clean the Message Body
Step 2: Formatter → Text → Replace
• Replace: <br> → \\n
• Replace: double spaces → single space

⸻
✅ PART 3 — Send Slack Notification
Step 3: Slack → Send Channel Message
Message:
💬 *New Reply Detected!*
*Lead:* {{lead.name}} — {{lead.email}}
*Company:* {{lead.company}}
*Campaign:* {{reply.campaign}}
*Time:* {{reply.timestamp}}
*Message:* 
“{{reply.message}}”

⸻
✅ PART 4 — Add Context from HirePilot (Optional)
Step 4: HTTP GET to fetch more history
URL: https://api.thehirepilot.com/api/leads/{{lead.id}}
Headers:
• X-API-Key: <YOUR_API_KEY>

Append to Slack:
*Past Messages:* {{history_snippet}}

✅ DONE`,
      copyMake: `MAKE.COM BLUEPRINT — Lead Replied → Slack
Modules
1) Webhooks → Custom webhook (lead_replied)
2) Tools → Text functions for cleaning body (optional)
3) Slack → Create a message
4) (Optional) HTTP GET → /api/leads/{{lead.id}} to include context

Filters
• Ensure reply.message exists before sending.`
    },
    {
      id: 5,
      title: 'Hunter Verified → Send Intro Email',
      category: 'Discovery + Lead Intelligence',
      tools: ['Hunter','SendGrid','HirePilot'],
      description: 'When Hunter verifies an email, send a personalized intro and track delivery/open.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Connect Hunter and SendGrid in Settings.',
        'Choose your intro template.',
        'Enable automatic sends upon verification.'
      ],
      copyZap: [
        'Trigger: Hunter.io → Email Verified',
        'Action: /api/leads/create (upsert)',
        'Action: SendGrid → Send template'
      ].join('\n')
    },
    {
      id: 6,
      title: 'Sales Nav Saved Lead → Create Sniper Target',
      category: 'Discovery + Lead Intelligence',
      tools: ['Chrome Extension','Sniper','HirePilot'],
      description: 'Save a lead in Sales Navigator to instantly create a Sniper target (optional enrichment).',
      setupTime: '3–5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable Chrome Extension saved-lead capture.',
        'Auto-create Sniper target on save.',
        'Toggle auto-enrichment as needed.'
      ],
      copyZap: [
        'Trigger: Chrome Extension → “Saved Lead Detected”',
        'Action: POST /api/sniper/targets/create',
        'Optional: POST /api/leads/:id/enrich'
      ].join('\n')
    },

    // Tranche 2 — CRM, Pipeline, Client Activation
    {
      id: 7,
      title: 'Lead Tagged ‘Hiring Manager’ → Create Client in CRM',
      category: 'CRM, Pipeline, Client Activation',
      tools: ['HirePilot','Monday.com','Notion'],
      description: 'Tag any lead “Hiring Manager” to auto-create a Client record in your CRM/project system.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable trigger: lead_tagged (filter = “Hiring Manager”).',
        'Connect Monday.com or Notion.',
        'Map fields (Name, Email, Status) to your CRM.'
      ],
      copyZap: `🚀 WORKFLOW — Lead Tagged “Hiring Manager” → Create Client in CRM

Purpose
When a lead in HirePilot gets the tag “Hiring Manager,” automatically create a CRM client record (e.g., Monday.com).

⸻
✅ PART 1 — Trigger (HirePilot → Zapier)
Step 1: Create Zap → Trigger
• App: HirePilot (Webhooks) or Webhooks by Zapier → Catch Hook
• Event: lead_tagged

Payload Example:
{
  "event_type": "lead_tagged",
  "lead": {
    "id": "lead_123",
    "name": "Chris Loper",
    "email": "chris@company.com",
    "title": "COO",
    "company": "Kickboxing Fitness",
    "tags": ["Hiring Manager"]
  }
}

⸻
✅ PART 2 — Filter (Only Hiring Manager Tag)
Step 2: Add Filter
• Field: lead.tags[]
• Condition: “Text Contains”
• Value: Hiring Manager

⸻
✅ PART 3 — Create Client in Monday.com
Step 3: Add Action
• App: Monday.com
• Event: Create Item

Step 4: Map Fields
• Board: your client CRM board
• Item Name: {{lead.company}} — {{lead.name}}
• Column Values (example JSON if required by your board):
{
  "client_name": "{{lead.company}}",
  "contact_name": "{{lead.name}}",
  "email": "{{lead.email}}",
  "title": "{{lead.title}}",
  "stage": "New"
}

⸻
✅ PART 4 — Optional Slack Confirmation
Step 5: Slack → Send message
Message:
✅ New CRM client created:
Company: {{lead.company}}
Contact: {{lead.name}} ({{lead.email}})
Title: {{lead.title}}

✅ DONE`,
      copyMake: `MAKE.COM BLUEPRINT — Lead Tagged “Hiring Manager” → Create Client
Modules
1) Webhooks → Custom webhook (lead_tagged)
2) Flow Control → Filter (tags contains “Hiring Manager”)
3) Monday.com → Create Item
4) (Optional) Slack → Post message

Details
1) Webhook: Receive HirePilot event with lead object.
2) Filter: Proceed only if array tags contains “Hiring Manager”.
3) Monday Create Item:
  • Board: your CRM board
  • Name: {{lead.company}} — {{lead.name}}
  • Column JSON mapping similar to:
    {"client_name":"{{lead.company}}","contact_name":"{{lead.name}}","email":"{{lead.email}}","title":"{{lead.title}}","stage":"New"}
4) Slack: Notify team a new CRM client was created.`
    },
    {
      id: 8,
      title: 'Client Created → Auto-Enrich + Slack Welcome',
      category: 'CRM, Pipeline, Client Activation',
      tools: ['HirePilot','Slack'],
      description: 'Auto-enrich a new client (size, industry, website) then post a Slack “client added” summary.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable trigger: client_created.',
        'Enable Client Enrichment action.',
        'Connect Slack and pick a channel.'
      ],
      copyZap: [
        'Trigger: HirePilot → client_created',
        'Action: /api/clients/:id/enrich',
        'Action: Slack “New client added”'
      ].join('\n')
    },
    {
      id: 9,
      title: 'Client Updated → Sync to Notion CRM',
      category: 'CRM, Pipeline, Client Activation',
      tools: ['HirePilot','Notion'],
      description: 'Keep Notion in sync any time a client is updated — no duplicates.',
      setupTime: '5–10 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Connect Notion in Integrations.',
        'Enable trigger: client_updated.',
        'Map client fields to Notion properties.'
      ],
      copyZap: [
        'Trigger: HirePilot → client_updated',
        'Action: Notion → Find Page',
        'Action: Notion → Update Page'
      ].join('\n')
    },
    {
      id: 10,
      title: 'Candidate Rejected → Send “Keep Warm” Message',
      category: 'CRM, Pipeline, Client Activation',
      tools: ['HirePilot','SendGrid'],
      description: 'When a candidate is rejected, automatically send a thoughtful “keep warm” email.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable trigger: candidate_rejected.',
        'Connect SendGrid and select your Keep Warm template.',
        'Optionally tag candidate “Keep Warm”.'
      ],
      copyZap: [
        'Trigger: HirePilot → candidate_rejected',
        'Action: SendGrid → Send template',
        'Action: /api/candidates/:id/addTag “Keep Warm”'
      ].join('\n')
    },
    {
      id: 11,
      title: 'Candidate Hired → Create Stripe Invoice + Win Alert',
      category: 'CRM, Pipeline, Client Activation',
      tools: ['HirePilot','Stripe','Slack'],
      description: 'Auto-create a Stripe invoice on hire and announce the win in Slack.',
      setupTime: '5–10 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable trigger: candidate_hired.',
        'Configure billing type and Stripe customer mapping.',
        'Connect Slack to post a win alert.'
      ],
      copyZap: [
        'Trigger: HirePilot → candidate_hired',
        'Action: /api/invoices/create',
        'Action: Stripe → Create invoice',
        'Action: Slack → Win alert'
      ].join('\n')
    },
    {
      id: 12,
      title: 'Candidate Submitted → Create DocuSign Offer Letter',
      category: 'CRM, Pipeline, Client Activation',
      tools: ['HirePilot','DocuSign'],
      description: 'Auto-generate a DocuSign offer letter and send to candidate and client.',
      setupTime: '5–10 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Connect DocuSign.',
        'Enable trigger: candidate_submitted.',
        'Map role, salary, start date into your template.'
      ],
      copyZap: [
        'Trigger: HirePilot → candidate_submitted',
        'Action: DocuSign → Create Envelope',
        'Action: Update candidate timeline'
      ].join('\n')
    },

    // Tranche 3 — REX Intelligence Engine
    {
      id: 13,
      title: 'REX Chat → Generate Daily Summary in Notion',
      category: 'REX Intelligence Engine',
      tools: ['REX','Notion','HirePilot'],
      description: 'REX writes a daily end-of-day summary (leads, replies, campaigns, flags) into Notion.',
      setupTime: '3–5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable REX Daily Summary.',
        'Connect Notion and select the database.',
        'Schedule for 6 PM daily (optional).'
      ],
      copyZap: [
        'Trigger: Schedule → Daily 6 PM',
        'Action: /rex/summarize_day',
        'Action: Notion → Create Page',
        'Action: Notion → Append stats & notes'
      ].join('\n')
    },
    {
      id: 14,
      title: 'REX Detects Unresponsive Campaign → Suggest A/B Test',
      category: 'REX Intelligence Engine',
      tools: ['REX','HirePilot'],
      description: 'REX detects low performance and drafts an improved variant for A/B testing.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable Campaign Monitoring.',
        'Define reply/open thresholds.',
        'Review suggested subject/body variants.'
      ],
      copyZap: [
        'Trigger: campaign_low_reply_rate (<3% after 2+ sends)',
        'Action: /rex/optimizeSubjectLine',
        'Action: /rex/buildABTestVariant',
        'Action: Slack/Email → send recommendation'
      ].join('\n')
    },
    {
      id: 15,
      title: 'REX Detects Hiring Gap → Build Outreach Sequence',
      category: 'REX Intelligence Engine',
      tools: ['REX','HirePilot'],
      description: 'If a Job REQ has no candidates, REX builds a new outreach sequence and can auto-launch.',
      setupTime: '5–10 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable “Job REQ needs candidates” trigger.',
        'Auto-generate sequence (titles, copy).',
        'Optionally auto-create and launch campaign.'
      ],
      copyZap: [
        'Trigger: jobreq_needs_candidates (0 candidates or >7 days inactivity)',
        'Action: /rex/generateOutreachSequence',
        'Action: /api/campaigns/create',
        'Action: Slack → notify'
      ].join('\n')
    },
    {
      id: 16,
      title: 'Sales Navigator Saved Lead → Create Sniper Target',
      category: 'REX Intelligence Engine',
      tools: ['Sales Navigator','Sniper','HirePilot'],
      description: 'When a user saves a lead in Sales Nav, create a Sniper target and start enrichment.',
      setupTime: '3–5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable Chrome Extension saved-lead capture.',
        'Create Sniper target automatically.',
        'Enable enrichment on new targets.'
      ],
      copyZap: [
        'Trigger: sales_nav_saved_lead',
        'Action: /sniper/targets/create',
        'Action: /sniper/enrich'
      ].join('\n')
    },
    {
      id: 17,
      title: 'Lead Replied → Update Candidate Profile in Notion',
      category: 'REX Intelligence Engine',
      tools: ['HirePilot','Notion'],
      description: 'When a lead replies, summarize and append to the candidate profile in Notion.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Connect Notion and select your database.',
        'Enable trigger: lead_replied.',
        'Append reply + timestamp into Notion.'
      ],
      copyZap: [
        'Trigger: HirePilot → lead_replied',
        'Action: Notion → Search for page',
        'Action: Notion → Append reply',
        'Action: /api/leads/:id/update (status = “Replied”)'
      ].join('\n')
    },
    {
      id: 18,
      title: 'Reply Detected → Notify Recruiter in Slack',
      category: 'REX Intelligence Engine',
      tools: ['HirePilot','Slack'],
      description: 'Send real-time reply alerts (sender, snippet, campaign, recommended next step).',
      setupTime: '3 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Connect Slack and choose the team channel.',
        'Enable trigger: lead_replied.',
        'Optionally include a deep link to HirePilot.'
      ],
      copyZap: [
        'Trigger: HirePilot → lead_replied',
        'Action: Slack → Send Block Kit message',
        'Action: /api/messages/markRead'
      ].join('\n')
    },
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

  const openZapierDocs = async () => {
    // Fetch the current user's API key; only open modal if a key exists
    try {
      const base = import.meta.env.VITE_BACKEND_URL || '';
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${base}/api/apiKeys`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const js = await res.json().catch(() => ({}));
        if (typeof js?.apiKey === 'string' && js.apiKey) {
          setZapierApiKey(js.apiKey);
          setShowZapierModal(true);
          return;
        }
        const keys = Array.isArray(js?.keys) ? js.keys : [];
        if (!js?.apiKey && keys.length > 0 && keys[0]?.key) {
          setZapierApiKey(keys[0].key);
          setShowZapierModal(true);
          return;
        }
      }
      alert('No API key found. Please go to Settings → Integrations → Automations and Generate API Key first.');
    } catch {}
  };

  const addWorkflow = (wf) => {
    setSavedWorkflows(prev => {
      const exists = prev.some((x) => x.title === wf.title);
      const next = exists ? prev : [...prev, { id: Date.now(), ...wf }];
      try { localStorage.setItem('hp_my_workflows_v1', JSON.stringify(next)); } catch {}
      return next;
    });
    setShowAddedToast(true);
  };

  const removeWorkflow = (id) => {
    setSavedWorkflows(prev => {
      const next = prev.filter(w => w.id !== id);
      try { localStorage.setItem('hp_my_workflows_v1', JSON.stringify(next)); } catch {}
      return next;
    });
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

  if (isFree) {
    return (
      <div className="bg-slate-950 min-h-screen text-white flex items-start justify-center p-8">
        <div className="w-full max-w-5xl bg-amber-50 border border-amber-200 rounded-2xl p-8 text-amber-900">
          <h2 className="text-3xl font-extrabold mb-2">Workflows is a paid feature</h2>
          <p className="text-lg mb-6">Upgrade to unlock advanced workflows and automations.</p>
          <a href="/pricing" className="inline-block px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">See Plans</a>
        </div>
      </div>
    );
  }

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
              <img src="/zapier-icon.png" alt="Zapier" className="w-12 h-12 rounded-lg mb-3" />
              <h4 className="font-semibold text-sm">Zapier</h4>
              <span className={`text-xs mt-2 ${integrationStatus.zapier ? 'text-green-400' : 'text-red-400'}`}>{integrationStatus.zapier ? '✅ Connected' : '⚠️ Not Connected'}</span>
              <button onClick={openZapierDocs} className="mt-3 text-xs px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600 transition">Manage</button>
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

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-2">
          <button onClick={() => setActiveTab('library')} className={activeTab==='library' ? 'px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium' : 'px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition'}>
            Workflows Library
          </button>
          <button onClick={() => setActiveTab('mine')} className={activeTab==='mine' ? 'px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium' : 'px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition'}>
            My Workflows
          </button>
        </div>

        {activeTab === 'library' && (
        <section id="workflow-library" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Workflow Recipes Library</h2>
          </div>

          {/* Intent category (Sniper) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">{INTENT_CATEGORY}</h3>
              <span className="text-xs text-slate-400">Public + Coming Soon</span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {INTENT_WORKFLOWS.map((w) => (
                <div key={w.slug} className="relative bg-slate-900 rounded-xl p-6 hover:bg-slate-800 transition group">
                  {w.visibility === 'in_app_only' && w.coming_soon && (
                    <div className="absolute -top-2 -right-2 bg-amber-500 text-amber-950 text-[11px] font-semibold px-2 py-1 rounded">Coming Soon</div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold pr-2">{w.title}</h3>
                    <span
                      className="px-2 py-1 rounded-full text-[11px] bg-slate-800 text-slate-300"
                      title={(() => { const e = estimateDiscoveryCredits(w); return e ? `Estimated credits (preview): ~${e}` : 'Estimated credits not available'; })()}
                    >
                      Intent
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{w.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(w.badges || []).map((b) => (
                      <span key={b} className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-300">{b}</span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {w.visibility === 'public' ? (
                      <>
                        <button onClick={() => addWorkflow({ id: w.slug, title: w.title, description: w.description, category: INTENT_CATEGORY, tools: w.badges || [] })} className="px-3 py-2 bg-emerald-600 rounded-lg text-xs font-semibold text-white hover:bg-emerald-500 transition">Add to Library</button>
                        <button onClick={() => window.open('/sniper', '_self')} className="px-3 py-2 bg-indigo-600 rounded-lg text-xs font-semibold text-white hover:bg-indigo-500 transition">Add to Session</button>
                      </>
                    ) : (
                      <>
                        <button disabled className="px-3 py-2 bg-slate-700 rounded-lg text-xs font-semibold text-white opacity-60 cursor-not-allowed">Run (Disabled)</button>
                        <button onClick={() => alert('We\'ll notify you when this is live.')} className="px-3 py-2 bg-indigo-600 rounded-lg text-xs font-semibold text-white hover:bg-indigo-500 transition">Notify Me</button>
                        <button onClick={() => addWorkflow({ id: w.slug, title: w.title, description: w.description, category: INTENT_CATEGORY, tools: w.badges || [] })} className="px-3 py-2 bg-emerald-600 rounded-lg text-xs font-semibold text-white hover:bg-emerald-500 transition">Add to Library</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
                      <button onClick={() => addWorkflow(wf)} className="px-3 py-2 bg-emerald-600 rounded-lg text-xs font-semibold text-white hover:bg-emerald-500 transition">Add Workflow</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
        )}

        {activeTab === 'mine' && (
        <section id="my-workflows" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">My Workflows</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-300 hidden md:inline">Create your own workflow here:</span>
              <button onClick={() => window.open('/sandbox','_self')} className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold hover:from-emerald-400 hover:to-teal-500 transition">
                Sandbox
              </button>
            </div>
          </div>
          {savedWorkflows?.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {savedWorkflows.map((wf) => (
                <div key={wf.id} className="bg-slate-900 rounded-xl p-6 hover:bg-slate-800 transition group">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold pr-2">{wf.title}</h3>
                    <span className="px-2 py-1 rounded-full text-xs bg-slate-800 text-slate-300">Saved</span>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">{wf.description || 'Saved workflow'}</p>
                  <div className="flex gap-2">
                    <button onClick={() => openRecipe({ title: wf.title, summary: wf.description, tools: wf.tools || [], setupTime: wf.setupTime || '', difficulty: wf.difficulty || '', formula: toFormulaString(wf), setupSteps: wf.setupSteps || [], copyZap: wf.copyZap || '', copyMake: wf.copyMake || '' })} className="px-3 py-2 bg-indigo-500 rounded-lg text-xs font-semibold text-white hover:bg-indigo-400 transition">View Details</button>
                    <button onClick={() => window.open('/sandbox', '_self')} className="px-3 py-2 bg-blue-600 rounded-lg text-xs font-semibold text-white hover:bg-blue-500 transition">Open in Sandbox</button>
                    <button onClick={() => removeWorkflow(wf.id)} className="px-3 py-2 bg-slate-700 rounded-lg text-xs font-semibold text-white hover:bg-slate-600 transition">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400">No saved workflows yet. Add some from the Workflows Library.</div>
          )}
        </section>
        )}
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

      {showZapierModal && (
        <ZapierModalFrame
          onClose={() => setShowZapierModal(false)}
          apiKey={zapierApiKey}
        />
      )}

      <AnimatePresence>
        {showAddedToast && (
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]"
            role="status"
            aria-live="polite"
          >
            <div className="relative px-5 py-3 rounded-xl shadow-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <i className="fa-solid fa-check text-white"></i>
              </div>
              <div className="font-semibold">Added to My Workflows</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


