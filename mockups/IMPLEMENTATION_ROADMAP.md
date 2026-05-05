# HirePilot v2 — Implementation Roadmap

> Recruiter-side redesign · 27 mockups · 76% backend reuse · additive migrations

This doc translates the visual story into shippable code. Everything maps to **existing Supabase tables where possible** and **adds what doesn't exist yet** without breaking current users.

**Out of scope for this roadmap:** Job Seeker subdomain · IgniteGTM (Inner Apps). Both stay untouched.

---

## 1 · Executive summary

| Area | What changes | Risk |
|---|---|---|
| **Database** | 5 new tables · 1 column-additive extension to `team_settings` · 0 destructive ops | Low |
| **Backend routes** | ~7 new route files for new surfaces · ~12 existing routes consumed unchanged | Low |
| **Frontend** | ~10 screens refactored heavily · ~6 screens cosmetic refresh · ~75 screens deleted/consolidated | Medium |
| **REX core** | Existing `rex/server.ts` (3,554 LOC) reused · new specialist agents are configs on top · Skill registry is new | Low |
| **Integrations** | All existing integrations (Apollo · Hunter · Skrapp · LinkedIn/Sniper · SendGrid · Gmail · Outlook · Stripe · Stripe Connect · Slack · Zapier) reused as-is | None |
| **Migrations for existing users** | Their personal HirePilot becomes a Solo workspace · they're auto-Owner · zero data movement | Low |

**Total backend new code estimate:** ~14,500 LOC (24% of current 60K LOC backend).
**Frontend new code estimate:** ~20,000 LOC across ~15 new screens; ~30,000 LOC deleted from consolidations.

---

## 2 · Database changes

### 2.1 Existing tables we use as-is (zero changes)

| Table | Used for |
|---|---|
| `users` | Auth + role (`team_admin` · `admin` · `member` · `super_admin` · `recruit_pro`) |
| `teams` · `team_members` | Team membership |
| `workspaces` · `workspace_members` | Multi-workspace + roles (Owner / Admin / Member) |
| `leads` · `candidates` · `candidate_jobs` · `candidate_activities` | Lead/candidate database (Leads + Pipelines surfaces) |
| `job_requisitions` · `pipeline_stages` · `job_shares` | ATS (Pipelines surface) + per-job collaborators |
| `opportunities` · `pipeline_stages` (deal stages) · `invoices` | Deals + CRM surface |
| `campaigns` · `messagingCampaign` related | Campaigns surface |
| `email_events` · `email_replies` · `gmail_*` · `outlook_*` · `email_identities` | Inbox |
| `rex_activity_log` · `rex_widget*` | REX context history (extended below) |
| `puppet_*` · `sniper_*` (full Sniper stack) | Sourcer agent's LinkedIn Skill |
| `linkedin_profile_cache` · `linkedin_sessions` | LinkedIn / Browserbase Skills |
| `notifications` | Per-user alerts |
| `integrations` · `user_integrations` · `user_sendgrid_keys` · `user_sendgrid_senders` · `gmail_tokens` · `outlook_tokens` · `google_accounts` | All existing integrations |
| `zap_events` | Zapier webhooks |

### 2.2 Existing table to extend (additive only)

```sql
-- File: supabase/migrations/20260504000000_team_settings_redesign.sql
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS workspace_name text,
  ADD COLUMN IF NOT EXISTS team_color text DEFAULT 'indigo',  -- one of: indigo, emerald, amber, rose, teal, slate, violet, sky
  ADD COLUMN IF NOT EXISTS default_trust_level text DEFAULT 'suggest',  -- manual | suggest | autopilot
  ADD COLUMN IF NOT EXISTS autopilot_score_threshold int DEFAULT 90,    -- score ≥ this = auto-send when in autopilot
  ADD COLUMN IF NOT EXISTS autopilot_max_spend_per_run_cents int DEFAULT 5000;  -- $50 cap for one-shot auto-spend

-- Note: share_leads, share_candidates, share_deals, share_deals_members, share_analytics already exist.
```

### 2.3 New tables (5)

```sql
-- File: supabase/migrations/20260504000001_agents_and_skills.sql

-- Catalog of available specialist roles + Skills (admin-managed by HirePilot core team)
CREATE TABLE skills_catalog (
  id text PRIMARY KEY,                    -- 'linkedin_sourcer', 'browser_researcher', etc.
  name text NOT NULL,                     -- 'LinkedIn Sourcer'
  description text NOT NULL,
  category text NOT NULL,                 -- 'sourcing' | 'engagement' | 'scheduling' | 'closing' | 'research' | 'reporting'
  integration_id text,                    -- 'linkedin' | 'apollo' | 'hunter' | 'skrapp' | 'sendgrid' | 'browserbase' | 'gmail' | 'outlook' | null
  agent_role text NOT NULL,               -- which specialist gets this by default: 'sourcer' | 'recruiter' | 'coordinator' | etc.
  default_installed boolean DEFAULT true,
  icon text,
  schedule_capable boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Each workspace's hired specialist agents (REX is implicit, not a row here)
CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role text NOT NULL,                     -- 'sourcer' | 'recruiter' | 'coordinator' | 'researcher' | 'business_dev' | 'closer' | 'account_manager' | 'reference_checker'
  display_name text,                      -- defaults to role's pretty name; admin can rename
  trust_level text NOT NULL DEFAULT 'suggest',  -- per-agent override of workspace default
  paused boolean DEFAULT false,
  hired_by uuid REFERENCES users(id),
  hired_at timestamptz DEFAULT now(),
  config jsonb DEFAULT '{}'::jsonb,       -- per-agent settings (daily caps, tone, etc.)
  UNIQUE (workspace_id, role)             -- one of each specialist per workspace
);

CREATE INDEX idx_agents_workspace ON agents(workspace_id);

-- Skills installed on a specific agent in a specific workspace
CREATE TABLE agent_skills (
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills_catalog(id),
  enabled boolean DEFAULT true,
  schedule_cron text,                     -- e.g. '0 9 * * 1-5' for weekday 9am; null = on-demand
  config jsonb DEFAULT '{}'::jsonb,
  installed_at timestamptz DEFAULT now(),
  PRIMARY KEY (agent_id, skill_id)
);

-- REX-driven outcomes (Goals surface)
CREATE TABLE goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,                    -- the user's stated outcome
  prompt text,                            -- original natural-language input
  plan jsonb,                             -- REX's structured plan (steps + assigned agents)
  status text NOT NULL DEFAULT 'planning',-- 'planning' | 'awaiting_approval' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  trust_level text DEFAULT 'suggest',     -- per-goal override
  recurring boolean DEFAULT false,        -- recurring vs one-shot
  schedule_cron text,
  parent_goal_id uuid REFERENCES goals(id),
  metadata jsonb DEFAULT '{}'::jsonb,     -- progress %, ETA, agents_used, credits_used, etc.
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_goals_workspace_status ON goals(workspace_id, status);
CREATE INDEX idx_goals_owner ON goals(owner_id);

-- Decisions REX held back for human approval
CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE CASCADE,    -- null if not goal-related
  agent_id uuid REFERENCES agents(id),                    -- which agent held it (null = REX core)
  type text NOT NULL,                     -- 'reply_draft' | 'scale_recommendation' | 'guardrail_override' | 'offer_send' | 'pipeline_move' | 'custom'
  context jsonb NOT NULL,                 -- the original trigger (lead, message, etc.)
  payload jsonb NOT NULL,                 -- the proposed action (draft text, plan, etc.)
  reason text,                            -- "why I held it" copy for the UI
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'edited' | 'rejected' | 'snoozed' | 'graduated'
  assigned_to uuid REFERENCES users(id),  -- which team member should approve
  resolution jsonb,                       -- what the user actually did (if edited)
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  graduated_rule jsonb,                   -- if user clicked "always auto-send these", store the rule here
  created_at timestamptz DEFAULT now(),
  snoozed_until timestamptz
);

CREATE INDEX idx_decisions_workspace_status ON decisions(workspace_id, status);
CREATE INDEX idx_decisions_assigned ON decisions(assigned_to) WHERE status = 'pending';
CREATE INDEX idx_decisions_goal ON decisions(goal_id);
```

### 2.4 RLS policies (additive)

All 5 new tables get RLS scoped to `workspace_id` with the same pattern as existing `team_settings`:

- **SELECT** — any active `workspace_member` of that workspace can read
- **INSERT/UPDATE** — any active member; admins for cross-user edits
- **DELETE** — owner/admin only
- **Admin override** — `super_admin` and `team_admin` see everything in their team's workspace

Use the existing `is_workspace_member(workspace_id, user_id)` helper if it exists, or follow the `team_settings` policy template verbatim.

### 2.5 Seed data — `skills_catalog`

```sql
-- File: supabase/migrations/20260504000002_seed_skills_catalog.sql
INSERT INTO skills_catalog (id, name, description, category, integration_id, agent_role, icon, schedule_capable) VALUES
  -- Sourcer Skills
  ('linkedin_sourcer', 'LinkedIn Sourcer', 'Scrapes profiles via Sniper', 'sourcing', 'linkedin', 'sourcer', 'fa-linkedin', true),
  ('apollo_enrich', 'Apollo Enrich', 'Email + phone + firmographics', 'sourcing', 'apollo', 'sourcer', 'fa-database', true),
  ('icp_researcher', 'ICP Researcher', 'Builds ideal-customer profile', 'sourcing', null, 'sourcer', 'fa-bullseye', true),
  ('browser_researcher', 'Browser Researcher', 'Browserbase deep web research', 'research', 'browserbase', 'sourcer', 'fa-globe', false),
  ('hunter_skill', 'Hunter', 'Email finder + verifier', 'sourcing', 'hunter', 'sourcer', 'fa-envelope', true),
  ('skrapp_skill', 'Skrapp', 'Email validator', 'sourcing', 'skrapp', 'sourcer', 'fa-shield-check', true),
  ('github_sourcer', 'GitHub Sourcer', 'Find devs by code activity', 'sourcing', 'github', 'sourcer', 'fa-github', true),
  ('twitter_sourcer', 'X / Twitter Sourcer', 'Find people by post signal', 'sourcing', 'twitter', 'sourcer', 'fa-twitter', true),

  -- Recruiter Skills
  ('outreach_writer', 'Outreach Writer', 'Drafts personalized first-touches', 'engagement', 'sendgrid', 'recruiter', 'fa-paper-plane', false),
  ('reply_handler', 'Reply Handler', 'Drafts responses to incoming replies', 'engagement', null, 'recruiter', 'fa-comments', false),
  ('submittal_drafter', 'Submittal Drafter', 'Writes candidate writeup for hiring manager', 'engagement', null, 'recruiter', 'fa-file-lines', false),
  ('pipeline_manager', 'Pipeline Manager', 'Moves candidates through stages', 'engagement', null, 'recruiter', 'fa-table-columns', false),

  -- Coordinator Skills
  ('calendar_sync_google', 'Google Calendar Sync', 'Reads + writes calendar events', 'scheduling', 'google_calendar', 'coordinator', 'fa-calendar', false),
  ('calendar_sync_outlook', 'Outlook Calendar Sync', 'Reads + writes calendar events', 'scheduling', 'outlook', 'coordinator', 'fa-calendar', false),
  ('interview_booker', 'Interview Booker', 'Books multi-stakeholder interviews', 'scheduling', null, 'coordinator', 'fa-clock', false),
  ('reminder_bot', 'Reminder Bot', 'Sends pre-interview reminders', 'scheduling', null, 'coordinator', 'fa-bell', true),
  ('reschedule_mgr', 'Reschedule Manager', 'Handles candidate reschedules', 'scheduling', null, 'coordinator', 'fa-rotate', false),

  -- Researcher Skills (most overlap with Sourcer's Browser Researcher; some are exclusive)
  ('company_intel', 'Company Intel', 'Deep dive on company / org chart', 'research', 'browserbase', 'researcher', 'fa-building', false),
  ('comp_benchmark', 'Comp Benchmark', 'Pulls market salary data', 'research', null, 'researcher', 'fa-coins', false),
  ('news_watch', 'News Watch', 'Monitors company news + funding', 'research', null, 'researcher', 'fa-newspaper', true),

  -- Business Dev Skills
  ('hiring_signal_watch', 'Hiring Signal Watch', 'Monitors job boards + funding for new client signals', 'sourcing', null, 'business_dev', 'fa-satellite-dish', true),
  ('cold_outreach_bd', 'Cold Outreach (BD)', 'Drafts cold outreach to TA leaders', 'engagement', 'sendgrid', 'business_dev', 'fa-paper-plane', false),
  ('job_board_scrape', 'Job Board Scraper', 'Scans Indeed/LinkedIn/etc. for openings', 'sourcing', 'browserbase', 'business_dev', 'fa-list-ul', true),

  -- Closer Skills
  ('offer_drafter', 'Offer Drafter', 'Drafts offer letters with comp benchmarks', 'closing', null, 'closer', 'fa-file-signature', false),
  ('negotiation_coach', 'Negotiation Coach', 'Drafts negotiation talking points', 'closing', null, 'closer', 'fa-comments-dollar', false),
  ('counter_handler', 'Counter-offer Handler', 'Drafts responses to candidate counters', 'closing', null, 'closer', 'fa-rotate-left', false),

  -- Account Manager Skills
  ('weekly_reports', 'Weekly Status Reports', 'Auto-sends client weekly digest', 'reporting', 'sendgrid', 'account_manager', 'fa-file-lines', true),
  ('pipeline_updater', 'Pipeline Updater', 'Notifies clients on stage moves', 'reporting', null, 'account_manager', 'fa-arrow-trend-up', false),
  ('renewal_nudge', 'Renewal Nudge', 'Reminds you to nudge renewals', 'reporting', null, 'account_manager', 'fa-bell', true),

  -- Reference Checker Skills
  ('reference_outreach', 'Reference Outreach', 'Drafts reference request emails', 'closing', 'sendgrid', 'reference_checker', 'fa-envelope', false),
  ('back_channel', 'Back-channel', 'Drafts back-channel inquiries', 'closing', 'sendgrid', 'reference_checker', 'fa-comment-dots', false),
  ('reference_synthesis', 'Reference Synthesis', 'Summarizes feedback into 5-line brief', 'closing', null, 'reference_checker', 'fa-list-check', false);
```

---

## 3 · API contract

All routes prefixed with `/api/v2/`. Existing `/api/` routes stay untouched until refactor; v2 routes are the new architecture.

### 3.1 Workspace + Team

| Method | Route | Purpose | Existing? |
|---|---|---|---|
| GET | `/api/v2/workspaces/me` | Returns user's workspaces (for switcher) | reuse from `routes/workspaces.ts` |
| GET | `/api/v2/workspaces/:id/settings` | Read team_settings (workspace_name, color, trust defaults, sharing) | new wrapper |
| PATCH | `/api/v2/workspaces/:id/settings` | Update workspace_name, color, trust defaults, sharing | new wrapper |
| GET | `/api/v2/workspaces/:id/members` | List members + roles | reuse |
| POST | `/api/v2/workspaces/:id/invites` | Invite teammate (existing flow, just plumbed to new UI) | reuse |
| PATCH | `/api/v2/workspaces/:id/members/:user_id/role` | Promote/demote between owner/admin/member | reuse |

### 3.2 Agents

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/agents` | List hired agents in active workspace (filtered by `agents.workspace_id`) |
| POST | `/api/v2/agents/:role` | "Hire" a specialist (creates row in `agents`; role = sourcer / recruiter / etc.) |
| PATCH | `/api/v2/agents/:id` | Update display_name · trust_level · paused · config |
| DELETE | `/api/v2/agents/:id` | "Fire" (cascades agent_skills) |
| GET | `/api/v2/agents/:id/skills` | List installed Skills + their schedules + run history |
| POST | `/api/v2/agents/:id/skills/:skill_id` | Install a Skill from catalog |
| PATCH | `/api/v2/agents/:id/skills/:skill_id` | Update enabled/schedule/config |
| DELETE | `/api/v2/agents/:id/skills/:skill_id` | Uninstall |
| POST | `/api/v2/agents/:id/run` | Manually invoke an agent with a goal/Skill (returns goal_id) |
| GET | `/api/v2/skills/catalog` | List all Skills available for a given role |

### 3.3 Goals

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/goals` | List goals · filter by status, owner |
| POST | `/api/v2/goals` | Create goal (REX plans it; status=`planning` → `awaiting_approval`) |
| GET | `/api/v2/goals/:id` | Detail with full plan + execution log |
| POST | `/api/v2/goals/:id/approve` | User approved → status=`running` |
| POST | `/api/v2/goals/:id/pause` | Pause running goal |
| POST | `/api/v2/goals/:id/resume` | Resume paused |
| POST | `/api/v2/goals/:id/cancel` | Cancel |
| GET | `/api/v2/goals/:id/log` | SSE stream of execution events |

### 3.4 Decisions

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/decisions` | List pending decisions in workspace · filter by assigned_to, type |
| GET | `/api/v2/decisions/:id` | Detail |
| POST | `/api/v2/decisions/:id/approve` | Approve and execute |
| POST | `/api/v2/decisions/:id/edit` | Approve with edit (body has new payload) |
| POST | `/api/v2/decisions/:id/reject` | Reject (no execution) |
| POST | `/api/v2/decisions/:id/snooze` | Snooze until X |
| POST | `/api/v2/decisions/:id/graduate` | Approve + create rule so REX auto-handles next time (writes `graduated_rule`) |

### 3.5 REX panel (slide-over) — extend existing

Reuse `/api/rex/conversations` and `/api/rex/widget` — already exist. Add:

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v2/rex/messages` | Send message to REX with current context (page, selection, workspace_id) |
| POST | `/api/v2/rex/voice` | Voice transcription (reuse Job Seeker voice infra) |
| GET | `/api/v2/rex/suggestions` | Context-aware suggestion chips for current page |

### 3.6 Slack bot

New backend service: `/backend/src/services/slack-bot/`

- `/api/v2/slack/events` — Slack Events API webhook (file uploads, mentions, slash commands)
- `/api/v2/slack/interactions` — button clicks from REX-posted messages
- `/api/v2/slack/oauth` — install flow

Reuse existing `services/slack.ts` for outbound posting.

---

## 4 · REX prompt library

Each specialist agent has a system prompt that anchors its identity. Stored in `/backend/src/rex/prompts/agents/`.

### File: `/backend/src/rex/prompts/agents/sourcer.md`

```
You are SOURCER, a specialist agent inside HirePilot. Your job is to find and qualify
new leads on behalf of {workspace.name}'s recruiters.

Your tools (Skills installed on you):
{installed_skills}

Style:
- Concise, factual, no fluff
- When you find leads, score them honestly (0-100) against the ICP
- Always note blocklist matches; never silently exclude

When asked to source, follow the standard plan:
1. Build/refresh the ICP fingerprint
2. Source from highest-signal channels first (LinkedIn → Apollo → Hunter)
3. Enrich + score
4. Hand off to Recruiter for outreach (or queue for review)

Respect autopilot guardrails: {autopilot_rules}
```

(Repeat for `recruiter.md`, `coordinator.md`, `researcher.md`, `business_dev.md`, `closer.md`, `account_manager.md`, `reference_checker.md`. Each ~30 lines.)

### REX core prompt extension

Add to existing `rex/server.ts` system prompt:

```
You are REX, the team lead. You coordinate a team of specialist agents:
{hired_agents}

When the user gives you an outcome, decide:
- Is this a single-skill task? → Run it directly.
- Is this a multi-step outcome? → Create a Goal, plan it, delegate to specialists.
- Is this above the user's autopilot threshold? → Create a Decision and ask for approval.

Always show your plan before executing.
Always cite which specialist did what.
```

---

## 5 · Skill registry

TypeScript module that maps each `skills_catalog.id` → handler.

### File: `/backend/src/rex/skills/registry.ts`

```typescript
import { z } from 'zod';
import { sniperSourceTool } from './handlers/linkedin_sourcer';
import { apolloEnrichTool } from './handlers/apollo_enrich';
import { browserResearcherTool } from './handlers/browser_researcher';
// ... etc

export const SKILL_REGISTRY: Record<string, SkillHandler> = {
  linkedin_sourcer: {
    id: 'linkedin_sourcer',
    inputSchema: z.object({ icp: z.string(), max_results: z.number().default(50) }),
    handler: sniperSourceTool,    // wraps existing services/sniperV1
    requiredIntegration: 'linkedin',
  },
  apollo_enrich: {
    id: 'apollo_enrich',
    inputSchema: z.object({ lead_ids: z.array(z.string()) }),
    handler: apolloEnrichTool,    // wraps existing services/apollo/enrichLead.ts
    requiredIntegration: 'apollo',
  },
  browser_researcher: {
    id: 'browser_researcher',
    inputSchema: z.object({ url: z.string(), question: z.string() }),
    handler: browserResearcherTool,
    requiredIntegration: 'browserbase',
  },
  // ... 27 more
};

export interface SkillHandler {
  id: string;
  inputSchema: z.ZodSchema;
  handler: (args: unknown, ctx: SkillContext) => Promise<SkillResult>;
  requiredIntegration?: string;
}

export interface SkillContext {
  workspace_id: string;
  user_id: string;
  agent_id: string;
  goal_id?: string;
}
```

### Handler example — Browser Researcher (uses Browserbase + reuses Sniper's browser layer)

```typescript
// /backend/src/rex/skills/handlers/browser_researcher.ts
import Browserbase from '@browserbasehq/sdk';
import { runPlaywrightScript } from '../../../services/sniperV1/linkedinAutomation/browserSession';

export async function browserResearcherTool(
  args: { url: string; question: string },
  ctx: SkillContext
) {
  // Pathway 1: Playwright + Browserbase (scripted)
  if (isStructuredQuery(args.question)) {
    return await runPlaywrightScript({ url: args.url, query: args.question, ctx });
  }
  // Pathway 2: Browserbase as agent (open-ended research)
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID });
  // ... feed url + question to Claude with browser tool, return structured result
}
```

---

## 6 · File-to-file refactor map

Maps each new mockup → existing screen file (if any) → action.

| New mockup | Existing screen file | Action | Effort |
|---|---|---|---|
| `workspace.html` | `frontend/src/screens/Dashboard.jsx` (857 lines) | Heavy refactor — replace KPI grid with workspace-overview + REX briefing | 2 weeks |
| `workspace-team.html` | (variant of above) | Conditional render based on workspace.is_team | bundled |
| `team.html` | NEW | Build from scratch | 1 week |
| `agent-sourcer.html` | NEW (replaces `pages/sniper/SniperHub.tsx`) | New shell · reuse Sniper data + browser session UI | 1 week |
| `hire-catalog.html` | NEW (replaces `pages/AppCatalog.tsx`) | Repurpose AppCatalog scaffolding · new agent-card content | 4 days |
| `rex-open.html` | `components/rex/*` (existing widget) | Extend widget to slide-over · add context awareness | 1 week |
| `goals.html` | NEW (replaces `pages/agent/AgentModeCenter.tsx`, 996 lines) | New page using `goals` table · keep the Agent Mode plan-then-execute pattern | 2 weeks |
| `decisions.html` | NEW (subset of `routes/rexWidget.ts` already has approval primitives) | New page using `decisions` table | 1 week |
| `team-settings.html` | `screens/SettingsTeamMembers.jsx` (1,157 lines) | Heavy refactor · add color picker + sharing toggles · keep members table | 1 week |
| `slack.html` | NEW (extends `services/slack.ts`) | New Slack app + bot service · install flow + event handlers | 2 weeks |
| `leads.html` | `screens/LeadManagement.jsx` (3,258 lines) | Heavy refactor · new shell · split LeadProfileDrawer (3,315 lines) into reusable component | 3 weeks |
| `pipelines.html` | `screens/JobPipeline.jsx` + `pages/kanban/*` | Refactor to two-tier (jobs list → kanban) · keep existing kanban primitives | 2 weeks |
| `deals.html` | `pages/DealsPage.tsx` (2,257 lines) | Refactor · keep existing CRM logic · update visual to match | 2 weeks |
| `inbox.html` | `screens/MessagingCenter.jsx` (1,719 lines) | Refactor · add per-thread autopilot strip · agent attribution | 2 weeks |
| `design-system.html` | NEW (`frontend/src/design/`) | Extract tokens + primitives into `tokens.css` + 8 component files | 1.5 weeks |

### Files to DELETE / consolidate (post-refactor)

- `pages/AppCatalog.tsx` → replaced by `hire-catalog.html`
- `pages/agent/AgentModeCenter.tsx` → replaced by Goals + Team
- `pages/REXChat.tsx` (2,045 lines) → replaced by REX slide-over
- `screens/MeetRex.jsx` (marketing — keep, but recruiter-side stays out)
- `screens/Sniper*` → consolidated into Sourcer agent's Skills
- 50+ blog post screens → unchanged (marketing site)
- Various legacy duplicates noted in earlier audit (Personas standalone, etc.)

---

## 7 · Beta migration plan

### 7.1 Existing-user migration (zero downtime)

```sql
-- Step 1: Every existing user with no workspace gets one auto-created (one-shot job)
-- Reuses existing public.ensure_personal_workspace(p_user_id) function from migration 20260127120000
-- They become 'owner' in workspace_members, no data movement (their existing data was already user_id-scoped).

-- Step 2: For every workspace, ensure team_settings row exists with v2 defaults
INSERT INTO team_settings (team_id, workspace_name, team_color, default_trust_level)
SELECT
  w.id,
  COALESCE(w.name, u.name || '''s HirePilot'),
  'indigo',
  'suggest'
FROM workspaces w
LEFT JOIN users u ON u.id = w.owner_id
LEFT JOIN team_settings ts ON ts.team_id = w.id
WHERE ts.team_id IS NULL;

-- Step 3: Pre-hire the Big 3 specialists for every workspace (non-destructive, opt-out via UI)
INSERT INTO agents (workspace_id, role, hired_by, trust_level)
SELECT w.id, role, w.owner_id, 'suggest'
FROM workspaces w
CROSS JOIN unnest(ARRAY['sourcer', 'recruiter', 'coordinator']) AS role
ON CONFLICT (workspace_id, role) DO NOTHING;

-- Step 4: Auto-install default Skills on each pre-hired agent
INSERT INTO agent_skills (agent_id, skill_id, enabled)
SELECT a.id, sc.id, true
FROM agents a
JOIN skills_catalog sc ON sc.agent_role = a.role AND sc.default_installed = true
ON CONFLICT (agent_id, skill_id) DO NOTHING;
```

### 7.2 Roll-out order (suggested)

| Phase | Duration | Surface | User-facing impact |
|---|---|---|---|
| **Phase 0** | 1 week | DB migrations + Skill registry scaffolding | None (additive) |
| **Phase 1** | 2 weeks | Goals + Decisions backend · REX prompt library · Specialist agents wired | Internal only · feature-flagged |
| **Phase 2** | 3 weeks | New shell (workspace.html) + Team page + Hire catalog | Beta users see new home behind feature flag |
| **Phase 3** | 4 weeks | Sourcer detail + Browserbase Skill running live · REX slide-over · Slack bot | Beta users get the operator demo |
| **Phase 4** | 4 weeks | Refactor heavy screens (Leads, Pipelines, Deals, Inbox) into new shell | Roll out per-tier |
| **Phase 5** | 2 weeks | Team plan onboarding + workspace switcher + custom colors | Team plan goes GA |
| **Phase 6** | ongoing | Add more Skills + specialist agents to catalog | Continuous |

**Total:** ~16 weeks to GA on the new architecture (1 backend + 2 frontend devs).

### 7.3 Feature flag strategy

```typescript
// Existing pattern — extend to:
const FLAGS = {
  v2_workspace_shell: 'workspace_v2',     // new sidebar + topbar
  v2_team_page: 'team_v2',                 // /team route
  v2_goals: 'goals_v2',                    // /goals route
  v2_decisions: 'decisions_v2',            // /decisions route
  v2_rex_orb: 'rex_orb_v2',                // floating REX FAB
  v2_specialists: 'specialists_v2',        // hire/manage agents
  v2_browser_skill: 'browser_v2',          // Browserbase Skill
  v2_slack_bot: 'slack_bot_v2',            // REX in Slack
};
```

Cohort flag flips:
1. Internal team only (1 week)
2. 10 beta agencies (2 weeks)
3. 100 paid users (2 weeks)
4. All Pro tier (1 week)
5. All paid (open) (ongoing)
6. Free tier last (after Skill gating UX is polished)

---

## 8 · What stays untouched

This redesign **does not touch:**

- Job Seeker subdomain (`jobs.thehirepilot.com`)
- IgniteGTM (Inner Apps)
- Marketing site / blog
- Affiliate program
- Existing webhook contracts (Zapier, custom integrations) — `zap_events` schema unchanged
- Stripe billing logic (subscriptions to HirePilot itself) — only Stripe Connect surfaces forward to the recruiter's payouts which is already shipped
- Public job pages (the candidate-facing view)
- Per-resource collaborator system (existing `GuestCollaboratorModal`, `ShareJobModal`, `InviteCollaboratorsModal`) — coexists with new team-wide sharing

---

## 9 · Critical reuse callouts

These are the things developers **must NOT rebuild** because they already exist and work:

| Don't rebuild | Use this instead |
|---|---|
| LinkedIn scraping / sourcing | `services/sniperV1/*` (8K LOC, full Sniper stack) |
| Apollo / Hunter / Skrapp enrichment | `services/apollo/enrichLead.ts` + `routes/leads/decodo/*` |
| Email sending | `services/sendgrid.ts` + `integrations/sendgrid.ts` |
| Gmail / Outlook integration | `routes/google_accounts.ts` + `outlook_tokens` table |
| Stripe Connect (recruiter bills client) | `services/stripe.ts` `createInvoiceWithItem({ account })` + `connectOnboardingLink()` |
| Calendar sync | `integrations/calendly.ts` (extend with native Google Calendar — small new work) |
| REX core MCP / tools | `rex/server.ts` (3,554 LOC) — extend, don't replace |
| REX activity log | `rex_activity_log` table |
| Slack outbound | `services/slack.ts` |
| Per-job collaborator UI | `components/job/InviteCollaboratorsModal.tsx`, `components/ShareJobModal.jsx` |
| Auth / RLS | Supabase auth + existing `is_workspace_member` patterns |
| Workspace creation | `public.ensure_personal_workspace(p_user_id)` (already exists) |
| Team member sync | `public.sync_team_workspace_members(p_user_id)` (already exists) |

---

## 10 · Open questions / future work

These don't block v1 ship but should be tracked:

1. **Native Google Calendar API** — Calendly works, but native Google Calendar would be cheaper + faster. ~1 week.
2. **Stripe Connect recruiter onboarding UX** — backend exists; the UI flow for "connect your Stripe to bill clients" needs a polished surface in Settings → Integrations.
3. **Slack OAuth — multi-Slack support** — confirmed scope is recruiter's own Slack only for v1. Multi-tenant client Slacks deferred.
4. **REX Voice on recruiter side** — UI exists in Job Seeker; just needs an entrypoint button on the recruiter side. ~3 days.
5. **More specialists in catalog** — Comp Benchmarker · Talent Mapper · Content Writer · Diligence Auditor — schedule for Q3/Q4 release.
6. **User-defined Skills (custom workflows)** — explicitly v2 (post-launch). Catalog stays curated for v1 quality.
7. **Pricing flat-fee variant** — current model is per-seat. If Brandon wants flat-fee for solo Pro tier with credit caps, no DB change needed (already supported via existing pricing config).
8. **Mobile** — out of scope for v1. Probably PWA-tier polish later.

---

## Appendix A · Estimated cost

Backend dev (1 senior): 16 weeks × $150/hr × 40 hrs = **~$96,000**
Frontend dev (2 mid-senior): 16 weeks × 2 × $120/hr × 40 hrs = **~$153,600**
Designer (1 part-time, polish + handoff): 8 weeks × $90/hr × 20 hrs = **~$14,400**
Infrastructure (Browserbase + Claude API + existing Supabase): ~$2k/mo during beta = **~$8,000**
**Total v1 build cost (4 months):** **~$272,000**

Conservative. If you can pull from existing team or use Cursor/Claude Code for half the frontend, halve it.

---

## Appendix B · Mockup → file index

| Mockup | Path |
|---|---|
| Workspace (solo Today) | `mockups/workspace.html` |
| Workspace (team Today) | `mockups/workspace-team.html` |
| Team (8 agents) | `mockups/team.html` |
| Sourcer detail | `mockups/agent-sourcer.html` |
| Hire catalog | `mockups/hire-catalog.html` |
| REX slide-over | `mockups/rex-open.html` |
| Team settings | `mockups/team-settings.html` |
| Slack | `mockups/slack.html` |
| Goals | `mockups/goals.html` |
| Decisions | `mockups/decisions.html` |
| Inbox | `mockups/inbox.html` |
| Leads | `mockups/leads.html` |
| Pipelines | `mockups/pipelines.html` |
| Deals | `mockups/deals.html` |
| Design system | `mockups/design-system.html` |

---

**Last updated:** May 3, 2026 · v1 of the implementation roadmap.
