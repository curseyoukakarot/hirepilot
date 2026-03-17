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
  const [savedWorkflows, setSavedWorkflows] = useState(() => []);
  const [storageKey, setStorageKey] = useState('hp_my_workflows_v1'); // will be namespaced per-user once user is known
  const [integrationStatus, setIntegrationStatus] = useState({ slack:false, zapier:false, sendgrid:false, stripe:false, linkedin:false });
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [showZapierModal, setShowZapierModal] = useState(false);
  const [zapierApiKey, setZapierApiKey] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'alpha' | 'difficulty'

  const ALL_CATEGORIES = ['All', 'Discovery + Lead Intelligence', 'CRM, Pipeline, Client Activation', 'REX Intelligence Engine', 'Messaging'];

  // Determine integration type badge for a workflow
  const getIntegrationType = (wf) => {
    const tools = wf.tools || [];
    const toolsLower = tools.map(t => t.toLowerCase());
    if (toolsLower.every(t => t === 'hirepilot' || t === 'rex')) return { label: 'Native', color: 'bg-emerald-900 text-emerald-300 border-emerald-700' };
    if (toolsLower.some(t => t === 'zapier' || t === 'make.com' || t === 'make')) return { label: 'Zapier', color: 'bg-orange-900 text-orange-300 border-orange-700' };
    return { label: 'Custom', color: 'bg-blue-900 text-blue-300 border-blue-700' };
  };

  // Status indicator helper for My Workflows
  const getStatusIndicator = (wf) => {
    if (wf.is_active && wf.status === 'ok') return { dot: 'bg-green-400 animate-pulse', text: 'Active', textColor: 'text-green-400' };
    if (wf.status === 'error') return { dot: 'bg-red-400', text: 'Error', textColor: 'text-red-400' };
    if (wf.status === 'needs_setup') return { dot: 'bg-yellow-400', text: 'Needs Setup', textColor: 'text-yellow-400' };
    return { dot: 'bg-gray-500', text: 'Inactive', textColor: 'text-gray-400' };
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        // Set per-user storage key and hydrate saved workflows
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const uid = user?.id || 'anon';
          const key = `hp_my_workflows_v2_${uid}`;
          setStorageKey(key);
          // Migrate legacy global list once for this user if needed
          let initial = [];
          try {
            const scoped = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(scoped) && scoped.length) {
              initial = scoped;
            } else {
              const legacyKey = 'hp_my_workflows_v1';
              const legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]');
              if (Array.isArray(legacy) && legacy.length) {
                initial = legacy;
                try { 
                  localStorage.setItem(key, JSON.stringify(initial)); 
                  // Remove legacy global key to prevent cross-account bleed on this browser
                  localStorage.removeItem(legacyKey); 
                } catch {}
              }
            }
          } catch {}
          setSavedWorkflows(Array.isArray(initial) ? initial : []);
        } catch {}
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
      id: 20,
      title: 'Lead Source: Skrapp → Launch Warm-Up Sequence',
      category: 'Discovery + Lead Intelligence',
      tools: ['Skrapp','SendGrid','HirePilot'],
      description: 'Skrapp lead captured → create in HirePilot → enrich → send intro via SendGrid → schedule follow-up.',
      setupTime: '6–10 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Create a Zap with Webhooks → Catch Hook to receive Skrapp payloads.',
        'POST the lead into HirePilot using /api/leads/import and capture lead.id.',
        'POST to /api/leads/{id}/enrich, then send intro via SendGrid and add a 2‑day follow-up.'
      ],
      copyZap: `🚀 WORKFLOW — Lead Source: Skrapp → Launch Warm‑Up Email Sequence

Purpose
Skrapp → Lead enters HirePilot → HirePilot enriches → Zap triggers → Intro email is automatically sent → Follow‑up scheduled.

⸻
✅ PART 1 — Trigger (Skrapp → HirePilot Ingest)
Option A (direct payload):
• Webhooks by Zapier → Catch Hook
Example payload:
{
  "source": "skrapp",
  "name": "Chris Doe",
  "email": "chris@startup.com",
  "company": "Startup Labs",
  "job_title": "VP Marketing",
  "location": "Austin, TX"
}

Step 2: Store in HirePilot using API
Action: Webhooks by Zapier → Custom Request
• Method: POST
• URL: https://api.thehirepilot.com/api/leads/import
• Headers: Content-Type: application/json, X-API-Key: {{your_api_key}}
• Body:
{
  "name": "{{name}}",
  "email": "{{email}}",
  "title": "{{job_title}}",
  "company": "{{company}}",
  "location": "{{location}}",
  "source": "skrapp"
}
✅ This writes a new lead row.

Step 3: Extract Lead ID from Response
Zapier output:
{ "id": "lead_123", "status": "created" }

⸻
⸻
Option B (event-driven):
• Webhooks by Zapier → Catch Hook (HirePilot event)
Payload:
{
  "event_type": "lead_created",
  "source": "Skrapp",
  "lead_id": "abc123456"
}
Add Filter: source == "Skrapp"
Then GET https://api.thehirepilot.com/api/leads/{{lead_id}} (X-API-Key) to hydrate fields before sending or enrichment.

⸻
✅ PART 2 — Enrich the Lead Automatically
Step 4: Webhooks → Custom Request
• Method: POST
• URL: https://api.thehirepilot.com/api/leads/{{id}}/enrich
• Headers: X-API-Key: {{your_api_key}}
• Body: {}
Expected enriched fields include apollo first_name/last_name, title, org, etc.

⸻
✅ PART 3 — Prepare Email Variables
Step 5: Formatter → Text / Utilities
Extract email and first_name from the enriched response (or default from Skrapp if missing).

⸻
✅ PART 4 — Send Intro Email via SendGrid
Step 6: SendGrid → Send Email
From: your verified sender
To: {{email from enrichment}}
HTML:
<p>Hi {{first_name}},</p>
<p>I saw you’re leading {{title}} at {{company}} and thought I’d introduce myself quickly.</p>
<p>I run <strong>HirePilot</strong> — we help teams scale outbound recruiting without adding headcount. If you’re evaluating tools for hiring, sourcing, or pipeline visibility, I can share ideas that have worked for teams like yours.</p>
<p>Worth a quick chat?</p>
<p>— Brandon</p>

⸻
✅ PART 5 — Add 2‑Day Follow‑Up Reminder
Step 7: Delay For → 2 days
Step 8: Filter
• Only continue if replied == false OR status != engaged  
• (Optionally GET /api/leads/{{id}}/status to check.)
Step 9: Send Follow‑Up Email (light variation).`,
      copyMake: `MAKE.COM BLUEPRINT — Skrapp → Warm‑Up Sequence
Modules
1) Webhooks → Custom webhook (Skrapp payload)
2) HTTP → POST /api/leads/import (store lead)
3) HTTP → POST /api/leads/{{id}}/enrich
4) Tools → JSON/Functions to pick email, first_name, title, company
5) SendGrid → Send Email (intro)
6) Tools → Sleep/Flow control → 2 days
7) (Optional) HTTP GET /api/leads/{{id}}/status → branch
8) SendGrid → Send Email (follow‑up)

Filters
• Skip email if no valid email present after enrichment.
• Branch based on status/replied fields.`
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
      copyZap: `🚀 WORKFLOW — Lead Replied → Notify Recruiter in Slack

Purpose
Instant Slack alerts when any prospect replies. Includes message excerpt, lead profile, campaign name, and supports optional auto‑enrich if the email is missing.

⸻
✅ PART 1 — Trigger: HirePilot Reply Event
Step 1: Trigger — Webhooks by Zapier → Catch Hook
Expected payload:
{
  "event_type": "lead_replied",
  "lead_id": "dc621ef8-337c-4c5a-a1ec-c074f487db17",
  "campaign_id": "cmp_123",
  "message_id": "msg_778",
  "reply_text": "Hey, yes I'm interested. Let's talk.",
  "timestamp": "2025-11-09T12:55:23.111Z"
}
Grab lead_id, campaign_id, reply_text.

⸻
✅ PART 2 — Get Lead Info
Step 2: Custom Request (GET)
• URL: https://api.thehirepilot.com/api/leads/{{lead_id}}
• Headers: X-API-Key: {{your_api_key}}
Response includes: name, title, company, email, linkedin_url.

⸻
✅ PART 3 — Get Campaign Name
Step 3: Custom Request (GET)
• URL: https://api.thehirepilot.com/api/campaigns/{{campaign_id}}
• Headers: X-API-Key: {{your_api_key}}
Response includes: { "id":"cmp_123","name":"SDR Outbound — Q4" }

⸻
✅ PART 4 — Format Reply Snippet Safely
Step 4: Formatter → Text → Truncate
• Input: {{reply_text}}  
• Length: 200 chars → output “reply_snippet”
Also (optional) Formatter → Text → Replace to normalize line breaks.

⸻
✅ PART 5 — Send Slack Notification
Step 5: Slack → Send Channel Message
Message:
💬 *New Reply Received!*
*Lead:* {{lead.name}} — {{lead.title}} @ {{lead.company}}  
*Email:* {{lead.email}}  
*Campaign:* {{campaign.name}}
Reply:
> "{{reply_snippet}}"
🔗 LinkedIn: {{lead.linkedin_url}}

⸻
✅ OPTIONAL — Auto‑Enrich if Email Missing
If {{lead.email}} empty:
• POST https://api.thehirepilot.com/api/leads/{{lead_id}}/enrich  
  Headers: X-API-Key: {{api_key}}
Then re‑post Slack with the updated email if found.

✅ DONE`,
      copyMake: `MAKE.COM BLUEPRINT — Lead Replied → Notify Recruiter in Slack
Modules
1) Webhooks → Custom webhook (lead_replied)
2) HTTP GET → /api/leads/{{lead_id}}
3) HTTP GET → /api/campaigns/{{campaign_id}}
4) Tools → Text → Truncate reply to 200 chars
5) Slack → Create a message
6) (Optional) HTTP POST → /api/leads/{{lead_id}}/enrich if email missing → Slack again

Notes
• Add a filter to ensure reply_text exists before posting.`
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
      copyZap: `🚀 WORKFLOW — Sales Navigator Saved Lead → Create Sniper Target

Purpose
Automatically convert any manually saved Sales Navigator lead into a Sniper Target inside HirePilot — turning normal browsing into pipeline building.

⸻
✅ PART 1 — Trigger: Chrome Extension Event
Step 1: Webhooks by Zapier → Catch Hook (from HirePilot Chrome Extension)
Example payload:
{
  "event_type": "sales_navigator_saved_lead",
  "lead": {
    "name": "Chris Loper",
    "title": "VP Operations",
    "company": "SportClips",
    "linkedin_url": "https://www.linkedin.com/in/chris-loper-3a40284"
  }
}

⸻
✅ PART 2 — Validate the Lead Exists in HirePilot (optional)
Step 2: Custom Request
• Method: GET  
• URL: https://api.thehirepilot.com/api/leads/lookup?linkedin_url={{lead.linkedin_url}}  
• Headers: X-API-Key: {{api_key}}
If not found → continue to create target.

⸻
✅ PART 3 — Create Sniper Target
Step 3: Custom Request
• Method: POST  
• URL: https://api.thehirepilot.com/api/sniper/targets/create  
• Headers: X-API-Key: {{api_key}}, Content-Type: application/json  
• Body:
{
  "name": "{{lead.name}}",
  "title": "{{lead.title}}",
  "company": "{{lead.company}}",
  "linkedin_url": "{{lead.linkedin_url}}",
  "source": "Sales Navigator Saved Lead"
}
Expected response:
{ "target_id": "sniper_457", "status": "created" }

⸻
✅ PART 4 — Enrich Target Automatically
Step 4: Custom Request
• Method: POST  
• URL: https://api.thehirepilot.com/api/sniper/targets/{{target_id}}/enrich  
• Headers: X-API-Key: {{api_key}}

⸻
✅ PART 5 — Slack Announcement
Step 5: Slack → Send Channel Message
Message:
🎯 *New Sniper Target Added!*  
{{lead.name}} — {{lead.title}} @ {{lead.company}}  
📎 {{lead.linkedin_url}}  
Enrichment in progress…`,
      copyMake: `MAKE.COM BLUEPRINT — Sales Nav Saved Lead → Sniper Target
Modules
1) Webhooks → Custom webhook (sales_navigator_saved_lead)
2) (Optional) HTTP GET → /api/leads/lookup?linkedin_url={{...}}
3) HTTP POST → /api/sniper/targets/create
4) HTTP POST → /api/sniper/targets/{{target_id}}/enrich
5) Slack → Create a message

Notes
• Include LinkedIn URL and title/company in the Slack message.
• If lookup finds an existing lead, you can branch to skip duplicate creation.`
    },
    // Tranche 4 — Advanced Messaging Workflows
    {
      id: 21,
      title: 'Campaign Relaunched → Team Announcement + Stats',
      category: 'Messaging',
      tools: ['HirePilot','Slack'],
      description: 'On each campaign relaunch, post fresh metrics (sends/opens/replies/clicks/bounces) with owner and timestamp to Slack.',
      setupTime: '4–6 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Trigger on campaign_relaunched from HirePilot.',
        'GET /api/campaigns/{id} for metadata and /stats for metrics.',
        'Format rates; send Slack summary; optionally warn if reply rate < 5%.'
      ],
      copyZap: `🚀 WORKFLOW — Campaign Relaunched → Team Announcement + Stats

Purpose
Every time a campaign is re‑launched inside HirePilot, send a detailed Slack summary with campaign name, sends/opens/replies, reply rate, owner, and timestamp.

⸻
✅ PART 1 — Trigger: HirePilot → campaign_relaunched
Step 1: Webhooks by Zapier → Catch Hook
Payload:
{
  "event_type": "campaign_relaunched",
  "campaign_id": "c123",
  "user_id": "user_45",
  "timestamp": "2025-11-09T14:31:09Z"
}
Grab campaign_id and timestamp.

⸻
✅ PART 2 — Fetch Campaign Stats
Step 2: Custom Request (GET)
• Method: GET  
• URL: https://api.thehirepilot.com/api/campaigns/{{campaign_id}}  
• Headers: X-API-Key: {{api_key}}
Expected:
{ "id":"cmp_123","name":"Outbound SDR — Q4 Refresh","owner_user_id":"user_45" }

Step 2b: Custom Request (GET) — Stats Snapshot
• URL: https://api.thehirepilot.com/api/campaigns/{{campaign_id}}/stats
• Headers: X-API-Key: {{api_key}}
Sample:
{ "sent":330,"opens":197,"open_rate":"59.7","replies":22,"reply_rate":"6.6","bounces":4,"clicks":18 }

⸻
✅ PART 3 — Format Values
Step 3: Formatter → Numbers → Format Percent
• open_rate → “59.7%”  
• reply_rate → “6.6%”

⸻
✅ PART 4 — (Optional) Fetch Owner Info
Step 4: Custom Request (GET)
• URL: https://api.thehirepilot.com/api/users/{{owner_user_id}}
• Headers: X-API-Key: {{api_key}}
Response:
{ "id":"user_45","name":"Megan Cole","email":"megan@thehirepilot.com" }
Set campaign_owner_name = response.name (fallback to user_id).

⸻
✅ PART 4 — Post Slack Update
Step 5: Slack → Send Channel Message
Channel: #team-leads (or user-selected)
Message:
📣 *Campaign Relaunched!*
*Campaign:* {{campaign.name}}
*Sent:* {{sent}}
*Opens:* {{opens}} ({{open_rate}}%)
*Replies:* {{replies}} ({{reply_rate}}%)
*Clicks:* {{clicks}}
Owner: {{campaign_owner_name}}
Time: {{timestamp}}

⸻
✅ PART 5 — Optional Condition
Step 6: Filter → Only continue if reply_rate < 5  
Then Slack message:
⚠️ Low reply rate detected for {{campaign.name}} — consider A/B testing subject lines.

✅ DONE`,
      copyMake: `MAKE.COM BLUEPRINT — Campaign Relaunched → Stats to Slack
Modules
1) Webhooks → Custom webhook (campaign_relaunched)
2) HTTP GET → /api/campaigns/{{id}}/stats
3) Tools → Numbers/Text to format percentages
4) Slack → Create a message
5) (Optional) Router: low reply rate branch → Slack warning

Tip
• Convert rates to friendly strings before posting.`
    },
    {
      id: 22,
      title: 'High-Performing Template → Clone to Top Performers',
      category: 'Messaging',
      tools: ['HirePilot','Slack','Notion'],
      description: 'When a template exceeds performance thresholds, auto-clone it into “Top Performers” and notify the team.',
      setupTime: '4–6 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Trigger on template_metrics_updated.',
        'Filter for open_rate > 45 or reply_rate > 15.',
        'POST /api/templates/{id}/clone to Top Performers and alert Slack; optionally log to Notion.'
      ],
      copyZap: `🚀 WORKFLOW — High‑Performing Template → Clone to Top Performers Folder (and optionally New Campaign)

Purpose
Surface winning templates automatically and store them in “Top Performers” for reuse.

⸻
✅ PART 1 — Trigger: Template Metrics Updated
Step 1: Webhooks by Zapier → Catch Hook
Payload:
{
  "event_type": "template_metrics_updated",
  "template": {
    "id": "temp_005",
    "name": "Q4 Executive Outreach",
    "open_rate": 56,
    "reply_rate": 22,
    "campaign_id": "c123"
  }
}

⸻
✅ PART 2 — Conditional Filter
Step 2: Filter
• Continue if template.open_rate > 45 OR template.reply_rate > 15

⸻
✅ PART 3 — Clone Template
Step 3: Custom Request
• Method: POST  
• URL: https://api.thehirepilot.com/api/templates/{{template.id}}/clone  
• Headers: X-API-Key: {{api_key}}, Content-Type: application/json  
• Body: { "target_folder": "Top Performers" }
Expected: { "new_template_id": "temp_239", "status": "cloned" }

⸻
✅ PART 4.5 — Optional: Attach to New Campaign
Step 3b: Create Fresh Campaign
• Method: POST  
• URL: https://api.thehirepilot.com/api/campaigns  
• Headers: X-API-Key: {{api_key}}, Content-Type: application/json  
• Body:
{
  "name": "Top Performer — {{template.name}}",
  "template_id": "{{new_template_id}}"
}

⸻
✅ PART 4 — Notify Team
Step 4: Slack → Send Message
🌟 *New High‑Performer Identified!*  
Template: {{template.name}}  
Open Rate: {{template.open_rate}}%  
Reply Rate: {{template.reply_rate}}%  
✅ Automatically cloned into *Top Performers*.

⸻
✅ PART 5 — Optional Add to Notion Library
Step 5: Notion → Create Page with:
• Template Name • Link to HirePilot template • Open Rate • Reply Rate • Date Added

✅ DONE`,
      copyMake: `MAKE.COM BLUEPRINT — High‑Performer → Clone & Announce
Modules
1) Webhooks → Custom webhook (template_metrics_updated)
2) Flow Control → Filter thresholds
3) HTTP POST → /api/templates/{{id}}/clone (target_folder = Top Performers)
4) Slack → Create a message
5) (Optional) Notion → Create Page

Notes
• Consider storing the new_template_id in a Data Store for later reuse.`
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
      copyZap: `🚀 WORKFLOW — Lead Tagged “Hiring Manager” → Create Client in CRM (Monday.com)

Purpose
Auto‑create a client record in Monday when a user tags someone “Hiring Manager” in HirePilot.

⸻
✅ PART 1 — Trigger: Hiring Manager Tag Added
Step 1: Webhooks by Zapier → Catch Hook
Payload:
{
  "event_type": "lead_tag_added",
  "lead_id": "dc621ef8-337c-4c5a-a1ec-c074f487db17",
  "tag": "Hiring Manager"
}

⸻
✅ PART 2 — Filter
Step 2: Filter by Zapier
• Continue only if tag == "Hiring Manager"

⸻
✅ PART 3 — Get Full Lead Profile
Step 3: Custom Request (GET)
• URL: https://api.thehirepilot.com/api/leads/{{lead_id}}
• Headers: X-API-Key: {{api_key}}
Response includes name, title, company, email, location.

⸻
✅ PART 4 — Check if Client Already Exists (Optional Safety)
Step 4: Monday GraphQL Query
• POST https://api.monday.com/v2
• Headers: Authorization: {{monday_api_key}}, Content-Type: application/json
• Body:
{ "query": "query { items_by_column_values(board_id: 123456, column_id: \\"email\\", column_value: \\"{{email}}\\") { id } }" }
If items found → STOP (client exists).

⸻
✅ PART 5 — Create Client in Monday
Step 5: Monday GraphQL Mutation
• POST https://api.monday.com/v2
• Body:
{ "query": "mutation { create_item(board_id: 123456, item_name: \\"{{lead.company}}\\", column_values: \\"{\\\\\\"email\\\\\\": \\\\\\"{{lead.email}}\\\\\\", \\\\\\"text\\\\\\": \\\\\\"{{lead.name}} — {{lead.title}}\\\\\\", \\\\\\"location\\\\\\": \\\\\\"{{lead.location}}\\\\\\"}\\" ) { id } }" }

⸻
✅ PART 6 — Push Confirmation to Slack (Optional)
Message:
🤝 New CRM Client added:
{{lead.company}}
Contact: {{lead.name}}, {{lead.title}}`,
      copyMake: `MAKE.COM BLUEPRINT — Lead Tagged “Hiring Manager” → Create Client (Monday)
Modules
1) Webhooks → Custom webhook (lead_tag_added)
2) Filter → tag == "Hiring Manager"
3) HTTP GET → /api/leads/{{lead_id}}
4) HTTP POST → monday.com/v2 (GraphQL) items_by_column_values (email) to dedupe
5) HTTP POST → monday.com/v2 (GraphQL) create_item with mapped columns
6) (Optional) Slack → Create a message

Notes
• Use board_id/column_ids appropriate for the user’s Monday board.`
    },
    {
      id: 8,
      title: 'Client Created → Auto-Enrich + Slack Welcome',
      category: 'CRM, Pipeline, Client Activation',
      tools: ['HirePilot','Slack'],
      description: 'Auto-enrich a new client (size, industry, website, funding) then post a Slack “client added” summary.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Enable trigger: client_created.',
        'POST /api/clients/{id}/enrich to fetch company website, industry, team size, funding.',
        'Connect Slack and pick a channel to post new client summaries.'
      ],
      copyZap: `🚀 WORKFLOW — Client Created → Auto-Enrich + Slack Welcome

Purpose
When you add a client in HirePilot, the system enriches their company and posts a beautiful Slack intro summary.

⸻
✅ PART 1 — Trigger (HirePilot → client_created Event)
Step 1: Trigger
• App: Webhooks → Catch Hook (or HirePilot Webhooks)

Payload example:
{
  "event_type": "client_created",
  "client": {
    "id": "client_789",
    "company": "Startup Labs",
    "contact_name": "Chris Loper",
    "contact_email": "chris@startup.com"
  }
}

⸻
✅ PART 2 — Enrich Company Info
Step 2: Custom Request
• URL: https://api.thehirepilot.com/api/clients/{{client.id}}/enrich
• Method: POST
• Headers: X-API-Key: {{api_key}}
• Body: {}

Enriched response contains fields like:
{
  "website": "https://startuplabs.com",
  "industry": "Software",
  "size": "100-250",
  "funding": "$12.5M"
}

⸻
✅ PART 3 — Format for Slack
Step 3: Formatter → Text → Replace/Trim
Clean any odd characters in industry/size if needed.

⸻
✅ PART 4 — Send Slack Summary
Step 4: Slack → Send Channel Message
Message:
🎉 *New Client Added!*  
*Company:* {{company}}  
*Primary Contact:* {{contact_name}}  
*Email:* {{contact_email}}  
*Industry:* {{industry}}  
*Team Size:* {{size}}  
*Funding:* {{funding}}  
*Website:* {{website}}  

⸻
✅ PART 5 — Optional Notion Sync
Step 5: Notion → Create/Update Page with the same fields.

✅ DONE`,
      copyMake: `MAKE.COM BLUEPRINT — Client Created → Auto‑Enrich + Slack Welcome
Modules
1) Webhooks → Custom webhook (client_created)
2) HTTP → POST /api/clients/{{client.id}}/enrich
3) Tools → Text functions to format industry/size
4) Slack → Create a message with enriched fields
5) (Optional) Notion → Create/Update Page

Notes
• Include website, industry, size, funding in the Slack message for a polished team announcement.`
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
      description: 'When a candidate is rejected, automatically send a courteous “keep warm” email and optionally follow-up later.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Trigger on candidate_rejected (pipeline update).',
        'Connect SendGrid and map candidate variables.',
        'Optional: Delay and send a second message after 7 days.'
      ],
      copyZap: `🚀 WORKFLOW — Candidate Rejected → Send “Keep Warm” Message

Purpose
When a candidate gets rejected in your pipeline, send a professional keep‑warm email automatically.

⸻
✅ PART 1 — Trigger (pipeline_stage_updated)
Step 1: Trigger
• Webhooks → Catch Hook

Payload:
{
  "event_type": "candidate_rejected",
  "candidate": {
    "id": "cand_123",
    "name": "Alex Brown",
    "email": "alex.brown@example.com",
    "job_applied": "Senior AE"
  }
}

⸻
✅ PART 2 — Filter for Rejected Stage
Step 2: Filter
• Only continue if event_type == candidate_rejected

⸻
✅ PART 3 — Extra Context Pull (Optional)
Step 3: HTTP GET
• URL: https://api.thehirepilot.com/api/candidates/{{candidate.id}}
• Headers: X-API-Key: {{your_key}}
• Use this for recruiter, previous stages, etc.

⸻
✅ PART 4 — Build HTML Email
Step 4: SendGrid → Send Email
• To: {{candidate.email}}
• HTML:
<p>Hi {{candidate.name}},</p>
<p>Thank you again for taking the time to interview for the {{job_applied}} role.</p>
<p>While we’re moving forward with a different candidate for this specific opening, we were genuinely impressed with your background and want to stay connected as more roles come in.</p>
<p>If you’re open to it, I’d love to keep you on our radar and reach out the moment something aligned appears.</p>
<p>Warm regards,<br><br>
<strong>Brandon Omoregie</strong><br>
Founder & CEO @ HirePilot<br>
<a href="https://www.thehirepilot.com">www.thehirepilot.com</a><br>
<a href="https://calendly.com/hirepilot/30min">Schedule a call with me</a>
</p>

⸻
✅ PART 5 — Optional Follow‑Up
Step 5: Delay → 7 days; send a short follow‑up if appropriate.

✅ DONE`,
      copyMake: `MAKE.COM BLUEPRINT — Candidate Rejected → Keep Warm
Modules
1) Webhooks → Custom webhook (candidate_rejected)
2) (Optional) HTTP GET → /api/candidates/{{id}} for extra context
3) SendGrid → Send Email (HTML from above)
4) Tools → Sleep → 7 days
5) (Optional) SendGrid → Send follow‑up

Filters
• Ensure candidate.email exists before sending.`
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
      description: 'When a candidate/lead replies, append the latest message to their Notion timeline for perfect CRM sync.',
      setupTime: '5 min',
      difficulty: 'Beginner',
      setupSteps: [
        'Connect Notion and select your database.',
        'Enable trigger: lead_replied.',
        'Append reply + timestamp into Notion.'
      ],
      copyZap: `🚀 WORKFLOW — Reply Detected → Update Candidate Profile in Notion

Purpose
When a candidate replies (email, LI, SMS), append the latest message to their Notion timeline.

⸻
✅ PART 1 — Trigger: Reply Event
Step 1: Webhooks by Zapier → Catch Hook
Payload:
{
  "event_type": "candidate_replied",
  "candidate_id": "cand_987",
  "reply_text": "Hey! I'm available this Friday at 2pm.",
  "timestamp": "2025-11-09T15:59:11"
}

⸻
✅ PART 2 — Fetch Candidate Details
Step 2: Custom Request (GET)
• URL: https://api.thehirepilot.com/api/candidates/{{candidate_id}}
• Headers: X-API-Key: {{api_key}}
Response:
{
  "id": "cand_987",
  "name": "Heather Martinez",
  "email": "heather.martinez@example.com",
  "title": "Product Designer",
  "notion_page_id": "f34f4452-9327-4823-8921-901af51f82f3"
}

⸻
✅ PART 3 — Format the Reply Text
Step 3: Formatter → Text Template
Template:
**{{timestamp}}**
{{reply_text}}
Output: formatted_reply

⸻
✅ PART 4 — Append to Notion Timeline
Step 4: Webhooks by Zapier → Custom Request
• Method: PATCH
• URL: https://api.notion.com/v1/blocks/{{notion_page_id}}/children
• Headers:
  - Authorization: Bearer {{notion_api_key}}
  - Content-Type: application/json
  - Notion-Version: 2021-08-16
• Body:
{
  "children": [
    {
      "object": "block",
      "type": "callout",
      "callout": {
        "rich_text": [
          { "type": "text", "text": { "content": "{{formatted_reply}}" } }
        ],
        "icon": { "emoji": "💬" }
      }
    }
  ]
}

⸻
✅ PART 5 — Optional: Slack Confirmation
Message:
✅ Notion updated for {{candidate.name}}  
Reply synced: "{{reply_text}}"`,
      copyMake: `MAKE.COM BLUEPRINT — Reply Detected → Update Candidate in Notion
Modules
1) Webhooks → Custom webhook (candidate_replied)
2) HTTP GET → /api/candidates/{{candidate_id}}
3) Tools → Template → "**{{timestamp}}**\\n{{reply_text}}"
4) HTTP PATCH → https://api.notion.com/v1/blocks/{{notion_page_id}}/children (append callout)
5) (Optional) Slack → Create a message

Headers for Notion
• Authorization: Bearer {{notion_api_key}}
• Content-Type: application/json
• Notion-Version: 2021-08-16`
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
    let result = workflows;
    // Text search
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (w) => w.title.toLowerCase().includes(q) ||
          (w.description || '').toLowerCase().includes(q) ||
          (w.category || '').toLowerCase().includes(q) ||
          (w.tools || []).some(t => t.toLowerCase().includes(q))
      );
    }
    // Category filter
    if (activeCategory !== 'All') {
      result = result.filter((w) => w.category === activeCategory);
    }
    // Sort
    if (sortBy === 'alpha') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'difficulty') {
      const order = { 'Beginner': 0, 'Intermediate': 1, 'Advanced': 2 };
      result = [...result].sort((a, b) => (order[a.difficulty] || 0) - (order[b.difficulty] || 0));
    }
    return result;
  }, [query, activeCategory, sortBy]);

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
      const next = exists ? prev : [...prev, { id: Date.now(), is_active: false, status: 'needs_setup', ...wf }];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
    setShowAddedToast(true);
  };

  const removeWorkflow = (id) => {
    setSavedWorkflows(prev => {
      const next = prev.filter(w => w.id !== id);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
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
        <button onClick={() => window.open('/sandbox','_self')} className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 rounded-lg font-semibold hover:scale-105 transition">
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

          {/* Category Filters + Sort */}
          <div id="category-filters" className="flex items-center gap-2 flex-wrap">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {cat}
              </button>
            ))}
            <div className="h-6 w-px bg-slate-700 mx-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="default">Default Order</option>
              <option value="alpha">A-Z</option>
              <option value="difficulty">By Difficulty</option>
            </select>
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getIntegrationType(wf).color}`}>{getIntegrationType(wf).label}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${colorClasses[wf.color] || 'bg-slate-800 text-slate-300'}`}>
                          <span className="mr-1">{wf.icon}</span>{wf.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm mb-3">{wf.description}</p>
                    {/* Visual flow preview */}
                    <div className="flex items-center gap-1 text-xs text-slate-500 mb-3 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 text-[10px]">Trigger</span>
                      <span className="text-slate-600">&rarr;</span>
                      {(wf.actions || []).slice(0, 2).map((_, i) => (
                        <React.Fragment key={i}>
                          <span className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 text-[10px]">Action {i+1}</span>
                          {i < Math.min((wf.actions || []).length, 2) - 1 && <span className="text-slate-600">&rarr;</span>}
                        </React.Fragment>
                      ))}
                      {(wf.actions || []).length > 2 && <span className="text-slate-600 text-[10px]">+{(wf.actions || []).length - 2}</span>}
                    </div>
                    {/* Tools pills */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(wf.tools || []).map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{t}</span>)}
                    </div>
                    {/* Difficulty & setup time */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                      {wf.difficulty && <span className="flex items-center gap-1"><i className="fa-solid fa-signal text-[9px]"></i> {wf.difficulty}</span>}
                      {wf.setupTime && <span className="flex items-center gap-1"><i className="fa-regular fa-clock text-[9px]"></i> {wf.setupTime}</span>}
                    </div>
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
              {savedWorkflows.map((wf) => {
                const status = getStatusIndicator(wf);
                const badge = getIntegrationType(wf);
                return (
                <div key={wf.id} className="bg-slate-900 rounded-xl p-6 hover:bg-slate-800 transition group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.dot}`}></span>
                      <h3 className="text-lg font-semibold truncate">{wf.title}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.color}`}>{badge.label}</span>
                      <span className={`text-[11px] ${status.textColor}`}>{status.text}</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{wf.description || 'Saved workflow'}</p>
                  {/* Tools */}
                  {wf.tools?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {wf.tools.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{t}</span>)}
                    </div>
                  )}
                  {/* Toggle + Actions */}
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                      <span className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={!!wf.is_active}
                          onChange={(e) => {
                            const next = e.currentTarget.checked;
                            setSavedWorkflows(prev => {
                              const updated = prev.map(w => w.id === wf.id ? { ...w, is_active: next, status: next ? 'ok' : 'inactive' } : w);
                              try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
                              return updated;
                            });
                          }}
                        />
                        <span className={`block w-9 h-5 rounded-full transition ${wf.is_active ? 'bg-green-600' : 'bg-slate-700'}`}></span>
                        <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${wf.is_active ? 'translate-x-4' : ''}`}></span>
                      </span>
                      {wf.is_active ? 'On' : 'Off'}
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => openRecipe({ title: wf.title, summary: wf.description, tools: wf.tools || [], setupTime: wf.setupTime || '', difficulty: wf.difficulty || '', formula: toFormulaString(wf), setupSteps: wf.setupSteps || [], copyZap: wf.copyZap || '', copyMake: wf.copyMake || '' })} className="px-3 py-1.5 bg-indigo-500 rounded-lg text-xs font-semibold text-white hover:bg-indigo-400 transition">Details</button>
                      <button onClick={() => window.open('/sandbox', '_self')} className="px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white hover:bg-blue-500 transition">Edit</button>
                      <button onClick={() => removeWorkflow(wf.id)} className="px-3 py-1.5 bg-slate-700 rounded-lg text-xs font-semibold text-white hover:bg-slate-600 transition">Remove</button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900 rounded-xl p-10 text-center">
              <div className="text-4xl mb-3 opacity-30">+</div>
              <p className="text-slate-400 text-lg font-medium mb-2">No saved workflows yet</p>
              <p className="text-slate-500 text-sm mb-4">Add recipes from the Library or build your own in the Sandbox.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setActiveTab('library')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 transition">Browse Library</button>
                <button onClick={() => window.open('/sandbox', '_self')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition">Open Sandbox</button>
              </div>
            </div>
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

      {/* REX Workflow Assistant FAB */}
      <button
        onClick={() => alert('REX Workflow Assistant coming soon! Ask REX to help you find the right workflow, build custom automations, or troubleshoot integrations.')}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl hover:scale-110 hover:shadow-2xl transition-all flex items-center justify-center text-2xl group"
        title="Ask REX for help"
      >
        <span className="group-hover:scale-110 transition-transform">&#x1F916;</span>
        <span className="absolute -top-2 -right-1 bg-emerald-500 text-[9px] text-white px-1.5 py-0.5 rounded-full font-bold">NEW</span>
      </button>

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


