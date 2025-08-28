import { z } from 'zod';

export type Mode = 'sales' | 'support';

export type Intent =
  | 'greeting_smalltalk'
  | 'learn_hirepilot'
  | 'pricing_plan'
  | 'comparison'
  | 'demo_booking'
  | 'lead_capture'
  | 'support_howto'
  | 'support_bug'
  | 'handoff_request'
  | 'other';

export type State =
  | 'GREETER'
  | 'DISCOVERY'
  | 'QUALIFY'
  | 'ANSWER'
  | 'CTA'
  | 'SUPPORT_GREETER'
  | 'GET_CONTEXT'
  | 'GUIDE'
  | 'CONFIRM';

export const CtaSchema = z.object({
  type: z.enum(['none', 'link', 'calendly', 'lead_form', 'support_ticket']),
  label: z.string(),
  url: z.string().optional(),
  fields: z
    .array(
      z.object({
        name: z.string(),
        label: z.string(),
        type: z.enum(['text', 'email']),
        required: z.boolean().default(true),
      })
    )
    .optional(),
});
export type Cta = z.infer<typeof CtaSchema>;

export const AgentResponseSchema = z.object({
  say: z.string(),
  cta: CtaSchema,
  state_patch: z.object({
    state: z
      .enum([
        'GREETER',
        'DISCOVERY',
        'QUALIFY',
        'ANSWER',
        'CTA',
        'SUPPORT_GREETER',
        'GET_CONTEXT',
        'GUIDE',
        'CONFIRM',
      ])
      .optional(),
    collected: z.record(z.any()).optional(),
    support_ctx: z.record(z.any()).optional(),
  }),
  actions: z.array(
    z.object({
      tool: z.string(),
      args: z.record(z.any()).optional(),
    })
  ),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
  intent: z
    .enum([
      'greeting_smalltalk',
      'learn_hirepilot',
      'pricing_plan',
      'comparison',
      'demo_booking',
      'lead_capture',
      'support_howto',
      'support_bug',
      'handoff_request',
      'other',
    ])
    .optional(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export type SessionState = {
  state?: State;
  mode?: Mode;
  collected?: {
    name?: string;
    email?: string;
    company?: string;
    role?: string; // recruiter, founder, talent lead, etc.
    hiring_for?: 'clients' | 'internal' | 'unknown';
    use_case?: string;
  };
  support_ctx?: {
    page?: string;
    jobId?: string;
    campaignId?: string;
    last_error?: string;
  };
  last_intent?: Intent;
};

export type Config = {
  demoUrl?: string;
  pricingUrl?: string;
  docsUrl?: string;
  calendlyUrl?: string;
  calendlyEvent?: string; // e.g. "hirepilot/15min-intro"
  allowWebFallback?: boolean; // from REX_ALLOW_WEB_FALLBACK
};


