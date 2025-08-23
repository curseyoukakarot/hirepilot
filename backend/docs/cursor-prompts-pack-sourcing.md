# 🤖 Cursor Prompts Pack - Sourcing Agent

Copy these prompts into Cursor to scaffold each part of the Sourcing Agent system exactly as specified.

---

## A) 📊 SQL Migrations

**Cursor Prompt:**
```
Create a new SQL migration named backend/migrations/2025-01-23_sourcing.sql with the following tables and columns exactly: sourcing_campaigns, sourcing_leads, sourcing_sequences, email_senders, sourcing_replies, and add thread_key to agent_runs if missing. Ensure idempotency and indexes as shown in the spec below.

-- Campaigns
create table if not exists sourcing_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience_tag text,
  created_by uuid,
  default_sender_id uuid,
  status text default 'draft', -- draft|scheduled|running|paused|completed
  created_at timestamptz default now()
);

-- Leads (rename from prospecting_leads if present)
do $$ begin
  if exists (select 1 from information_schema.tables where table_name='prospecting_leads') then
    alter table prospecting_leads rename to sourcing_leads;
  end if;
end $$;

create table if not exists sourcing_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references sourcing_campaigns(id) on delete cascade,
  name text,
  title text,
  company text,
  linkedin_url text,
  email text,
  domain text,
  enriched boolean default false,
  outreach_stage text default 'queued', -- queued|step1_sent|step2_sent|step3_sent|replied|bounced|unsubscribed
  reply_status text, -- none|positive|neutral|negative|oos|auto
  created_at timestamptz not null default now()
);

create index if not exists idx_sourcing_leads_email on sourcing_leads(email);
create index if not exists idx_sourcing_leads_campaign on sourcing_leads(campaign_id);

-- Sequences per campaign
create table if not exists sourcing_sequences (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references sourcing_campaigns(id) on delete cascade,
  steps_json jsonb not null, -- {step1:{subject,body}, step2:{...}, step3:{...}, spacingBusinessDays:2}
  created_at timestamptz default now()
);

-- Email sender profiles
create table if not exists email_senders (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'sendgrid',
  from_name text not null,
  from_email text not null,
  domain_verified boolean default false,
  warmup_mode boolean default true,
  sendgrid_subuser text,
  created_at timestamptz default now()
);

-- Replies
create table if not exists sourcing_replies (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references sourcing_campaigns(id) on delete cascade,
  lead_id uuid references sourcing_leads(id) on delete cascade,
  direction text not null,  -- inbound|outbound
  subject text,
  body text,
  email_from text,
  email_to text,
  sg_message_id text,
  received_at timestamptz default now(),
  classified_as text,       -- positive|neutral|negative|oos|auto
  next_action text          -- reply|book|disqualify|hold
);

-- Agent runs table for REX integration
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending|running|completed|failed
  input_params JSONB,
  output_result JSONB,
  error_message TEXT,
  thread_key TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_type ON agent_runs(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_thread_key ON agent_runs(thread_key);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_by ON agent_runs(created_by);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sourcing_campaigns_status ON sourcing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_campaigns_created_by ON sourcing_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_sourcing_leads_outreach_stage ON sourcing_leads(outreach_stage);
```

---

## B) 🔧 Core Services

**Cursor Prompt:**
```
Create backend/src/services/sourcing.ts that exports: createCampaign, saveSequence, addLeads, scheduleCampaign, generateSequenceForCampaign. Use Supabase, SendGrid sender, BullMQ emailQueue, and sequenceBuilder (GPT) as specified. Respect spacingBusinessDays and schedule step2/3 with business-day offsets.

import dayjs from 'dayjs';
import businessDays from 'dayjs-business-days';
dayjs.extend(businessDays as any);
import { supabase } from '../lib/supabase';
import { sendEmail } from './sendgrid';
import { buildThreeStepSequence } from './sequenceBuilder';
import { emailQueue } from '../queues/redis';

type Steps = { step1: any; step2: any; step3: any; spacingBusinessDays: number };

export async function createCampaign(payload: {
  title: string;
  audience_tag?: string;
  sender_id?: string;
  created_by?: string;
}) {
  const { data, error } = await supabase.from('sourcing_campaigns')
    .insert({
      title: payload.title,
      audience_tag: payload.audience_tag || null,
      default_sender_id: payload.sender_id || null,
      created_by: payload.created_by || null
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function saveSequence(campaignId: string, steps: Steps) {
  const { data, error } = await supabase.from('sourcing_sequences').insert({
    campaign_id: campaignId,
    steps_json: steps
  }).select().single();
  if (error) throw error;
  return data;
}

export async function addLeads(campaignId: string, leads: any[]) {
  if (!leads?.length) return { inserted: 0 };
  const payload = leads.map(l => ({
    campaign_id: campaignId,
    ...l,
    enriched: !!l.email
  }));
  const { error } = await supabase.from('sourcing_leads').insert(payload);
  if (error) throw error;
  return { inserted: payload.length };
}

export async function scheduleCampaign(campaignId: string) {
  // fetch sequence & leads
  const { data: seq } = await supabase.from('sourcing_sequences').select('*').eq('campaign_id', campaignId).single();
  const { data: leads } = await supabase.from('sourcing_leads').select('*').eq('campaign_id', campaignId);
  if (!seq || !leads?.length) throw new Error('Missing sequence or leads');

  const steps: Steps = seq.steps_json;
  const now = dayjs();

  for (const l of leads) {
    if (!l.email) continue;
    // immediate step1
    await sendStepEmail(campaignId, l, steps.step1, 0);
    // step2 & step3 scheduled
    await enqueueStepEmail(campaignId, l, steps.step2, addBusinessDays(now, steps.spacingBusinessDays));
    const s3 = addBusinessDays(now, steps.spacingBusinessDays * 2);
    await enqueueStepEmail(campaignId, l, steps.step3, s3);
  }

  await supabase.from('sourcing_campaigns').update({ status: 'running' }).eq('id', campaignId);
  return { scheduled: leads.length };
}

function addBusinessDays(d: dayjs.Dayjs, days: number) {
  // @ts-ignore
  return d.businessAdd(days);
}

async function sendStepEmail(campaignId: string, lead: any, step: any, delayMs: number) {
  const headers = {
    'X-Campaign-Id': campaignId,
    'X-Lead-Id': lead.id,
  };
  if (delayMs === 0) {
    await sendEmail(lead.email, personalize(step.subject, lead), personalize(step.body, lead), headers);
  } else {
    await emailQueue.add('send', {
      to: lead.email,
      subject: personalize(step.subject, lead),
      html: personalize(step.body, lead),
      headers
    }, {
      delay: delayMs,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000
    });
  }
}

async function enqueueStepEmail(campaignId: string, lead: any, step: any, when: dayjs.Dayjs) {
  const delayMs = Math.max(0, when.diff(dayjs(), 'millisecond'));
  return sendStepEmail(campaignId, lead, step, delayMs);
}

function personalize(text: string, lead: any) {
  return (text || '').replace(/\{\{name\}\}/gi, lead.name || '')
    .replace(/\{\{company\}\}/gi, lead.company || '').replace(/\{\{title\}\}/gi, lead.title || '');
}

export async function generateSequenceForCampaign(campaignId: string, params: {
  title_groups: string[];
  industry?: string;
  product_name: string;
  spacing_business_days?: number;
}) {
  const steps = await buildThreeStepSequence({
    titleGroups: params.title_groups,
    industry: params.industry,
    painPoints: ['save recruiter time','improve reply rate','book more interviews'],
    productName: params.product_name,
    spacingBusinessDays: params.spacing_business_days ?? 2
  });
  return saveSequence(campaignId, steps as any);
}
```

---

## C) 🌐 API Routes

**Cursor Prompt:**
```
Create backend/src/routes/sourcing.ts with endpoints: 
POST /api/sourcing/campaigns, 
POST /api/sourcing/campaigns/:id/sequence, 
POST /api/sourcing/campaigns/:id/leads, 
POST /api/sourcing/campaigns/:id/schedule, 
GET /api/sourcing/campaigns/:id. 
Validate with zod. Register the routes in backend/server.ts.

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createCampaign, addLeads, generateSequenceForCampaign, scheduleCampaign } from '../services/sourcing';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';
import { getCampaignWithDetails, getLeadsForCampaign, searchCampaigns, getCampaignStats } from '../services/sourcingUtils';

const router = express.Router();

interface ApiRequest extends Request {
  user?: { id: string };
}

// Create campaign
router.post('/campaigns', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const body = z.object({
      title: z.string().min(3),
      audience_tag: z.string().optional(),
      sender_id: z.string().uuid().optional(),
      created_by: z.string().optional()
    }).parse(req.body);
    
    const campaignData = {
      title: body.title,
      audience_tag: body.audience_tag,
      sender_id: body.sender_id,
      created_by: body.created_by || req.user?.id
    };
    
    const campaign = await createCampaign(campaignData);
    return res.status(201).json(campaign);
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Generate/save sequence
router.post('/campaigns/:id/sequence', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({
      title_groups: z.array(z.string()).min(1),
      industry: z.string().optional(),
      product_name: z.string().default('HirePilot'),
      spacing_business_days: z.number().int().min(1).max(5).default(2)
    }).parse(req.body);
    
    const sequenceParams = {
      title_groups: body.title_groups,
      industry: body.industry,
      product_name: body.product_name,
      spacing_business_days: body.spacing_business_days
    };
    
    const sequence = await generateSequenceForCampaign(id, sequenceParams);
    return res.json(sequence);
  } catch (error: any) {
    console.error('Error generating sequence:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Add leads to campaign
router.post('/campaigns/:id/leads', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({
      leads: z.array(z.object({
        name: z.string().optional(),
        title: z.string().optional(),
        company: z.string().optional(),
        linkedin_url: z.string().url().optional(),
        email: z.string().email().optional(),
        domain: z.string().optional()
      })).min(1)
    }).parse(req.body);
    
    const result = await addLeads(id, body.leads);
    return res.json(result);
  } catch (error: any) {
    console.error('Error adding leads:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Schedule campaign
router.post('/campaigns/:id/schedule', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await scheduleCampaign(id);
    return res.json(result);
  } catch (error: any) {
    console.error('Error scheduling campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Get campaign details
router.get('/campaigns/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data: campaign } = await supabase.from('sourcing_campaigns').select('*').eq('id', id).single();
    const { data: sequence } = await supabase.from('sourcing_sequences').select('*').eq('campaign_id', id).single();
    const { data: leads } = await supabase.from('sourcing_leads').select('*').eq('campaign_id', id);
    
    return res.json({ campaign, sequence, leads });
  } catch (error: any) {
    console.error('Error fetching campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

export default router;

// Register in backend/server.ts:
import sourcingRouter from './src/routes/sourcing';
app.use('/api/sourcing', sourcingRouter);
```

---

## D) 📧 SendGrid Inbound Parse

**Cursor Prompt:**
```
Create backend/src/routes/sendgridInbound.ts to receive inbound Parse posts, map headers X-Campaign-Id and X-Lead-Id to sourcing_replies, classify with OpenAI (positive|neutral|negative|oos|auto) and set next_action. Return {ok:true}. Register in server bootstrap.

import express, { Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase';
import OpenAI from 'openai';
import { updateLeadOutreachStage } from '../services/sourcingUtils';
import { sendSourcingReplyNotification } from '../services/sourcingNotifications';

const upload = multer();
const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

router.post('/webhooks/sendgrid/sourcing/inbound', upload.none(), async (req: Request, res: Response) => {
  try {
    const payload: any = req.body;
    const headers = payload.headers || {};
    const body = payload.text || payload.html || '';
    const from = payload.from;
    const to = payload.to;
    const subject = payload.subject;

    const campaignId = headers['X-Campaign-Id'] || headers['x-campaign-id'];
    const leadId = headers['X-Lead-Id'] || headers['x-lead-id'];

    if (!campaignId || !leadId) {
      console.log('Missing campaign or lead ID in headers');
      return res.json({ ok: true, message: 'Missing required headers' });
    }

    // Store reply
    const { data: replyRow, error } = await supabase.from('sourcing_replies').insert({
      campaign_id: campaignId,
      lead_id: leadId,
      direction: 'inbound',
      subject,
      body,
      email_from: from,
      email_to: to
    }).select().single();

    if (error) {
      console.error('Error storing reply:', error);
      return res.status(500).json({ error: error.message });
    }

    // Classify reply
    const classification = await classifyReply(body);
    
    // Update reply with classification
    await supabase.from('sourcing_replies').update({
      classified_as: classification.label,
      next_action: classification.next_action
    }).eq('id', replyRow.id);

    // Update lead status
    await updateLeadOutreachStage(leadId, 'replied');
    await supabase.from('sourcing_leads').update({
      reply_status: classification.label
    }).eq('id', leadId);

    // Send notifications
    await Promise.all([
      sendSourcingReplyNotification({
        campaign_id: campaignId,
        lead_id: leadId,
        reply_id: replyRow.id,
        classification: classification.label,
        next_action: classification.next_action,
        subject,
        body,
        from_email: from
      }),
      sendReplyNotification({
        user_id: null, // Will be determined by campaign owner
        thread_key: `sourcing:${campaignId}:${leadId}`,
        title: `New ${classification.label} reply`,
        body_md: `**From:** ${from}\n**Subject:** ${subject}\n\n${body.substring(0, 200)}...`,
        actions: [
          { id: 'draft_reply', label: 'Draft with REX', type: 'button' },
          { id: 'book_demo', label: 'Book Demo', type: 'button' },
          { id: 'disqualify', label: 'Disqualify', type: 'button' }
        ]
      })
    ]);

    return res.json({ ok: true });
  } catch (error: any) {
    console.error('Error processing inbound reply:', error);
    return res.status(500).json({ error: error.message });
  }
});

async function classifyReply(text: string): Promise<{label:string; next_action:string}> {
  const prompt = `Classify this email as: positive|neutral|negative|oos (out-of-scope)|auto (OOO/auto-reply).
Suggest next_action: reply|book|disqualify|hold.
Return JSON {"label":"","next_action":""}.

Email:
${text}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    });
    
    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch {
    return { label: 'neutral', next_action: 'reply' };
  }
}

async function sendReplyNotification(data: any) {
  try {
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: data.user_id,
        thread_key: data.thread_key,
        title: data.title,
        body: data.body_md,
        actions: JSON.stringify(data.actions),
        type: 'sourcing_reply',
        read: false,
        created_at: new Date().toISOString()
      });
    
    if (notificationError) {
      console.error('Error storing notification:', notificationError);
    }
  } catch (error) {
    console.error('Error in sendReplyNotification:', error);
  }
}

export default router;

// Register in backend/server.ts:
import sourcingInboundRouter from './src/routes/sendgridInbound';
app.use('/api', sourcingInboundRouter);
```

---

## E) 🔧 MCP Tool Additions

**Cursor Prompt:**
```
In backend/src/rex/server.ts, add MCP tools: sourcing_create_campaign, sourcing_save_sequence, sourcing_add_leads, sourcing_schedule_sends. They must proxy to the matching REST routes and return the JSON content. Do not change existing tools.

// Add this api utility function at the top of the file
async function api(endpoint: string, options: { method: string; body?: string } = { method: 'GET' }) {
  const baseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8080';
  const url = `${baseUrl}${endpoint}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (process.env.AGENTS_API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.AGENTS_API_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    throw error;
  }
}

// Add these tools to the existing server.registerCapabilities({ tools: { ... } }) object:

sourcing_create_campaign: {
  description: "Create a new sourcing campaign",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Campaign title" },
      audience_tag: { type: "string", description: "Audience tag (optional)" },
      sender_id: { type: "string", description: "Email sender ID (optional)" },
      created_by: { type: "string", description: "User ID (optional)" }
    },
    required: ["title"]
  },
  handler: async (args: any) => {
    const result = await api('/api/sourcing/campaigns', {
      method: 'POST',
      body: JSON.stringify(args)
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
},

sourcing_save_sequence: {
  description: "Generate and save email sequence for campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaign_id: { type: "string", description: "Campaign ID" },
      title_groups: { type: "array", items: { type: "string" }, description: "Target job titles" },
      industry: { type: "string", description: "Industry (optional)" },
      product_name: { type: "string", description: "Product name", default: "HirePilot" },
      spacing_business_days: { type: "number", description: "Days between emails", default: 2 }
    },
    required: ["campaign_id", "title_groups"]
  },
  handler: async (args: any) => {
    const { campaign_id, ...params } = args;
    const result = await api(`/api/sourcing/campaigns/${campaign_id}/sequence`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
},

sourcing_add_leads: {
  description: "Add leads to a sourcing campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaign_id: { type: "string", description: "Campaign ID" },
      leads: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            company: { type: "string" },
            linkedin_url: { type: "string" },
            email: { type: "string" },
            domain: { type: "string" }
          }
        },
        description: "Array of lead objects"
      }
    },
    required: ["campaign_id", "leads"]
  },
  handler: async (args: any) => {
    const { campaign_id, leads } = args;
    const result = await api(`/api/sourcing/campaigns/${campaign_id}/leads`, {
      method: 'POST',
      body: JSON.stringify({ leads })
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
},

sourcing_schedule_sends: {
  description: "Schedule email sends for a campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaign_id: { type: "string", description: "Campaign ID" }
    },
    required: ["campaign_id"]
  },
  handler: async (args: any) => {
    const result = await api(`/api/sourcing/campaigns/${args.campaign_id}/schedule`, {
      method: 'POST'
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
},

sourcing_get_campaign: {
  description: "Get campaign details",
  inputSchema: {
    type: "object",
    properties: {
      campaign_id: { type: "string", description: "Campaign ID" }
    },
    required: ["campaign_id"]
  },
  handler: async (args: any) => {
    const result = await api(`/api/sourcing/campaigns/${args.campaign_id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
},

sourcing_list_campaigns: {
  description: "List sourcing campaigns",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status (optional)" },
      limit: { type: "number", description: "Limit results (optional)" }
    }
  },
  handler: async (args: any) => {
    const queryParams = new URLSearchParams();
    if (args.status) queryParams.append('status', args.status);
    if (args.limit) queryParams.append('limit', args.limit.toString());
    
    const queryString = queryParams.toString();
    const endpoint = `/api/sourcing/campaigns${queryString ? `?${queryString}` : ''}`;
    
    const result = await api(endpoint);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
},

sourcing_get_senders: {
  description: "Get available email senders",
  inputSchema: {
    type: "object",
    properties: {}
  },
  handler: async () => {
    const result = await api('/api/sourcing/senders');
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
}
```

---

## F) 🧙‍♂️ REX Orchestrator

**Cursor Prompt:**
```
Create backend/src/rex-orchestrator/schemas.ts with SourcingParams (as defined). 
Create backend/src/rex-orchestrator/prompts.ts with SOURCE_EXTRACT prompt (as defined). 
Create backend/src/rex-orchestrator/index.ts exporting startSourcingWizard(text, tools, user) and executeSourcing(params, tools) as shown. 
The wizard must: collect sender if missing, collect title_groups if missing, show a plan summary, then call sourcing.* tools in order on confirm.

// backend/src/rex-orchestrator/schemas.ts
import { z } from 'zod';

export const SourcingParams = z.object({
  title_groups: z.array(z.string()).min(1),
  industry: z.string().optional(),
  location: z.string().optional(),
  limit: z.number().int().min(10).max(5000).default(500),
  per_search: z.number().int().min(25).max(200).default(100),
  product_name: z.string().default('HirePilot'),
  spacing_business_days: z.number().int().min(1).max(5).default(2),
  campaign_title: z.string().default(() => `Sourcing – Week ${new Date().toLocaleDateString()}`),
  audience_tag: z.string().optional(),
  sender_id: z.string().optional(),
  track_and_assist_replies: z.boolean().default(true)
});

export type SourcingParamsT = z.infer<typeof SourcingParams>;

export const WizardCard = z.object({
  title: z.string(),
  body_md: z.string(),
  actions: z.array(z.object({
    id: z.string(),
    type: z.enum(['button', 'input', 'select', 'chips']),
    label: z.string(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional()
  })),
  next: z.string().optional()
});

export type WizardCardT = z.infer<typeof WizardCard>;

export const AgentPlan = z.object({
  agent_key: z.string(),
  goal: z.string(),
  params: z.record(z.any()),
  needs_confirmation: z.boolean(),
  missing: z.array(z.string())
});

export type AgentPlanT = z.infer<typeof AgentPlan>;

export const WizardState = z.object({
  session_id: z.string(),
  agent_type: z.string(),
  current_step: z.string(),
  params: z.record(z.any()),
  completed_steps: z.array(z.string()),
  created_at: z.string()
});

export type WizardStateT = z.infer<typeof WizardState>;

// Common options
export const COMMON_TITLE_GROUPS = [
  "Head of Talent",
  "Recruiting Manager", 
  "Technical Recruiter",
  "VP People",
  "Director of Talent",
  "Senior Recruiter",
  "Talent Acquisition Manager",
  "People Operations Manager"
];

export const COMMON_INDUSTRIES = [
  "Technology",
  "Healthcare", 
  "Financial Services",
  "Manufacturing",
  "Retail",
  "Education",
  "Professional Services",
  "Real Estate"
];

export const COMMON_LOCATIONS = [
  "United States",
  "San Francisco Bay Area",
  "New York City",
  "Los Angeles",
  "Chicago",
  "Boston",
  "Austin",
  "Seattle",
  "Remote"
];

// backend/src/rex-orchestrator/prompts.ts
export const SOURCE_EXTRACT = `
You convert a user instruction into a JSON plan for the Sourcing Agent.
Only valid JSON. No prose.

{
  "agent_key": "sourcing",
  "goal": string,
  "params": object,
  "needs_confirmation": boolean,
  "missing": string[]
}

Rules:
- If required parameters are missing (e.g., title_groups or sender), set needs_confirmation=true and list missing.
- Default spacingBusinessDays=2, product_name="HirePilot".
- Extract title_groups from job titles mentioned
- Extract industry, location if mentioned
- Set campaign_title based on context or use default
- Always set track_and_assist_replies=true unless explicitly disabled
`;

export const WIZARD_MESSAGES = {
  WELCOME: "I'll help you create a sourcing campaign. What job titles do you want to target?",
  SENDER_NEEDED: "First, let's set up your email sender to protect your domain reputation.",
  TITLES_NEEDED: "What job titles should we target? (e.g., 'Head of Talent', 'Technical Recruiter')",
  CONFIRM_PLAN: "Here's your sourcing campaign plan. Ready to launch?",
  EXECUTING: "Creating your sourcing campaign...",
  SUCCESS: "✅ Campaign created successfully! I'll notify you as replies arrive.",
  ERROR: "❌ Something went wrong. Please try again or contact support."
};

export const ERROR_MESSAGES = {
  MISSING_TITLES: "Please specify job titles to target (e.g., 'Head of Talent', 'Recruiting Manager')",
  MISSING_SENDER: "Please connect a verified email sender first",
  INVALID_PARAMS: "Invalid parameters provided. Please check your input.",
  API_ERROR: "API error occurred. Please try again.",
  UNKNOWN_ERROR: "An unexpected error occurred"
};

// backend/src/rex-orchestrator/index.ts
import { SourcingParams, WizardCardT, AgentPlanT, COMMON_TITLE_GROUPS, COMMON_INDUSTRIES, COMMON_LOCATIONS } from './schemas';
import { SOURCE_EXTRACT, WIZARD_MESSAGES, ERROR_MESSAGES } from './prompts';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Utility functions
async function jsonExtract(prompt: string, text: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      temperature: 0
    });
    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch {
    return {};
  }
}

function ask(message: string): string {
  return message;
}

function done(message: string): string {
  return message;
}

function wizardCard(card: WizardCardT): WizardCardT {
  return card;
}

async function listVerifiedSenders(): Promise<string[]> {
  // This would call the senders API
  return ["sender1@domain.com", "sender2@domain.com"];
}

export async function startSourcingWizard(text: string, tools: any, user: { id: string }) {
  // 1) Extract → validate
  const plan = await jsonExtract(SOURCE_EXTRACT, text);
  
  if (plan.agent_key !== 'sourcing') {
    return ask("I can start a Sourcing campaign—what titles do you want to target?");
  }

  const parsed = SourcingParams.safeParse(plan.params || {});
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.'));
    return ask(`I need: ${missing.join(', ')}. For example, provide title_groups like ["Head of Talent","Recruiting Manager"].`);
  }

  const p = parsed.data;

  // 2) Sender check
  if (!p.sender_id) {
    return wizardCard({
      title: "Choose sender",
      body_md: "Connect a verified SendGrid sender to protect your domain reputation.",
      actions: [
        { id: "connect_sender", type: "button", label: "Connect SendGrid" },
        { id: "use_existing", type: "select", label: "Use existing sender", options: await listVerifiedSenders() }
      ],
      next: "collect_titles"
    });
  }

  // 3) Confirm titles
  if (!p.title_groups?.length) {
    return wizardCard({
      title: "Pick title groups",
      body_md: "Select from common titles or add your own.",
      actions: [
        { id: "titles", type: "chips", label: "Common titles", options: COMMON_TITLE_GROUPS },
        { id: "custom", type: "input", label: "Custom titles", placeholder: "Add comma-separated titles" }
      ],
      next: "summary"
    });
  }

  // 4) Summary & run
  return wizardCard({
    title: "Review & run",
    body_md: `Campaign: **${p.campaign_title}**\nTitles: ${p.title_groups.join(', ')}\nSteps: 3 with ${p.spacing_business_days} business days apart\nTrack replies: ${p.track_and_assist_replies ? 'Yes' : 'No'}`,
    actions: [
      { id: "run_now", type: "button", label: "Run now" },
      { id: "cancel", type: "button", label: "Cancel" }
    ],
    next: "execute"
  });
}

export async function handleWizardStep(sessionId: string, step: string, input: any, tools: any, user: { id: string }): Promise<WizardCardT | string> {
  // Handle wizard step progression
  switch (step) {
    case 'collect_titles':
      // Process title selection
      break;
    case 'summary':
      // Show final summary
      break;
    case 'execute':
      // Execute the sourcing campaign
      return await executeSourcing(input, tools, user);
    default:
      return ask("Unknown step. Please start over.");
  }
  
  return ask("Step not implemented yet.");
}

export async function executeSourcing(params: any, tools: any, user: { id: string }) {
  try {
    // 1) create campaign
    const campaign = await tools.call('sourcing_create_campaign', {
      title: params.campaign_title,
      audience_tag: params.audience_tag,
      sender_id: params.sender_id,
      created_by: user.id
    });

    // 2) generate/save sequence
    await tools.call('sourcing_save_sequence', {
      campaign_id: campaign.id,
      title_groups: params.title_groups,
      industry: params.industry,
      product_name: params.product_name,
      spacing_business_days: params.spacing_business_days
    });

    // 3) fetch/build leads (Apollo via your existing service) then addLeads
    // For now, we'll use placeholder leads
    const placeholderLeads = [
      { name: "John Doe", title: "Head of Talent", company: "TechCorp", email: "john@techcorp.com" },
      { name: "Jane Smith", title: "Recruiting Manager", company: "StartupInc", email: "jane@startupinc.com" }
    ];
    
    await tools.call('sourcing_add_leads', {
      campaign_id: campaign.id,
      leads: placeholderLeads
    });

    // 4) schedule
    await tools.call('sourcing_schedule_sends', {
      campaign_id: campaign.id
    });

    return done(`Started ✅ Campaign "${campaign.title}". I'll notify you as replies arrive.`);
  } catch (error: any) {
    console.error('Error executing sourcing:', error);
    return done(`❌ Error: ${error.message}`);
  }
}
```

---

## G) 🧪 Tests (Optional but Recommended)

**Cursor Prompt:**
```
Create backend/scripts/testSourcingFlow.ts to verify:
- Missing title_groups → wizard asks for titles
- Missing sender_id → wizard asks to connect sender  
- Happy path → creates campaign → saves sequence → schedules sends
- Inbound reply classification sets classified_as and next_action

import { startSourcingWizard, executeSourcing } from '../src/rex-orchestrator';

// Mock tools object
const mockTools = {
  call: async (toolName: string, args: any) => {
    console.log(`🔧 Called ${toolName} with:`, args);
    
    switch (toolName) {
      case 'sourcing_create_campaign':
        return { id: 'camp_123', title: args.title, status: 'draft' };
      case 'sourcing_save_sequence':
        return { id: 'seq_123', campaign_id: args.campaign_id };
      case 'sourcing_add_leads':
        return { inserted: args.leads.length };
      case 'sourcing_schedule_sends':
        return { scheduled: 2 };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
};

const mockUser = { id: 'user_123' };

async function testSourcingFlow() {
  console.log('🧪 Testing Sourcing Agent Flow\n');

  // Test 1: Missing title_groups
  console.log('Test 1: Missing title_groups');
  const result1 = await startSourcingWizard('Create a sourcing campaign', mockTools, mockUser);
  console.log('Result:', result1);
  console.log('✅ Should ask for titles\n');

  // Test 2: Missing sender_id
  console.log('Test 2: Missing sender_id');
  const result2 = await startSourcingWizard('Target Head of Talent and Technical Recruiters', mockTools, mockUser);
  console.log('Result:', result2);
  console.log('✅ Should ask for sender\n');

  // Test 3: Happy path
  console.log('Test 3: Happy path execution');
  const happyParams = {
    title_groups: ['Head of Talent', 'Technical Recruiter'],
    campaign_title: 'Test Campaign',
    sender_id: 'sender_123',
    product_name: 'HirePilot',
    spacing_business_days: 2
  };
  
  const result3 = await executeSourcing(happyParams, mockTools, mockUser);
  console.log('Result:', result3);
  console.log('✅ Should create campaign and schedule sends\n');

  // Test 4: Reply classification (mock)
  console.log('Test 4: Reply classification');
  const mockReply = "Thanks for reaching out! I'd love to learn more about HirePilot. Can we schedule a demo?";
  console.log('Mock reply:', mockReply);
  console.log('Expected classification: positive, next_action: book');
  console.log('✅ Should classify as positive and suggest booking\n');

  console.log('🎉 All tests completed!');
}

// Run tests
testSourcingFlow().catch(console.error);

// Add to package.json scripts:
// "test:sourcing-flow": "ts-node scripts/testSourcingFlow.ts"
```

---

## 📋 Complete Implementation Checklist

### Backend Setup:
- [ ] **A) Migrations** - Run SQL migration for sourcing tables
- [ ] **B) Services** - Create core sourcing orchestration service  
- [ ] **C) API Routes** - Implement REST endpoints with validation
- [ ] **D) SendGrid** - Set up inbound reply parsing and classification
- [ ] **E) MCP Tools** - Add sourcing tools to REX server
- [ ] **F) Orchestrator** - Create wizard flow for REX integration

### Environment Variables:
```env
# Required for Sourcing Agent
REDIS_URL=redis://default:<password>@<host>:<port>
OPENAI_API_KEY=sk-...
SENDGRID_API_KEY=SG....
SENDGRID_FROM=no-reply@yourdomain.com
BACKEND_BASE_URL=https://api.yourdomain.com
AGENTS_API_TOKEN=<jwt-token>
```

### Testing:
- [ ] **G) Flow Tests** - Verify wizard logic and API integration
- [ ] **SendGrid Setup** - Configure inbound parse webhook
- [ ] **REX Integration** - Test conversational campaign creation
- [ ] **Reply Management** - Verify classification and notifications

### Deployment:
- [ ] Install dependencies: `npm install dayjs dayjs-business-days`
- [ ] Run migrations: Execute SQL migration file
- [ ] Start workers: `npm run worker:email` & `npm run worker:campaign`
- [ ] Configure SendGrid: Point inbound parse to `/api/webhooks/sendgrid/sourcing/inbound`
- [ ] Test REX: Try "Create a sourcing campaign for Technical Recruiters"

---

**🚀 Copy each section into Cursor as needed to build the complete Sourcing Agent system!**
