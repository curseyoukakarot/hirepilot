import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  chatStreamSse,
  createConversation,
  fetchMessages,
  fetchRex2Agents,
  listConversations,
  postMessage,
  type RexAgentProfile,
  type RexConversation
} from '../lib/rexApi';
import { supabase } from '../lib/supabaseClient';
import '../styles/rex.css';
import MarkdownContent from '../components/rex/MarkdownContent';

type UiMessage = {
  id: string;
  sender: 'user' | 'rex';
  content: string;
  streaming?: boolean;
};

type UploadedAttachment = {
  name: string;
  text?: string;
  url?: string;
  mime?: string;
  size?: number;
};

type AgentProfile = RexAgentProfile;

type PlanStep = {
  step_id: string;
  title: string;
  description: string;
  category: string;
  status?: 'queued' | 'running' | 'success' | 'failure' | 'skipped';
};

type PlanJson = {
  schema_version: 'rex.plan.v1';
  plan_id: string;
  created_at: string;
  source: {
    generator: string;
    model: string | null;
    conversation_id: string | null;
    campaign_id: string | null;
  };
  goal: {
    title: string;
    description: string;
    constraints: {
      location: string[];
      seniority: string[];
      skills: string[];
      must_have: string[];
      nice_to_have: string[];
      exclude: string[];
      time_window: string | null;
    };
  };
  assumptions: string[];
  estimates: {
    credits: { min: number; max: number; unit: string; notes: string };
    time: { min_minutes: number; max_minutes: number; notes: string };
    risk: { level: 'low' | 'medium' | 'high'; notes: string };
  };
  steps: PlanStep[];
  approval: {
    required: boolean;
    reason: string;
    approved_at: string | null;
    approved_by: string | null;
  };
};

type RunProgressStep = {
  step_id: string;
  status: 'queued' | 'running' | 'success' | 'failure' | 'skipped';
  progress?: {
    percent?: number;
    label?: string;
    current?: number;
    total?: number;
  };
  results?: {
    summary?: string;
    metrics?: Record<string, any>;
    quality?: {
      score_percent?: number;
      notes?: string;
    };
  };
};

type RunProgress = {
  schema_version?: string;
  run_id?: string;
  status?: 'queued' | 'running' | 'success' | 'failure' | 'cancelled';
  current_step_id?: string | null;
  counters?: {
    steps_total?: number;
    steps_completed?: number;
    items_total?: number;
    items_processed?: number;
  };
  steps?: RunProgressStep[];
};

type RunArtifact = {
  artifact_id: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  created_at?: string;
  refs?: Record<string, any>;
  meta?: Record<string, any>;
};

type ToolCall = {
  toolcall_id: string;
  step_id: string;
  status: string;
  tool: {
    tool_id: string;
    transport?: string;
    display_name?: string;
  };
  metrics?: {
    duration_ms?: number;
    credits_used?: number;
  };
  output?: Record<string, any>;
};

type RunStats = {
  schema_version?: string;
  credits?: {
    estimated?: number;
    used?: number;
    remaining?: number;
    notes?: string;
  };
  timing?: {
    eta_seconds?: number;
    elapsed_seconds?: number;
  };
  counts?: {
    profiles_found?: number;
    profiles_enriched?: number;
    leads_created?: number;
    messages_scheduled?: number;
  };
  quality?: {
    avg_score_percent?: number;
    notes?: string;
  };
  toolcalls?: ToolCall[];
};

const SUGGESTED_PROMPTS = [
  { label: 'Find 50 SDRs in Austin', text: 'Find 50 SDRs in Austin, TX', icon: 'fa-magnifying-glass' },
  { label: 'Analyze my resume', text: 'Analyze my resume and suggest improvements', icon: 'fa-file-lines' },
  { label: 'Set up an email campaign', text: 'Set up a 3-step outreach email campaign', icon: 'fa-envelope' },
  { label: 'Pull LinkedIn post likers', text: 'Pull the list of people who liked my latest LinkedIn post', icon: 'fa-thumbs-up' },
  { label: 'Check my Sniper status', text: 'Check the status of my active Sniper campaigns', icon: 'fa-crosshairs' },
  { label: 'Help me write outreach', text: 'Help me write a personalized outreach sequence for product managers', icon: 'fa-pen-to-square' },
];

function humanizeToolName(raw: string): string {
  const map: Record<string, string> = {
    source_leads: 'Sourcing leads',
    filter_leads: 'Filtering leads',
    enrich_lead: 'Enriching profile',
    send_campaign_email_auto: 'Sending emails',
    send_campaign_email_by_template_name: 'Sending template emails',
    send_campaign_email_draft: 'Sending draft emails',
    send_email: 'Sending email',
    send_email_to_lead: 'Emailing lead',
    send_template_email: 'Sending template',
    list_email_templates: 'Loading templates',
    preview_campaign_email: 'Previewing email',
    schedule_campaign: 'Scheduling campaign',
    get_campaign_metrics: 'Loading metrics',
    sniper_collect_post: 'Collecting post data',
    sniper_poll_leads: 'Polling leads',
    sniper_campaign_outreach_connect: 'Queuing outreach',
    sniper_get_status: 'Checking Sniper',
    sniper_update_settings: 'Updating settings',
    resume_intelligence: 'Analyzing resume',
    resume_scoring: 'Scoring resume',
    linkedin_intelligence: 'Analyzing LinkedIn',
    view_pipeline: 'Loading pipeline',
    convert_lead_to_candidate: 'Converting lead',
  };
  return map[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const DEFAULT_STEP_BLUEPRINT: Array<{ title: string; description: string; category: string }> = [
  { title: 'Source candidates from LinkedIn + Indeed', description: 'Search with filters: React, TypeScript, Next.js, 5+ years, North America', category: 'sourcing' },
  { title: 'Extract and enrich profiles', description: 'Pull resumes, work history, skills, and contact information', category: 'enrichment' },
  { title: 'Score against job requirements', description: 'AI-powered matching based on skills, experience, and location', category: 'scoring' },
  { title: 'Store as leads in pipeline', description: 'Create "Senior React Dev" campaign with segmented lists', category: 'crm' },
  { title: 'Schedule recurring refinement', description: 'Weekly search for new candidates matching criteria', category: 'workflow' },
  { title: 'Draft outreach sequence', description: 'Personalized 3-email sequence with role details', category: 'messaging' },
  { title: 'Monitor replies and engagement', description: 'Track opens, clicks, and responses with notifications', category: 'analytics' }
];

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function toDurationLabel(seconds: number) {
  const sec = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(sec / 60);
  const remainder = sec % 60;
  if (minutes <= 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function estimateDraftPlan(prompt: string, steps: PlanStep[]) {
  const text = `${prompt} ${(steps || []).map((s) => `${s.title} ${s.description}`).join(' ')}`.toLowerCase();
  const countMatch = text.match(/\b(\d{1,4})\s+(?:lead|leads|candidate|candidates|profiles?)\b/);
  const targetLeads = Math.max(10, Math.min(1000, Number(countMatch?.[1] || 50)));
  const hasEnrich = steps.some((s) => /enrich|profile|contact|email/i.test(`${s.title} ${s.description}`));
  const hasSource = steps.some((s) => /source|linkedin|indeed|apollo|candidate/i.test(`${s.title} ${s.description}`));
  const hasOutreach = steps.some((s) => /outreach|message|sequence|reply/i.test(`${s.title} ${s.description}`));
  const enhancedExplicit = /enhanced|deep enrich|advanced enrich/i.test(text);
  const enhancedCount = hasEnrich ? Math.round(targetLeads * (enhancedExplicit ? 0.5 : 0.25)) : 0;

  const leadCredits = targetLeads * 1;
  const enrichCredits = hasEnrich ? targetLeads * 1 : 0;
  const enhancedCredits = enhancedCount * 1;
  const linkedinActionCredits = (hasSource ? Math.max(1, Math.ceil(targetLeads / 25) * 3) : 0) * (1 / 6);
  const apolloActionCredits = (hasSource ? Math.max(1, Math.ceil(targetLeads / 50) * 2) : 0) * 0.25;
  const messagingActionCredits = (hasOutreach ? Math.max(1, Math.ceil(targetLeads / 40)) : 0) * 0.2;

  const expected = leadCredits + enrichCredits + enhancedCredits + linkedinActionCredits + apolloActionCredits + messagingActionCredits;
  const min = Math.max(1, Math.round(expected * 0.85));
  const max = Math.max(min, Math.round(expected * 1.15));
  const timeMin = Math.max(5, Math.round(targetLeads / 8));
  const timeMax = Math.max(timeMin + 5, Math.round(targetLeads / 4));
  const risk = targetLeads > 250 ? 'medium' : 'low';

  return { min, max, expected: Math.round(expected), timeMin, timeMax, risk };
}

function buildPlanFromText(prompt: string, reply: string, conversationId: string | null): PlanJson {
  const lines = String(reply || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const extracted = lines
    .map((line) => {
      const m = line.match(/^\s*(\d+)[\)\.\-:]\s*(.+)$/);
      if (!m) return null;
      return m[2]?.trim() || '';
    })
    .filter(Boolean);

  const steps = (extracted.length ? extracted : DEFAULT_STEP_BLUEPRINT.map((x) => x.title))
    .slice(0, 7)
    .map((title, idx) => ({
      step_id: `step_${idx + 1}`,
      title,
      description: DEFAULT_STEP_BLUEPRINT[idx]?.description || 'Execute this phase of the recruiting workflow.',
      category: DEFAULT_STEP_BLUEPRINT[idx]?.category || 'other',
      status: 'queued' as const
    }));
  const estimate = estimateDraftPlan(prompt, steps);

  return {
    schema_version: 'rex.plan.v1',
    plan_id: makeId('plan'),
    created_at: new Date().toISOString(),
    source: {
      generator: 'rex-chat',
      model: null,
      conversation_id: conversationId,
      campaign_id: null
    },
    goal: {
      title: 'Recruiting Workflow',
      description: prompt,
      constraints: {
        location: [],
        seniority: [],
        skills: [],
        must_have: [],
        nice_to_have: [],
        exclude: [],
        time_window: null
      }
    },
    assumptions: [],
    estimates: {
      credits: {
        min: estimate.min,
        max: estimate.max,
        unit: 'credits',
        notes: 'Low-cost model: 1 credit/lead, +1 basic enrich, +1 enhanced enrich, plus lightweight tool actions.'
      },
      time: { min_minutes: estimate.timeMin, max_minutes: estimate.timeMax, notes: 'Depends on sourcing target volume and queue throughput.' },
      risk: { level: estimate.risk as 'low' | 'medium' | 'high', notes: estimate.risk === 'medium' ? 'Higher volume run detected.' : 'Low-risk standard recruiting flow.' }
    },
    steps,
    approval: {
      required: true,
      reason: 'Run requires approval before execution.',
      approved_at: null,
      approved_by: null
    }
  };
}

function normalizeRoleLabel(rawRole: string) {
  const role = String(rawRole || '').trim().toLowerCase();
  if (!role) return 'Member';
  if (role === 'super_admin' || role === 'superadmin') return 'Super Admin';
  if (role === 'team_admin' || role === 'teamadmin' || role === 'team_admins') return 'Team Admin';
  if (role === 'recruitpro') return 'Recruit Pro';
  if (role === 'admin') return 'Admin';
  if (role === 'member' || role === 'members') return 'Member';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function avatarFallbackForName(name: string) {
  const clean = String(name || '').trim() || 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(clean)}&background=random`;
}

const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: 'sourcing_agent',
    name: 'Sourcing Agent',
    subtitle: 'Personas, schedules, and Sniper sourcing',
    status: 'active',
    icon: 'fa-magnifying-glass',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    links: [
      'https://app.thehirepilot.com/agent/advanced/personas',
      'https://app.thehirepilot.com/agent/advanced/schedules',
      'https://app.thehirepilot.com/sniper'
    ],
    capabilities: [
      'Translate hiring goals into persona and search plans',
      'Run linked sourcing workflows across LinkedIn, Indeed, and Sniper',
      'Schedule recurring sourcing cadences with dependency-aware execution',
      'Generate candidate shortlists, prioritization notes, and handoff artifacts'
    ],
    guides: [
      'Start with role + geo + seniority + must-have skills',
      'Set source mix strategy: broad (Indeed) + precision (LinkedIn)',
      'Use minimum-results thresholds with retry/backoff policy',
      'Publish artifacts as candidate profiles and quality summaries'
    ],
    recipes: [
      'Recipe: Build 3 sourcing personas, run parallel discovery, merge by score',
      'Recipe: Source 100 profiles, enrich top 40, deliver top 15 shortlist',
      'Recipe: Run daily sniper capture and weekly quality refresh'
    ],
    instructions: [
      'Prefer concrete filters and explicit source targets',
      'Always include output counts and quality caveats',
      'When blocked, propose fallback source strategy instead of stopping'
    ]
  },
  {
    id: 'sales_agent',
    name: 'Sales Agent',
    subtitle: 'Campaign orchestration and inbox execution',
    status: 'active',
    icon: 'fa-chart-line',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    links: [
      'https://app.thehirepilot.com/agent/advanced/campaigns',
      'https://app.thehirepilot.com/agent/advanced/inbox'
    ],
    capabilities: [
      'Design outbound campaign plans and sequence structures',
      'Map intent segments to message variants and CTA paths',
      'Optimize inbox triage and response playbooks',
      'Track campaign conversion signals and propose iteration loops'
    ],
    guides: [
      'Define ICP + value hypothesis before drafting sequences',
      'Split campaign by persona and stage-aware objection handling',
      'Include inbox handling rules for reply categories',
      'Summarize expected KPIs, risks, and tuning checkpoints'
    ],
    recipes: [
      'Recipe: 3-touch outbound sequence with persona-specific variants',
      'Recipe: Build campaign + inbox triage matrix + next-step actions',
      'Recipe: Weekly campaign optimization loop from reply signals'
    ],
    instructions: [
      'Keep messaging specific, measurable, and persona-aware',
      'Show assumptions and expected conversion trade-offs',
      'When uncertain, ask for offer positioning and audience constraints'
    ]
  }
];

function buildAgentOptimizedPrompt(userPrompt: string, agent: AgentProfile, attachments: UploadedAttachment[]) {
  const parts: string[] = [userPrompt];

  if (agent.capabilities.length) {
    parts.push(`\n(Agent: ${agent.name} — ${agent.capabilities.slice(0, 3).join('; ')})`);
  }

  if (attachments.length) {
    const attachSummary = attachments.map((a) => `- ${a.name}${a.text ? `\n${String(a.text).slice(0, 2500)}` : ''}`).join('\n');
    parts.push(`\nAttachments:\n${attachSummary}`);
  }

  return parts.join('');
}

export default function REXChat() {
  const [userName, setUserName] = useState('Alex Chen');
  const [userRoleLabel, setUserRoleLabel] = useState('Member');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>(DEFAULT_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENTS[0]?.id || 'sourcing_agent');
  const [conversations, setConversations] = useState<RexConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [planJson, setPlanJson] = useState<PlanJson | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<'queued' | 'running' | 'success' | 'failure' | 'cancelled' | 'idle'>('idle');
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);
  const [runArtifacts, setRunArtifacts] = useState<RunArtifact[]>([]);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'plan' | 'execution' | 'artifacts'>('plan');
  const [userCreditsRemaining, setUserCreditsRemaining] = useState<number | null>(null);
  const [rexThinking, setRexThinking] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState<'idle' | 'thinking' | 'tools' | 'responding'>('idle');
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileConsoleOpen, setMobileConsoleOpen] = useState(false);
  const [completedTools, setCompletedTools] = useState<Array<{ name: string; id: string }>>([]);
  const [showScrollFab, setShowScrollFab] = useState(false);

  const streamAbortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const allowReconnectRef = useRef(false);
  const streamTokenRef = useRef<string>('');
  const streamRunIdRef = useRef<string>('');
  const messagesScrollerRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const planSteps = useMemo(() => {
    if (runProgress?.steps?.length) return runProgress.steps;
    return (planJson?.steps || []).map((s) => ({
      step_id: s.step_id,
      status: (s.status || 'queued') as RunProgressStep['status'],
      progress: { percent: 0, current: 0, total: planJson.steps.length, label: 'Queued' },
      results: {}
    }));
  }, [runProgress, planJson]);

  const stepsTotal = Math.max(1, Number(runProgress?.counters?.steps_total || planSteps.length || 1));
  const stepsCompleted = Number(
    runProgress?.counters?.steps_completed ||
    planSteps.filter((s) => s.status === 'success' || s.status === 'skipped').length
  );
  const stepProgressPercent = Math.max(0, Math.min(100, Math.round((stepsCompleted / stepsTotal) * 100)));

  function cleanupStream() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    allowReconnectRef.current = false;
  }

  function closeMobilePanels() {
    setMobileSidebarOpen(false);
    setMobileConsoleOpen(false);
  }

  function openMobileSidebar() {
    setMobileConsoleOpen(false);
    setMobileSidebarOpen(true);
  }

  function openMobileConsole() {
    setMobileSidebarOpen(false);
    setMobileConsoleOpen(true);
  }

  function applyRunSnapshot(payload: any) {
    const progress = payload?.progress_json || {};
    const artifacts = payload?.artifacts_json || {};
    const stats = payload?.stats_json || {};
    setRunStatus((payload?.status || progress?.status || 'queued') as any);
    setRunProgress(progress || null);
    setRunArtifacts(Array.isArray(artifacts?.items) ? artifacts.items : []);
    setRunStats(stats || null);
    setToolCalls(Array.isArray(stats?.toolcalls) ? stats.toolcalls : []);
  }

  function applyStepUpdated(payload: any) {
    setRunProgress((prev) => {
      const base: RunProgress = prev && typeof prev === 'object' ? { ...prev } : { steps: [], counters: {} };
      const currentSteps = Array.isArray(base.steps) ? [...base.steps] : [];
      const idx = currentSteps.findIndex((s) => s.step_id === payload?.step_id);
      const patch: RunProgressStep = {
        step_id: String(payload?.step_id || ''),
        status: (payload?.status || 'running') as any,
        progress: payload?.progress || {},
        results: payload?.results || {}
      };
      if (idx >= 0) currentSteps[idx] = { ...currentSteps[idx], ...patch };
      else currentSteps.push(patch);
      const done = currentSteps.filter((s) => s.status === 'success' || s.status === 'skipped').length;
      return {
        ...base,
        status: (payload?.status === 'failure' ? 'failure' : (base.status || 'running')) as any,
        current_step_id: payload?.step_id || base.current_step_id || null,
        counters: {
          ...(base.counters || {}),
          steps_total: Math.max(currentSteps.length, Number(base?.counters?.steps_total || 0)),
          steps_completed: done
        },
        steps: currentSteps
      };
    });
  }

  function upsertToolCall(nextCall: ToolCall) {
    setToolCalls((prev) => {
      const idx = prev.findIndex((t) => t.toolcall_id === nextCall.toolcall_id);
      if (idx < 0) return [...prev, nextCall];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...nextCall };
      return copy;
    });
  }

  function upsertArtifact(nextArtifact: RunArtifact) {
    setRunArtifacts((prev) => {
      const idx = prev.findIndex((a) => a.artifact_id === nextArtifact.artifact_id);
      if (idx < 0) return [...prev, nextArtifact];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...nextArtifact };
      return copy;
    });
  }

  function handleSseEnvelope(raw: string) {
    if (!raw) return;
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const type = String(parsed?.type || '');
    const payload = parsed?.payload || {};
    if (type === 'run.snapshot') {
      applyRunSnapshot(payload);
      return;
    }
    if (type === 'step.updated') {
      applyStepUpdated(payload);
      return;
    }
    if (type === 'toolcall.logged' && payload?.toolcall) {
      upsertToolCall(payload.toolcall as ToolCall);
      return;
    }
    if (type === 'artifact.created' && payload?.artifact) {
      upsertArtifact(payload.artifact as RunArtifact);
      return;
    }
    if (type === 'run.started') {
      setRunStatus('running');
      return;
    }
    if (type === 'run.completed') {
      setRunStatus('success');
      allowReconnectRef.current = false;
      return;
    }
    if (type === 'run.failed') {
      setRunStatus('failure');
      allowReconnectRef.current = false;
      return;
    }
  }

  function connectRunStream(nextRunId: string, accessToken: string) {
    cleanupStream();
    allowReconnectRef.current = true;
    streamRunIdRef.current = nextRunId;
    streamTokenRef.current = accessToken;
    reconnectAttemptsRef.current = 0;

    const open = () => {
      const base = import.meta.env.VITE_BACKEND_URL || '';
      const url = `${base}/api/rex2/runs/${encodeURIComponent(streamRunIdRef.current)}/stream?access_token=${encodeURIComponent(streamTokenRef.current)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      const onEvent = (evt: MessageEvent) => {
        handleSseEnvelope(evt.data);
      };

      es.onmessage = onEvent;
      es.addEventListener('run.snapshot', onEvent as any);
      es.addEventListener('step.updated', onEvent as any);
      es.addEventListener('toolcall.logged', onEvent as any);
      es.addEventListener('artifact.created', onEvent as any);
      es.addEventListener('run.started', onEvent as any);
      es.addEventListener('run.completed', onEvent as any);
      es.addEventListener('run.failed', onEvent as any);

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        if (!allowReconnectRef.current) return;
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(30000, 2000 * (2 ** Math.min(reconnectAttemptsRef.current, 4)));
        reconnectTimeoutRef.current = window.setTimeout(() => {
          open();
        }, delay);
      };
    };

    open();
  }

  async function loadConversations() {
    const list = await listConversations();
    setConversations(list);
    if (!activeConversationId && list[0]?.id) {
      setActiveConversationId(list[0].id);
    }
  }

  async function loadConversationMessages(conversationId: string) {
    const rows = await fetchMessages(conversationId);
    const mapped: UiMessage[] = rows.map((m) => ({
      id: m.id,
      sender: m.role === 'user' ? 'user' : 'rex',
      content: typeof m.content === 'string' ? m.content : (m.content?.text || '')
    }));
    setMessages(mapped);
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const meta = (user.user_metadata as any) || {};
          const appMeta = (user.app_metadata as any) || {};
          const metaName = String(
            meta?.full_name ||
            meta?.name ||
            `${meta?.first_name || ''} ${meta?.last_name || ''}`.trim() ||
            user.email ||
            'Alex Chen'
          );
          setUserName(metaName);
          setUserAvatarUrl(String(meta?.avatar_url || meta?.picture || '').trim());
          const roleRaw = String(appMeta?.role || meta?.role || meta?.account_type || '');
          setUserRoleLabel(normalizeRoleLabel(roleRaw));

          try {
            const { data: dbProfile } = await supabase
              .from('users')
              .select('first_name,last_name,full_name,avatar_url,role,account_type')
              .eq('id', user.id)
              .maybeSingle();
            if (dbProfile) {
              const dbName = String(
                (dbProfile as any).full_name ||
                `${(dbProfile as any).first_name || ''} ${(dbProfile as any).last_name || ''}`.trim() ||
                metaName
              ).trim();
              if (dbName) setUserName(dbName);
              const dbAvatar = String((dbProfile as any).avatar_url || '').trim();
              if (dbAvatar) setUserAvatarUrl(dbAvatar);
              const dbRoleRaw = String((dbProfile as any).role || (dbProfile as any).account_type || roleRaw);
              if (dbRoleRaw) setUserRoleLabel(normalizeRoleLabel(dbRoleRaw));
            }
          } catch {}
        }
      } catch {}
      await loadConversations();
      try {
        const remoteAgents = await fetchRex2Agents();
        if (Array.isArray(remoteAgents) && remoteAgents.length) {
          setAgentProfiles(remoteAgents);
          setSelectedAgentId((prev) => (
            remoteAgents.some((a) => a.id === prev) ? prev : remoteAgents[0].id
          ));
        }
      } catch {}
      await loadUserCredits();
    })();
    return () => cleanupStream();
  }, []);

  useEffect(() => {
    if (!agentProfiles.length) return;
    if (!agentProfiles.some((a) => a.id === selectedAgentId)) {
      setSelectedAgentId(agentProfiles[0].id);
    }
  }, [agentProfiles, selectedAgentId]);

  useEffect(() => {
    if (!activeConversationId) return;
    loadConversationMessages(activeConversationId).catch(() => {});
  }, [activeConversationId]);

  useEffect(() => {
    const el = messagesScrollerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 200 || isStreaming) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: isStreaming ? 'auto' : 'smooth'
      });
    }
  }, [messages, planJson, runProgress, toolCalls, runArtifacts, isStreaming]);

  useEffect(() => {
    const el = messagesScrollerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollFab(dist > 200);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadUserCredits().catch(() => {});
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (runStatus === 'success' || runStatus === 'failure' || runStatus === 'cancelled') {
      loadUserCredits().catch(() => {});
    }
  }, [runStatus]);

  async function ensureConversation(seedTitle: string) {
    if (activeConversationId) return activeConversationId;
    const conv = await createConversation(seedTitle.slice(0, 120));
    setActiveConversationId(conv.id);
    await loadConversations();
    return conv.id;
  }

  async function sendPlannerMessage() {
    const text = input.trim();
    if (!text || sending || uploadingAttachment) return;
    setSending(true);
    setRexThinking(true);
    setStreamingPhase('thinking');
    setIsStreaming(false);
    setInput('');

    const userMsg: UiMessage = {
      id: makeId('m_user'),
      sender: 'user',
      content: attachments.length ? `${text}\n\n[Attachments: ${attachments.map((a) => a.name).join(', ')}]` : text
    };
    setMessages((prev) => [...prev, userMsg]);

    const streamMsgId = makeId('m_rex_stream');

    try {
      const conversationId = await ensureConversation(text);
      const optimizedPrompt = buildAgentOptimizedPrompt(text, selectedAgent, attachments);

      // Persist user message
      await postMessage(conversationId, 'user', {
        text,
        agent_mode: selectedAgent.id,
        optimized_prompt: optimizedPrompt,
        attachments: attachments.map((a) => ({
          name: a.name,
          text: a.text || '',
          url: a.url || null,
          mime: a.mime || null,
          size: a.size || null
        }))
      });

      const { data: { user } } = await supabase.auth.getUser();

      let accumulated = '';
      let finalContent = '';
      let receivedFirstToken = false;

      const eventStream = chatStreamSse(
        user?.id || '',
        conversationId,
        [...messages, userMsg].map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.sender === 'user' && m.id === userMsg.id ? optimizedPrompt : m.content
        })),
        {
          activeAgent: selectedAgent.id,
          activeAgentName: selectedAgent.name,
          attachments: attachments.map((a) => ({ name: a.name, url: a.url || null }))
        }
      );

      for await (const { event, data } of eventStream) {
        switch (event) {
          case 'status': {
            setStreamingPhase(data.phase || 'thinking');
            if (data.phase === 'tools') {
              // Show thinking indicator again during tool execution
              setRexThinking(true);
              setIsStreaming(false);
            }
            break;
          }
          case 'token': {
            if (!receivedFirstToken) {
              receivedFirstToken = true;
              setRexThinking(false);
              setIsStreaming(true);
              setMessages((prev) => [...prev, {
                id: streamMsgId,
                sender: 'rex',
                content: data.t,
                streaming: true,
              }]);
            } else {
              setMessages((prev) => prev.map((m) =>
                m.id === streamMsgId
                  ? { ...m, content: m.content + data.t }
                  : m
              ));
            }
            accumulated += data.t;
            break;
          }
          case 'tool_start': {
            setActiveToolName(data.name || null);
            break;
          }
          case 'tool_end': {
            setCompletedTools(prev => [...prev, { name: data.name || 'tool', id: makeId('tc') }]);
            setActiveToolName(null);
            break;
          }
          case 'replace': {
            finalContent = data.full_content;
            if (receivedFirstToken) {
              setMessages((prev) => prev.map((m) =>
                m.id === streamMsgId
                  ? { ...m, content: data.full_content, streaming: false }
                  : m
              ));
            }
            break;
          }
          case 'done': {
            finalContent = data.full_content || accumulated;
            setMessages((prev) => {
              if (!receivedFirstToken) {
                return [...prev, {
                  id: streamMsgId,
                  sender: 'rex' as const,
                  content: finalContent,
                  streaming: false,
                }];
              }
              return prev.map((m) =>
                m.id === streamMsgId
                  ? { ...m, content: finalContent, streaming: false }
                  : m
              );
            });
            break;
          }
          case 'error': {
            setMessages((prev) => [...prev, {
              id: makeId('m_err'),
              sender: 'rex' as const,
              content: data.message || 'Something went wrong.',
            }]);
            break;
          }
        }
      }

      // Backend persists the message; also persist from frontend for the agent_mode metadata
      await postMessage(conversationId, 'assistant', { text: finalContent, agent_mode: selectedAgent.id }).catch(() => {});

      setPlanJson(buildPlanFromText(text, finalContent, conversationId));
      setActiveConsoleTab('plan');
      setRunId(null);
      setRunStatus('idle');
      setRunProgress(null);
      setRunArtifacts([]);
      setToolCalls([]);
      setRunStats(null);
      setAttachments([]);
    } catch (e) {
      setMessages((prev) => [...prev, { id: makeId('m_err'), sender: 'rex', content: 'Failed to generate plan. Please try again.' }]);
    } finally {
      setSending(false);
      setRexThinking(false);
      setIsStreaming(false);
      setStreamingPhase('idle');
      setActiveToolName(null);
      setCompletedTools([]);
      streamAbortRef.current = null;
      await loadConversations().catch(() => {});
    }
  }

  async function approvePlan() {
    if (!planJson || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { id: makeId('m_user'), sender: 'user', content: 'Looks good! Execute the plan.' }]);
    setMessages((prev) => [...prev, { id: makeId('m_rex'), sender: 'rex', content: 'Executing workflow... I am currently running the approved recruiting plan.' }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const createResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/rex2/runs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plan_json: planJson,
          conversation_id: activeConversationId || null,
          campaign_id: null
        })
      });
      const createData = await createResp.json().catch(() => ({}));
      const createdRunId = String(createData?.run?.id || '');
      if (!createdRunId) throw new Error(createData?.error || 'failed_to_create_run');
      setRunId(createdRunId);
      setRunStatus('queued');

      const startResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/rex2/runs/${encodeURIComponent(createdRunId)}/start`, {
        method: 'POST',
        headers
      });
      if (!startResp.ok) {
        const startErr = await startResp.json().catch(() => ({}));
        throw new Error(startErr?.error || 'failed_to_start_run');
      }

      setRunStatus('running');
      setActiveConsoleTab('plan');
      if (token) connectRunStream(createdRunId, token);
    } catch (e: any) {
      setRunStatus('failure');
      setMessages((prev) => [...prev, { id: makeId('m_err'), sender: 'rex', content: `Run start failed: ${e?.message || 'Unknown error'}` }]);
    } finally {
      setSending(false);
    }
  }

  const conversationItems = useMemo(
    () =>
      conversations.map((c) => ({
        id: c.id,
        title: c.title || 'New chat',
        subtitle: `Updated ${new Date(c.updated_at).toLocaleString()}`
      })),
    [conversations]
  );

  const currentGoal = planJson?.goal?.description || 'No plan generated yet.';
  const estimatedCredits = runStats?.credits?.estimated ?? planJson?.estimates?.credits?.max ?? 0;
  const creditsUsed = runStats?.credits?.used ?? 0;
  const etaSeconds = runStats?.timing?.eta_seconds ?? 0;
  const activeStepIndex = Math.max(
    0,
    planSteps.findIndex((s) => s.step_id === runProgress?.current_step_id)
  );
  const planStepById = useMemo(() => {
    const map = new Map<string, PlanStep>();
    (planJson?.steps || []).forEach((s) => map.set(String(s.step_id), s));
    return map;
  }, [planJson]);
  const runningStep = useMemo(
    () => (runProgress?.steps || []).find((s) => s.status === 'running') || null,
    [runProgress]
  );
  const recentToolCalls = useMemo(
    () => [...toolCalls].slice(-3).reverse(),
    [toolCalls]
  );
  const creditsRemainingDisplay = useMemo(() => {
    if (typeof userCreditsRemaining === 'number' && Number.isFinite(userCreditsRemaining)) {
      return Math.max(0, Math.floor(userCreditsRemaining));
    }
    const runRemaining = Number(runStats?.credits?.remaining);
    if (Number.isFinite(runRemaining)) return Math.max(0, Math.floor(runRemaining));
    return 0;
  }, [userCreditsRemaining, runStats]);
  const selectedAgent = useMemo(
    () => agentProfiles.find((agent) => agent.id === selectedAgentId) || agentProfiles[0] || DEFAULT_AGENTS[0],
    [selectedAgentId, agentProfiles]
  );

  async function loadUserCredits() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/credits/status`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const remaining = Number(data?.remaining_credits);
      if (Number.isFinite(remaining)) {
        setUserCreditsRemaining(Math.max(0, remaining));
      }
    } catch {}
  }

  async function uploadAttachment(file: File) {
    setUploadingAttachment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/rex/uploads`, {
        method: 'POST',
        headers,
        body: form
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'upload_failed');
      const nextItem: UploadedAttachment = {
        name: data?.name || file.name,
        text: data?.text || '',
        url: data?.url || undefined,
        mime: data?.mime || file.type || undefined,
        size: Number(data?.size || file.size || 0) || undefined
      };
      setAttachments((prev) => [...prev, nextItem]);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId('m_attachment'),
          sender: 'rex',
          content: `Attached file: ${nextItem.name}. I will use it for the next prompt.`
        }
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId('m_attachment_err'),
          sender: 'rex',
          content: `Attachment upload failed: ${e?.message || 'Unknown error'}`
        }
      ]);
    } finally {
      setUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  }

  function renderAssistantMessage(content: string, streaming?: boolean) {
    return (
      <div className="bg-dark-900 border border-dark-800 rounded-2xl rounded-tl-sm shadow-xl px-5 py-4">
        <MarkdownContent content={content} streaming={streaming} />
      </div>
    );
  }

  return (
    <div id="rex-container" className="relative flex h-screen overflow-hidden bg-dark-950 text-gray-100 font-sans antialiased">
      {(mobileSidebarOpen || mobileConsoleOpen) && (
        <button
          type="button"
          aria-label="Close overlay"
          className="absolute inset-0 z-20 bg-black/50 lg:hidden"
          onClick={closeMobilePanels}
        />
      )}

      <aside
        id="sidebar"
        className={`bg-dark-900 border-r border-dark-800 flex flex-col ${
          mobileSidebarOpen
            ? 'absolute inset-y-0 left-0 z-30 w-[280px] lg:static lg:z-auto'
            : 'hidden'
        } lg:flex lg:w-[280px]`}
      >
        <div id="sidebar-header" className="p-4 border-b border-dark-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-robot text-white text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">REX</h1>
              <p className="text-xs text-gray-400">Agent Console</p>
            </div>
          </div>
          <button
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
            onClick={async () => {
              closeMobilePanels();
              cleanupStream();
              const conv = await createConversation('New chat');
              setActiveConversationId(conv.id);
              setMessages([]);
              setPlanJson(null);
              setRunId(null);
              setRunStatus('idle');
              setRunProgress(null);
              setRunArtifacts([]);
              setToolCalls([]);
              setRunStats(null);
              await loadConversations();
            }}
          >
            <i className="fa-solid fa-plus" />
            New Conversation
          </button>
        </div>

        <div id="saved-agents" className="px-3 py-4 border-b border-dark-800">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-3">Saved Agents</h3>
          {agentProfiles.map((a) => {
            const selected = selectedAgentId === a.id;
            return (
            <div
              key={a.id}
              className={`agent-item rounded-lg p-3 mb-2 cursor-pointer transition-all duration-150 border ${
                selected
                  ? 'bg-dark-700 border-purple-500/40'
                  : 'bg-dark-800 hover:bg-dark-700 border-transparent hover:border-purple-500/30'
              }`}
              onClick={() => {
                setSelectedAgentId(a.id);
                if (mobileSidebarOpen) closeMobilePanels();
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 ${a.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <i className={`fa-solid ${a.icon} ${a.iconColor} text-sm`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-white truncate">{a.name}</h4>
                    <span className={`w-2 h-2 ${a.status === 'active' ? 'bg-green-500' : a.status === 'running' ? 'bg-purple-500' : 'bg-gray-500'} rounded-full flex-shrink-0`} />
                  </div>
                  <p className="text-xs text-gray-400">{a.subtitle}</p>
                </div>
              </div>
            </div>
          );})}
          <div className="mt-3 bg-dark-800/60 border border-dark-700 rounded-lg p-3">
            <p className="text-xs text-purple-300 font-semibold mb-2">Active: {selectedAgent.name}</p>
            <p className="text-[11px] text-gray-400 mb-2">
              REX will optimize your prompt with this agent's capabilities, recipes, and execution instructions.
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Capabilities</p>
                <p className="text-[11px] text-gray-300 leading-relaxed">{selectedAgent.capabilities.slice(0, 2).join(' • ')}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Guides</p>
                <p className="text-[11px] text-gray-300 leading-relaxed">{selectedAgent.guides.slice(0, 2).join(' • ')}</p>
              </div>
            </div>
          </div>
        </div>

        <div id="conversations" className="flex-1 overflow-y-auto px-3 py-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-3">Conversations</h3>
          {conversationItems.map((c) => (
            <div
              key={c.id}
              className={`conversation-item rounded-lg p-3 mb-2 cursor-pointer transition-all duration-150 border ${
                activeConversationId === c.id
                  ? 'bg-dark-800 border-purple-500/20'
                  : 'bg-dark-800/50 hover:bg-dark-800 border-transparent'
              }`}
              onClick={() => {
                setActiveConversationId(c.id);
                if (mobileSidebarOpen) closeMobilePanels();
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="text-sm font-medium text-white truncate flex-1">{c.title}</h4>
                {activeConversationId === c.id && (
                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded ml-2 flex-shrink-0">Active</span>
                )}
              </div>
              <p className="text-xs text-gray-400">{c.subtitle}</p>
            </div>
          ))}
        </div>

        <div id="sidebar-footer" className="p-3 border-t border-dark-800">
          <div className="flex items-center gap-3 p-2 hover:bg-dark-800 rounded-lg cursor-pointer transition-all duration-150">
            <img
              src={userAvatarUrl || avatarFallbackForName(userName)}
              alt="User"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.src = avatarFallbackForName(userName);
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-gray-400">{userRoleLabel}</p>
            </div>
            <i className="fa-solid fa-ellipsis-vertical text-gray-400" />
          </div>
        </div>
      </aside>

      <main id="chat-panel" className="flex-1 flex flex-col bg-dark-950 min-w-0 relative">
        <header id="chat-header" className="h-16 border-b border-dark-800 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150"
              onClick={openMobileSidebar}
            >
              <i className="fa-solid fa-bars" />
            </button>
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">{planJson?.goal?.title || 'REX Recruiting Console'}</h2>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
              Agent Mode: {selectedAgent.name}
            </span>
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
              {runStatus === 'running' ? 'Active' : runStatus === 'success' ? 'Completed' : 'Ready'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150">
              <i className="fa-solid fa-clock-rotate-left mr-1.5" />
              History
            </button>
            <button className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150">
              <i className="fa-solid fa-share-nodes mr-1.5" />
              Share
            </button>
            <button
              className="xl:hidden p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150"
              onClick={openMobileConsole}
            >
              <i className="fa-solid fa-list-check" />
            </button>
          </div>
        </header>

        <div id="chat-messages" className="flex-1 overflow-y-auto px-6 py-6" ref={messagesScrollerRef}>
          <AnimatePresence mode="wait">
            {messages.length === 0 && !rexThinking ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center h-full text-center px-4"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                  <i className="fa-solid fa-robot text-white text-2xl" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Hey {userName.split(' ')[0]}, what can I help with?
                </h2>
                <p className="text-sm text-gray-400 mb-8 max-w-md">
                  I can source candidates, set up campaigns, analyze resumes, and automate your recruiting workflows.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.label}
                      className="text-left px-4 py-3 bg-dark-900 border border-dark-700 hover:border-purple-500/40 rounded-xl text-sm text-gray-300 hover:text-white transition-all duration-200 group"
                      onClick={() => setInput(prompt.text)}
                    >
                      <i className={`fa-solid ${prompt.icon} text-purple-400 mr-2 group-hover:text-purple-300`} />
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="messages"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <AnimatePresence mode="popLayout">
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="message-group mb-8"
                    >
                      {m.sender === 'user' ? (
                        <div className="flex justify-end mb-4">
                          <div className="max-w-2xl bg-purple-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-lg">
                            <p className="text-sm leading-relaxed">{m.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 mb-4">
                          <div className={`w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1${m.streaming ? ' animate-pulse' : ''}`}>
                            <i className="fa-solid fa-robot text-white text-sm" />
                          </div>
                          <div className="flex-1 max-w-3xl">
                            {renderAssistantMessage(m.content, m.streaming)}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                <AnimatePresence>
                  {rexThinking && !isStreaming && (
                    <motion.div
                      key="rex-thinking"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="message-group mb-8"
                    >
                      <div className="flex gap-3 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 animate-pulse">
                          <i className="fa-solid fa-robot text-white text-sm" />
                        </div>
                        <div className="flex-1 max-w-3xl">
                          <div className="bg-dark-900 border border-dark-800 rounded-2xl rounded-tl-sm shadow-xl px-5 py-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                              <p className="text-sm font-medium text-white">
                                {streamingPhase === 'tools'
                                  ? 'Running tools...'
                                  : streamingPhase === 'responding'
                                    ? 'Composing response...'
                                    : 'REX is thinking...'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                              <span>{streamingPhase === 'tools' ? 'Executing' : 'Thinking'}</span>
                              <span className="inline-flex items-end gap-1">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
                              </span>
                              <span className="text-purple-400 animate-pulse">|</span>
                            </div>
                            {(activeToolName || completedTools.length > 0) && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                <AnimatePresence>
                                  {completedTools.slice(-3).map((tool) => (
                                    <motion.span
                                      key={tool.id}
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.2 }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400"
                                    >
                                      <i className="fa-solid fa-circle-check" />
                                      {humanizeToolName(tool.name)}
                                    </motion.span>
                                  ))}
                                  {activeToolName && (
                                    <motion.span
                                      key={`active-${activeToolName}`}
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.8 }}
                                      transition={{ duration: 0.2 }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-300"
                                    >
                                      <div className="w-3 h-3 border-[1.5px] border-purple-400 border-t-transparent rounded-full animate-spin" />
                                      {humanizeToolName(activeToolName)}
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {planJson && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="message-group mb-8"
                  >
                    <div className="flex gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <i className="fa-solid fa-robot text-white text-sm" />
                      </div>
                      <div className="flex-1 max-w-3xl">
                        <div className="bg-dark-900 border border-dark-800 rounded-2xl rounded-tl-sm shadow-xl">
                          <div className="px-5 py-4 border-b border-dark-800">
                            <div className="flex items-center gap-2 mb-3">
                              <i className="fa-solid fa-brain text-purple-400" />
                              <h3 className="text-sm font-semibold text-white">Here&apos;s how I plan to approach this</h3>
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed mb-4">{planJson.goal.description}</p>
                            <div className="space-y-2.5">
                              {planJson.steps.map((step, idx) => (
                                <div key={step.step_id} className="flex gap-3">
                                  <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-semibold text-purple-400">{idx + 1}</span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-200 font-medium">{step.title}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="px-5 py-4 bg-dark-800/30">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <i className="fa-solid fa-coins text-amber-400" />
                                <span>
                                  Est. Credits: <span className="text-white font-semibold">~{planJson.estimates.credits.max}</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <i className="fa-solid fa-clock text-blue-400" />
                                <span>
                                  Est. Time: <span className="text-white font-semibold">~{planJson.estimates.time.max_minutes} min</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <i className="fa-solid fa-shield-halved text-green-400" />
                                <span>
                                  Risk: <span className="text-green-400 font-semibold">{planJson.estimates.risk.level}</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <button
                                disabled={sending || runStatus === 'running'}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-purple-500/20"
                                onClick={approvePlan}
                              >
                                <i className="fa-solid fa-check mr-2" />
                                Approve Plan
                              </button>
                              <button className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium text-sm transition-all duration-200 border border-dark-600">
                                <i className="fa-solid fa-pen mr-2" />
                                Edit Plan
                              </button>
                              <button
                                className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white rounded-lg font-medium text-sm transition-all duration-200 border border-dark-600"
                                onClick={() => {
                                  setPlanJson(null);
                                  setRunId(null);
                                  setRunStatus('idle');
                                  setRunProgress(null);
                                  setRunArtifacts([]);
                                  setToolCalls([]);
                                  setRunStats(null);
                                  cleanupStream();
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scroll-to-bottom FAB */}
        <AnimatePresence>
          {showScrollFab && (
            <motion.button
              key="scroll-fab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                messagesScrollerRef.current?.scrollTo({
                  top: messagesScrollerRef.current.scrollHeight,
                  behavior: 'smooth'
                });
              }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-dark-800 border border-dark-700 hover:border-purple-500/40 rounded-full shadow-lg text-sm text-gray-300 hover:text-white transition-all duration-200 flex items-center gap-2"
            >
              <i className="fa-solid fa-arrow-down text-purple-400" />
              Jump to latest
            </motion.button>
          )}
        </AnimatePresence>

        <div id="chat-input-container" className="border-t border-dark-800 p-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachments.map((att, idx) => (
                  <span
                    key={`${att.name}_${idx}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-800 border border-dark-700 text-xs text-gray-200"
                  >
                    <i className="fa-solid fa-file-lines text-blue-400" />
                    <span className="max-w-[220px] truncate">{att.name}</span>
                    <button
                      className="text-gray-500 hover:text-white"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      title="Remove attachment"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <textarea
                placeholder="Ask REX to find candidates, create workflows, or automate your recruiting..."
                className="w-full bg-dark-900 border border-dark-700 focus:border-purple-500 rounded-xl px-5 py-4 pr-24 text-sm text-white placeholder-gray-500 resize-none focus:outline-none transition-all duration-200 shadow-lg"
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    sendPlannerMessage();
                  }
                }}
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150 disabled:opacity-50"
                  title="Attach file"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={uploadingAttachment || sending}
                >
                  <i className="fa-solid fa-paperclip" />
                </button>
                <button
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-purple-500/20"
                  onClick={sendPlannerMessage}
                  disabled={sending || uploadingAttachment || !input.trim()}
                >
                  <i className="fa-solid fa-paper-plane" />
                </button>
              </div>
            </div>
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                (async () => {
                  for (const file of files) {
                    await uploadAttachment(file);
                  }
                })();
              }}
            />
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-coins text-amber-400" />
                  <span>{creditsRemainingDisplay} credits remaining</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info text-blue-400" />
                  <span>{uploadingAttachment ? 'Uploading attachment...' : `${attachments.length} attachment(s)`}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-bolt text-purple-400" />
                  <span>MCP Tools Active</span>
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-dark-800 border border-dark-700 rounded text-gray-400">⌘</kbd> +{' '}
                <kbd className="px-1.5 py-0.5 bg-dark-800 border border-dark-700 rounded text-gray-400">Enter</kbd> to send
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside
        id="agent-console"
        className={`bg-dark-900 border-l border-dark-800 flex flex-col ${
          mobileConsoleOpen
            ? 'absolute inset-y-0 right-0 z-30 w-[90%] max-w-[420px] xl:static xl:z-auto'
            : 'hidden'
        } xl:flex xl:w-[420px]`}
      >
        <div id="console-header" className="h-16 border-b border-dark-800 flex items-center justify-between px-5 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">Agent Console</h2>
          <button
            className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150"
            onClick={closeMobilePanels}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div id="console-tabs" className="border-b border-dark-800 flex">
          {[
            { id: 'plan', icon: 'fa-list-check', label: 'Plan' },
            { id: 'execution', icon: 'fa-bolt', label: 'Execution' },
            { id: 'artifacts', icon: 'fa-cube', label: 'Artifacts' }
          ].map((tab) => {
            const selected = activeConsoleTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150 ${
                  selected
                    ? 'text-white bg-dark-800 border-purple-500'
                    : 'text-gray-400 hover:text-white hover:bg-dark-800/50 border-transparent'
                }`}
                onClick={() => setActiveConsoleTab(tab.id as any)}
              >
                <i className={`fa-solid ${tab.icon} mr-2`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div id="console-content" className="flex-1 overflow-y-auto p-5">
          {activeConsoleTab === 'plan' && (
            <div id="plan-view">
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Agent Playbook</h3>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">{selectedAgent.name}</span>
                </div>
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Capabilities</p>
                    <ul className="space-y-1">
                      {selectedAgent.capabilities.map((item) => (
                        <li key={item} className="text-xs text-gray-300">- {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Guides and Recipes</p>
                    <ul className="space-y-1">
                      {selectedAgent.guides.concat(selectedAgent.recipes).map((item) => (
                        <li key={item} className="text-xs text-gray-300">- {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Operating Instructions</p>
                    <ul className="space-y-1">
                      {selectedAgent.instructions.map((item) => (
                        <li key={item} className="text-xs text-gray-300">- {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Linked Product Areas</p>
                    <ul className="space-y-1">
                      {selectedAgent.links.map((item) => (
                        <li key={item} className="text-xs text-blue-300 truncate">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Current Plan</h3>
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full capitalize">
                    {runStatus === 'idle' ? 'Ready' : runStatus}
                  </span>
                </div>
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
                  <p className="text-xs text-gray-300 leading-relaxed mb-3">{currentGoal}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-400">Steps: <span className="text-white font-semibold">{stepsTotal}</span></span>
                    <span className="text-gray-400">Tools: <span className="text-white font-semibold">{Math.max(0, toolCalls.length)}</span></span>
                    <span className="text-gray-400">Credits: <span className="text-white font-semibold">~{estimatedCredits}</span></span>
                  </div>
                  {runId && (
                    <p className="text-[11px] text-gray-500 mt-2">Run ID: {runId}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white mb-3">Execution Steps</h3>
                {planSteps.map((step, idx) => {
                  const progress = step.progress || {};
                  const percent = Number(progress.percent || (step.status === 'success' ? 100 : 0));
                  const current = Number(progress.current || 0);
                  const total = Number(progress.total || stepsTotal);
                  const title = (planJson?.steps || []).find((s) => s.step_id === step.step_id)?.title || step.step_id;
                  const description = (planJson?.steps || []).find((s) => s.step_id === step.step_id)?.description || '';
                  if (step.status === 'success') {
                    return (
                      <div key={step.step_id} className="step-card bg-dark-800 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-check text-white text-xs" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-white mb-1">{title}</h4>
                            <p className="text-xs text-gray-400">Completed</p>
                          </div>
                        </div>
                        <div className="ml-9">
                          <div className="bg-dark-900 rounded px-3 py-2 text-xs text-gray-300">
                            <p className="mb-1">
                              <span className="text-gray-500">Results:</span> {step.results?.summary || description || 'Step completed.'}
                            </p>
                            <p>
                              <span className="text-gray-500">Quality Score:</span>{' '}
                              <span className="text-green-400">{step.results?.quality?.score_percent ?? 0}%</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (step.status === 'running') {
                    return (
                      <div key={step.step_id} className="step-card bg-dark-800 border border-purple-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-white mb-1">{title}</h4>
                            <p className="text-xs text-purple-400">In progress... {current} of {total}</p>
                          </div>
                        </div>
                        <div className="ml-9">
                          <div className="bg-dark-900 rounded px-3 py-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-400">Progress</span>
                              <span className="text-xs text-white font-semibold">{percent}%</span>
                            </div>
                            <div className="w-full bg-dark-700 rounded-full h-1.5">
                              <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={step.step_id} className="step-card bg-dark-800/50 border border-dark-700 rounded-lg p-4 opacity-60">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-gray-500">{idx + 1}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-400 mb-1">{title}</h4>
                          <p className="text-xs text-gray-500">{step.status === 'failure' ? 'Failed' : 'Queued'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeConsoleTab === 'execution' && (
            <div id="execution-view">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white mb-3">Live Tool Execution</h3>
                {toolCalls.length === 0 && (
                  <div className="tool-card bg-dark-800/50 border border-dark-700 rounded-lg overflow-hidden opacity-60">
                    <div className="p-4">
                      <p className="text-xs text-gray-500">Tool execution cards will appear after run events stream in.</p>
                    </div>
                  </div>
                )}
                {toolCalls.map((tc) => {
                  const done = tc.status === 'success';
                  const running = tc.status === 'running';
                  const border = done ? 'border-green-500/30' : running ? 'border-purple-500/30' : 'border-dark-700';
                  const badge = done ? 'Complete' : running ? 'Running' : 'Queued';
                  const badgeCls = done ? 'bg-green-500/20 text-green-400' : running ? 'bg-purple-500/20 text-purple-400' : 'bg-dark-700 text-gray-500';
                  return (
                    <div key={tc.toolcall_id} className={`tool-card bg-dark-800 border ${border} rounded-lg overflow-hidden`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                              <i className="fa-solid fa-bolt text-purple-400 text-sm" />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-white">{tc.tool?.display_name || tc.tool?.tool_id || 'Tool'}</h4>
                              <p className="text-xs text-gray-400">{tc.tool?.tool_id}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${badgeCls}`}>{badge}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">
                            Duration: <span className="text-white">{toDurationLabel(Math.round((tc.metrics?.duration_ms || 0) / 1000))}</span>
                          </span>
                          <span className="text-gray-400">
                            Credits: <span className="text-amber-400 font-semibold">{tc.metrics?.credits_used ?? 0}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeConsoleTab === 'artifacts' && (
            <div id="artifacts-view">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white mb-3">Generated Artifacts</h3>
                {runArtifacts.length === 0 && (
                  <div className="artifact-card bg-dark-800 border border-dark-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500">Artifacts will appear as the run progresses.</p>
                  </div>
                )}
                {runArtifacts.map((a) => (
                  <div key={a.artifact_id} className="artifact-card bg-dark-800 border border-dark-700 rounded-lg p-4 hover:border-purple-500/30 cursor-pointer transition-all duration-150">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-cube text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-white mb-1">{a.title || a.type}</h4>
                        <p className="text-xs text-gray-400 mb-2">{a.description || 'Artifact generated by REX run.'}</p>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${a.status === 'complete' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'}`}>
                            {a.status}
                          </span>
                          {a.created_at && (
                            <span className="text-xs text-gray-500">Created {new Date(a.created_at).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div id="console-footer" className="border-t border-dark-800 p-4 flex-shrink-0">
          <div className="bg-dark-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-300">Workflow Status</span>
              <span className="text-xs text-purple-400 font-semibold">Step {Math.min(stepsTotal, Math.max(1, activeStepIndex + 1))} of {stepsTotal}</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-1.5 mb-2">
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${stepProgressPercent}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Est. remaining: {toDurationLabel(etaSeconds)}</span>
              <span>Credits used: <span className="text-amber-400 font-semibold">{creditsUsed}</span></span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}


