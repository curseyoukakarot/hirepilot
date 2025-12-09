import express, { Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import axios from 'axios';
import crypto from 'crypto';
import { WebClient } from '@slack/web-api';
import { supabase } from '../lib/supabase';
import { sendMessageToWidget } from '../lib/widgetBridge';

type ServiceType = 'contingency_search' | 'executive_search' | 'rpo_search' | 'bpo_services' | 'staffing_contract_c2c' | 'overview';

type Stage = 'pre_seed' | 'seed' | 'series_a_b' | 'growth' | 'enterprise' | 'unknown';
type HiringFocus = 'gtm' | 'leadership' | 'technical' | 'backoffice' | 'high_volume' | 'mixed' | 'unknown';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_CALENDLY = process.env.OFFR_CALENDLY_URL || 'https://calendly.com/offr-group/introductory-call';

const MASTER_PROMPT = [
  'You are the Offr Group Website Assistant, powered by HirePilot and REX.',
  'Goals: greet visitors, learn who they are, explain Offr services (Contingency, Executive Search, RPO, BPO, Staffing/Contract/C2C), recommend the best fit, and guide to a short intro call while capturing lead details.',
  'Keep answers simple, confident, and human. Avoid buzzwords. Anchor in outcomes: faster hires, better-fit talent, less chaos, scalable process.',
  'Ask low-friction questions: roles, how many hires, timeline, prior recruiter experience.',
  'Use tools when applicable: offr_explain_service for explanations/comparisons, offr_capture_website_lead once they want next steps, offr_route_livechat_message when a human is requested or high-value.',
  'Lead capture: politely collect first name, last name, work email, phone (optional), LinkedIn (optional), company + role (if hiring-side) before calling offr_capture_website_lead.',
  'After lead capture, always offer Calendly for a quick intro call. If they prefer email, confirm that instead.',
  'Tone: friendly, sharp, efficient. No fake empathy or hype. Short paragraphs or bullets.',
  'Boundaries: no legal/tax advice. If unsure about pricing/process, be honest and suggest a call.',
  'Priority: understand → recommend service → capture details → book meeting.',
].join(' ');

const SERVICE_PROFILES: Record<ServiceType, {
  headline: string;
  summary: string;
  idealFor: string[];
  howItWorks: string[];
  differentiators: string[];
  qualifyingQuestion: string;
  cta: string;
}> = {
  contingency_search: {
    headline: 'Pay only when we place your hire.',
    summary: 'Core Offr Group search for sales, marketing, and engineering roles with success-based pricing and a 90-day replacement guarantee.',
    idealFor: [
      'Filling a handful of GTM or technical roles quickly',
      'No in-house recruiting capacity or need extra pipeline',
      'You want risk-limited, pay-on-success support',
    ],
    howItWorks: [
      'Align on role profile, compensation, and must-haves',
      'Dedicated sourcer + recruiter run outbound and vet candidates',
      'Deliver 3–6 highly vetted candidates and iterate weekly',
    ],
    differentiators: [
      '20–25% fee with a 90-day performance/behavior replacement guarantee',
      'Proactive outbound, curated shortlists, and weekly reporting via HirePilot',
      'Focus on sales, marketing, and engineering — not generic staffing',
    ],
    qualifyingQuestion: 'How many roles are you trying to fill in the next 60–90 days?',
    cta: 'Want a quick call to walk through your roles and typical timelines?',
  },
  executive_search: {
    headline: 'Leadership search with disciplined mapping and outreach.',
    summary: 'Retainer-first executive search for VP, Director, and C-Suite with market mapping, passive targeting, and confidential handling.',
    idealFor: [
      'VP, Director, or C-level roles',
      'PE-backed or growth-stage leadership teams',
      'Need confidential or nuanced outreach',
    ],
    howItWorks: [
      'Define success profile, market targets, and confidentiality needs',
      'Run market mapping + passive outreach to top operators',
      'Multi-stage vetting and shortlisting with regular calibrations',
    ],
    differentiators: [
      'Retainer-based with negotiable structure; success-only in select cases',
      'Depth: market mapping, competitive outreach, and multi-stage vetting',
      'Built for PE-backed and growth-stage teams — not generic contingency',
    ],
    qualifyingQuestion: 'Which leadership role and level (VP/Director/C-suite) are you targeting?',
    cta: 'I can outline an exec search plan and timeline on a short call — want to do that?',
  },
  rpo_search: {
    headline: 'Embedded recruiters for high-volume salaried hiring.',
    summary: 'Recruitment Process Outsourcing when you need multiple hires quickly and consistently.',
    idealFor: [
      '5+ hires per quarter across sales, engineering, marketing, or ops',
      'Internal team needs scale and consistent pipeline',
      'You want per-recruiter-per-month pricing vs per-placement fees',
    ],
    howItWorks: [
      'Scope volume, functions, and service levels',
      'Deploy dedicated recruiters with pipeline management',
      'Weekly reporting with ATS + HirePilot analytics',
    ],
    differentiators: [
      'Sized for salaried roles; we avoid hourly/temporary staffing in RPO',
      'Predictable per-recruiter monthly model with minimum commitment',
      'Operational rigor: reporting cadence and integrated tooling',
    ],
    qualifyingQuestion: 'Roughly how many hires do you need in the next 90 days and across which functions?',
    cta: 'We can map an embedded plan on a quick call — want to review volume and timeline together?',
  },
  bpo_services: {
    headline: 'Structured BPO for HR, RevOps, admin, and finance.',
    summary: 'Operational support teams (domestic + offshore) to reduce cost and lift day-to-day workload.',
    idealFor: [
      'Scaling startups, PE portfolios, or professional services',
      'Need HR, RevOps, admin, or finance support without heavy headcount',
      'Looking for ongoing operational coverage',
    ],
    howItWorks: [
      'Define scope and required coverage',
      'Place and structure the team (domestic/offshore mix)',
      'Stand up oversight and reporting for long-term support',
    ],
    differentiators: [
      'Offr Group oversees sourcing and initial structuring',
      'Cost reduction with scalable ops coverage',
      'Designed for ongoing operational lift, not one-off projects',
    ],
    qualifyingQuestion: 'Which functions do you want covered (HR, RevOps, admin, finance) and what’s the expected volume?',
    cta: 'Happy to scope a BPO pod with you — want to walk through needs on a quick call?',
  },
  staffing_contract_c2c: {
    headline: 'Specialized tech contractors — C2C preferred.',
    summary: 'Staffing for tech/IT contractors and specialized consultants with clear margin rules.',
    idealFor: [
      'Engineering, infrastructure, or specialized consultants',
      'Need C2C or high-margin W2 placements',
      'Project-based or flexible engagement',
    ],
    howItWorks: [
      'Confirm role, duration, and margin viability (≥30%)',
      'Source and vet technical contractors or firms',
      'Manage onboarding and, when approved, payroll for W2',
    ],
    differentiators: [
      'C2C preferred; W2 only if margin ≥30%',
      'Avoid low-margin, non-technical hourly work',
      'Technical focus rather than generic temp staffing',
    ],
    qualifyingQuestion: 'What role, duration, and target rate are you planning? We need ≥30% margin to proceed.',
    cta: 'If the margin works, we can line up candidates and next steps — want to review quickly?',
  },
  overview: {
    headline: 'Right-sized search and staffing for lean, fast hiring.',
    summary: 'Offr Group covers contingency, executive, RPO, BPO, and staffing/contract/C2C with a bias for speed, fit, and clear guardrails.',
    idealFor: [
      'Founders, hiring managers, and execs needing fast, quality hires',
      'Teams choosing between success-based search vs embedded recruiting',
      'Groups weighing contractors/BPO for flexibility',
    ],
    howItWorks: [
      'Align on roles, volume, and urgency',
      'Recommend contingency, executive, RPO, BPO, or staffing mix',
      'Deliver candidates or teams with clear reporting and guarantees',
    ],
    differentiators: [
      'Clear disqualifiers: no RPO for hourly, no low-margin staffing, exec search requires alignment',
      '90-day replacement guarantee on contingency roles',
      'Offr-managed outreach, vetting, and reporting cadence',
    ],
    qualifyingQuestion: 'Which roles, how many hires, and what timeline are you targeting?',
    cta: 'Want to walk through options and pick the right model on a quick call?',
  },
};

function ensureSessionId(candidate?: string | null): string {
  if (candidate && uuidRegex.test(candidate)) return candidate;
  try { return crypto.randomUUID(); } catch { return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
}

function buildExplainService(input: {
  service_type: ServiceType;
  company_stage?: Stage;
  hiring_focus?: HiringFocus;
  context_question?: string | null;
}) {
  const service = SERVICE_PROFILES[input.service_type] || SERVICE_PROFILES.overview;
  const stageLabel = (input.company_stage && input.company_stage !== 'unknown') ? input.company_stage.replace(/_/g, ' ') : null;
  const focusLabel = (input.hiring_focus && input.hiring_focus !== 'unknown') ? input.hiring_focus.replace(/_/g, ' ') : null;

  const headline = service.headline;
  const short_summary = [
    service.summary,
    stageLabel ? `Fits ${stageLabel} teams looking for speed and clarity.` : null,
    focusLabel ? `Great for ${focusLabel} needs.` : null,
  ].filter(Boolean).join(' ');

  return {
    headline,
    short_summary,
    ideal_for: service.idealFor,
    how_it_works: service.howItWorks,
    what_makes_offrgroup_different: service.differentiators,
    qualifying_question: service.qualifyingQuestion,
    cta_phrase: service.cta,
  };
}

async function postSlack(webhookUrl: string | undefined, text: string) {
  if (!webhookUrl) return;
  try { await axios.post(webhookUrl, { text }); } catch (err) { console.warn('[offr] slack webhook failed', (err as any)?.message || err); }
}

async function insertLead(payload: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  linkedin_url?: string | null;
  company_name?: string | null;
  role_title?: string | null;
  interest_area?: string | null;
  hiring_type?: string | null;
  estimated_hires?: string | null;
  timeline?: string | null;
  budget_signal?: string | null;
  free_text_question?: string | null;
  page_url?: string | null;
  utm?: Record<string, any> | null;
  session_id?: string | null;
}) {
  const fullName = `${payload.first_name} ${payload.last_name}`.trim();
  const notesParts = [
    payload.role_title ? `Role: ${payload.role_title}` : null,
    payload.hiring_type ? `Hiring type: ${payload.hiring_type}` : null,
    payload.estimated_hires ? `Est. hires: ${payload.estimated_hires}` : null,
    payload.timeline ? `Timeline: ${payload.timeline}` : null,
    payload.budget_signal ? `Budget: ${payload.budget_signal}` : null,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.linkedin_url ? `LinkedIn: ${payload.linkedin_url}` : null,
    payload.free_text_question ? `Notes: ${payload.free_text_question}` : null,
  ].filter(Boolean).join(' | ');

  const { data, error } = await supabase
    .from('rex_leads')
    .insert({
      full_name: fullName,
      work_email: payload.email,
      company: payload.company_name || null,
      interest: payload.interest_area || null,
      notes: notesParts || null,
      source: 'offrgroup_website_chat',
      rb2b: {
        hiring_type: payload.hiring_type || null,
        estimated_hires: payload.estimated_hires || null,
        timeline: payload.timeline || null,
        budget_signal: payload.budget_signal || null,
        phone: payload.phone || null,
        linkedin_url: payload.linkedin_url || null,
        page_url: payload.page_url || null,
        utm: payload.utm || null,
        session_id: payload.session_id || null,
      },
    })
    .select('id')
    .single();

  if (error) throw error;
  return data?.id as string;
}

async function handleLeadCapture(args: any, pageUrl: string | null, sessionId: string) {
  const requiredMissing = ['first_name', 'last_name', 'email'].filter(k => !args?.[k]);
  if (requiredMissing.length) {
    return {
      status: 'validation_error',
      lead_id: null,
      confirmation_message: `Missing required fields: ${requiredMissing.join(', ')}.`,
      calendly_link: DEFAULT_CALENDLY,
      should_open_calendly: false,
      internal_notes: 'Validation failed',
    };
  }

  const leadId = await insertLead({
    first_name: args.first_name,
    last_name: args.last_name,
    email: args.email,
    phone: args.phone || null,
    linkedin_url: args.linkedin_url || null,
    company_name: args.company_name || null,
    role_title: args.role_title || null,
    interest_area: args.interest_area || args.service_type || null,
    hiring_type: args.hiring_type || null,
    estimated_hires: args.estimated_hires || args.estimated_hires_next_12_months || null,
    timeline: args.timeline || 'unknown',
    budget_signal: args.budget_signal || 'unknown',
    free_text_question: args.free_text_question || null,
    page_url: args.page_url || pageUrl,
    utm: args.utm || null,
    session_id: sessionId,
  });

  const slackText = [
    'New Offr Group website lead',
    `Name: ${args.first_name} ${args.last_name} <${args.email}>`,
    `Company: ${args.company_name || '-'}`,
    `Role: ${args.role_title || '-'}`,
    `Interest: ${args.interest_area || 'not_sure'} | Hiring type: ${args.hiring_type || '-'}`,
    `Est. hires: ${args.estimated_hires || args.estimated_hires_next_12_months || '-'} | Timeline: ${args.timeline || 'unknown'}`,
    `Phone: ${args.phone || '-'} | LinkedIn: ${args.linkedin_url || '-'}`,
    `Page: ${args.page_url || pageUrl || '-'}`,
  ].join('\n');

  await postSlack(process.env.OFFR_WEBSITE_LEADS_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL, slackText);

  return {
    status: 'success',
    lead_id: leadId || null,
    confirmation_message: 'Got it — thanks for sharing. I sent your details to the Offr Group team. Want to grab time now?',
    calendly_link: DEFAULT_CALENDLY,
    should_open_calendly: true,
    internal_notes: `High-intent Offr lead: ${args.interest_area || 'unknown'} | hires: ${args.estimated_hires || args.estimated_hires_next_12_months || '?'} | timeline: ${args.timeline || 'unknown'}`,
  };
}

async function routeLivechatMessage(input: {
  session_id: string;
  message_from?: 'visitor' | 'agent';
  message_text: string;
  visitor_context?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    page_url?: string;
    interest_area?: string;
  };
}) {
  const sessionId = ensureSessionId(input.session_id);
  const slackChannel = process.env.OFFR_WEBSITE_CHAT_SLACK_CHANNEL || process.env.SLACK_CHANNEL_ID || '';
  const botToken = process.env.SLACK_BOT_TOKEN;
  const webhookUrl = process.env.OFFR_WEBSITE_CHAT_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  const name = [input.visitor_context?.first_name, input.visitor_context?.last_name].filter(Boolean).join(' ').trim() || 'Visitor';
  const email = input.visitor_context?.email;
  const page = input.visitor_context?.page_url || '-';
  let threadTs: string | null = null;

  // Try to find an existing live session thread
  try {
    const { data: live } = await supabase
      .from('rex_live_sessions')
      .select('slack_channel_id, slack_thread_ts')
      .eq('widget_session_id', sessionId)
      .maybeSingle();
    if (live?.slack_channel_id === slackChannel && live.slack_thread_ts) {
      threadTs = live.slack_thread_ts;
    }
  } catch {}

  const textLines = [
    `Offr website chat (session: ${sessionId})`,
    `From: ${name}${email ? ` <${email}>` : ''}`,
    `Page: ${page}`,
    input.visitor_context?.interest_area ? `Interest: ${input.visitor_context.interest_area}` : null,
    '',
    input.message_text,
  ].filter(Boolean).join('\n');

  if (botToken && slackChannel) {
    try {
      const slack = new WebClient(botToken);
      const postArgs: any = {
        channel: slackChannel,
        text: textLines,
        unfurl_links: false,
        unfurl_media: false,
      };
      if (threadTs) postArgs.thread_ts = threadTs;
      const posted = await slack.chat.postMessage(postArgs);
      const newThread = (posted as any)?.ts as string | undefined;
      const activeThread = threadTs || newThread || null;
      if (activeThread) {
        try {
          await supabase
            .from('rex_live_sessions')
            .upsert({
              widget_session_id: sessionId,
              slack_channel_id: slackChannel,
              slack_thread_ts: activeThread,
              user_name: name || null,
              user_email: email || null,
            }, { onConflict: 'widget_session_id' });
        } catch (insErr) {
          console.error('[offr/livechat] upsert live session failed', insErr);
        }
      }
    } catch (slackErr: any) {
      console.error('[offr/livechat] slack post failed', slackErr?.message || slackErr);
      if (webhookUrl) {
        await postSlack(webhookUrl, textLines);
      }
    }
  } else if (webhookUrl) {
    await postSlack(webhookUrl, textLines);
  }

  try {
    await supabase
      .from('live_chat_messages')
      .insert({
        session_id: sessionId,
        sender: input.message_from || 'visitor',
        text: input.message_text,
        name,
        email: email || null,
      });
  } catch {}

  return {
    status: 'delivered',
    human_online: true,
    display_message: 'Got it — a teammate will reply here shortly.',
  };
}

router.post('/public-chat/offr', async (req: Request, res: Response) => {
  const schema = z.object({
    message: z.string().min(1),
    session_id: z.string().optional(),
    page_url: z.string().optional(),
    mode: z.enum(['ai', 'live']).optional(),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() })).max(20).optional(),
    visitor: z.object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      company: z.string().optional(),
    }).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.issues });
    return;
  }

  const sessionId = ensureSessionId(parsed.data.session_id);
  const userMessage = parsed.data.message;
  const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: MASTER_PROMPT },
  ];
  (parsed.data.history || []).forEach(m => baseMessages.push({ role: m.role, content: m.text }));
  baseMessages.push({ role: 'user', content: userMessage });

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'offr_explain_service',
        description: 'Explain or compare Offr Group services based on visitor context.',
        parameters: {
          type: 'object',
          properties: {
            service_type: { type: 'string', enum: ['contingency_search', 'executive_search', 'rpo_search', 'bpo_services', 'staffing_contract_c2c', 'overview'] },
            company_stage: { type: 'string', enum: ['pre_seed', 'seed', 'series_a_b', 'growth', 'enterprise', 'unknown'], nullable: true },
            hiring_focus: { type: 'string', enum: ['gtm', 'leadership', 'technical', 'backoffice', 'high_volume', 'mixed', 'unknown'], nullable: true },
            context_question: { type: 'string', nullable: true },
          },
          required: ['service_type'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'offr_capture_website_lead',
        description: 'Capture lead info for Offr Group website visitors and return Calendly.',
        parameters: {
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string', nullable: true },
            linkedin_url: { type: 'string', nullable: true },
            company_name: { type: 'string', nullable: true },
            role_title: { type: 'string', nullable: true },
            interest_area: { type: 'string', enum: ['contingency', 'executive', 'rpo', 'bpo', 'staffing', 'mixed', 'not_sure'], nullable: true },
            hiring_type: { type: 'string', enum: ['sales', 'marketing', 'engineering', 'leadership', 'backoffice', 'high_volume', 'other'], nullable: true },
            estimated_hires: { type: 'string', nullable: true },
            timeline: { type: 'string', enum: ['immediate', '30_days', '60_days', '90_plus', 'unknown'], nullable: true },
            budget_signal: { type: 'string', enum: ['yes', 'maybe', 'unknown'], nullable: true },
            free_text_question: { type: 'string', nullable: true },
            page_url: { type: 'string', nullable: true },
            utm: { type: 'object', additionalProperties: true, nullable: true },
          },
          required: ['first_name', 'last_name', 'email'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'offr_route_livechat_message',
        description: 'Escalate to human live chat via Slack bridge.',
        parameters: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            message_from: { type: 'string', enum: ['visitor', 'agent'], nullable: true },
            message_text: { type: 'string' },
            visitor_context: {
              type: 'object',
              properties: {
                first_name: { type: 'string', nullable: true },
                last_name: { type: 'string', nullable: true },
                email: { type: 'string', nullable: true },
                page_url: { type: 'string', nullable: true },
                interest_area: { type: 'string', nullable: true },
              },
              required: [],
            },
          },
          required: ['session_id', 'message_text'],
        },
      },
    },
  ];

  try {
    let first = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: baseMessages,
      tools,
      tool_choice: 'auto',
    });

    let assistantMessage = first.choices?.[0]?.message;
    const toolCalls = assistantMessage?.tool_calls || [];
    const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (toolCalls.length) {
      for (const call of toolCalls) {
        const name = call.function?.name;
        let args: any = {};
        try { args = call.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch {}
        let result: any = { status: 'error', message: 'Unhandled tool' };
        if (name === 'offr_explain_service') {
          result = buildExplainService({
            service_type: args.service_type as ServiceType,
            company_stage: args.company_stage as Stage,
            hiring_focus: args.hiring_focus as HiringFocus,
            context_question: args.context_question || null,
          });
        } else if (name === 'offr_capture_website_lead') {
          result = await handleLeadCapture(args, parsed.data.page_url || null, sessionId);
        } else if (name === 'offr_route_livechat_message') {
          result = await routeLivechatMessage({
            session_id: sessionId,
            message_from: args.message_from || 'visitor',
            message_text: args.message_text,
            visitor_context: args.visitor_context,
          });
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      const followUp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          ...baseMessages,
          assistantMessage as any,
          ...toolResults,
        ],
      });
      assistantMessage = followUp.choices?.[0]?.message;
    }

    const finalText = assistantMessage?.content || 'Thanks — how can Offr Group help?';
    const captureLead = toolCalls.some(c => c.function?.name === 'offr_capture_website_lead');

    res.json({
      response: finalText,
      session_id: sessionId,
      capture_lead: captureLead,
      calendly_link: DEFAULT_CALENDLY,
    });
  } catch (err: any) {
    console.error('[offr/public-chat] error', err?.message || err);
    res.status(500).json({ error: 'internal_error', message: 'Sorry, I had trouble answering. Please try again.' });
  }
});

router.post('/public-leads/offr', async (req: Request, res: Response) => {
  const schema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    linkedin: z.string().optional(),
    company: z.string().optional(),
    hiringFor: z.string().optional(),
    session_id: z.string().optional(),
    source: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.issues });
    return;
  }
  const body = parsed.data;
  const sessionId = ensureSessionId(body.session_id);
  if (!body.firstName || !body.lastName || !body.email) {
    res.status(400).json({ error: 'missing_required', message: 'First name, last name, and email are required.' });
    return;
  }
  try {
    const leadResult = await handleLeadCapture({
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      phone: body.phone,
      linkedin_url: body.linkedin,
      company_name: body.company,
      free_text_question: body.hiringFor,
      interest_area: 'not_sure',
    }, null, sessionId);
    res.json({ ok: true, lead: leadResult });
  } catch (err: any) {
    console.error('[offr/public-leads] error', err?.message || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/offr-livechat/messages', async (req: Request, res: Response) => {
  const schema = z.object({
    message: z.string().min(1),
    session_id: z.string().optional(),
    page_url: z.string().optional(),
    visitor: z.object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
    }).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.issues });
    return;
  }
  const sessionId = ensureSessionId(parsed.data.session_id);
  try {
    const routed = await routeLivechatMessage({
      session_id: sessionId,
      message_from: 'visitor',
      message_text: parsed.data.message,
      visitor_context: {
        first_name: parsed.data.visitor?.first_name,
        last_name: parsed.data.visitor?.last_name,
        email: parsed.data.visitor?.email,
        page_url: parsed.data.page_url,
      },
    });
    res.json({ response: routed.display_message || 'Thanks — our team will reply shortly.', session_id: sessionId });
  } catch (err: any) {
    console.error('[offr/livechat] error', err?.message || err);
    res.status(500).json({ error: 'internal_error', message: 'Could not send message. Please try again.' });
  }
});

// Utility endpoint to mirror Slack replies into widget (optional manual trigger)
router.post('/offr-livechat/relay', async (req: Request, res: Response) => {
  const schema = z.object({
    session_id: z.string(),
    message: z.string(),
    name: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'invalid_input' }); return; }
  try {
    await sendMessageToWidget(parsed.data.session_id, {
      from: 'human',
      name: parsed.data.name || null,
      message: parsed.data.message,
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[offr/livechat/relay] error', err?.message || err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;


