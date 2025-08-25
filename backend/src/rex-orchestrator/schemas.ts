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
  senderBehavior: z.enum(['single','rotate']).default('single'),
  senderEmail: z.string().email().optional(),
  track_and_assist_replies: z.boolean().default(true)
});

export type SourcingParamsT = z.infer<typeof SourcingParams>;

// Wizard state schema for tracking user progress
export const WizardState = z.object({
  step: z.enum(['extract', 'sender', 'titles', 'summary', 'execute', 'complete']),
  params: SourcingParams.partial(),
  user_id: z.string(),
  session_id: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type WizardStateT = z.infer<typeof WizardState>;

// Wizard action schema for handling user interactions
export const WizardAction = z.object({
  id: z.string(),
  type: z.enum(['button', 'select', 'input', 'chips', 'multiselect']),
  label: z.string(),
  value: z.any().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false)
});

export type WizardActionT = z.infer<typeof WizardAction>;

// Wizard card schema for REX UI responses
export const WizardCard = z.object({
  title: z.string(),
  body_md: z.string(),
  actions: z.array(WizardAction),
  next: z.string().optional(),
  session_id: z.string().optional(),
  step: z.string().optional()
});

export type WizardCardT = z.infer<typeof WizardCard>;

// Plan extraction schema from user input
export const AgentPlan = z.object({
  agent_key: z.string(),
  goal: z.string(),
  params: z.record(z.any()),
  needs_confirmation: z.boolean(),
  missing: z.array(z.string())
});

export type AgentPlanT = z.infer<typeof AgentPlan>;

// Common title groups for quick selection
export const COMMON_TITLE_GROUPS = [
  'Head of Talent',
  'Recruiting Manager', 
  'Technical Recruiter',
  'VP People',
  'Talent Acquisition Manager',
  'Senior Recruiter',
  'Director of Talent',
  'People Operations Manager',
  'HR Business Partner',
  'Talent Partner'
] as const;

// Industry options
export const COMMON_INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Manufacturing',
  'Retail',
  'Education',
  'Government',
  'Non-profit',
  'Consulting',
  'Media & Entertainment'
] as const;

// Location options (major markets)
export const COMMON_LOCATIONS = [
  'United States',
  'San Francisco Bay Area',
  'New York City',
  'Los Angeles',
  'Chicago',
  'Boston',
  'Seattle',
  'Austin',
  'Denver',
  'Remote'
] as const;

// -------------------- Sniper Agent --------------------
export const SniperParams = z.object({
  type: z.enum(['own','competitor','keyword']),
  post_url: z.string().url().optional(),
  keyword_match: z.string().optional(),
  active_days: z.number().int().min(1).max(14).default(7),
  daily_cap: z.number().int().min(5).max(30).default(15),
  send_opener: z.boolean().default(false)
})
.refine(v => (v.type === 'keyword' ? !!v.keyword_match : true), { message: 'keyword_match required for type=keyword' })
.refine(v => (v.type !== 'keyword' ? !!v.post_url : true), { message: 'post_url required for own/competitor' });
