import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createConversation, fetchMessages, listConversations, postMessage, type RexConversation } from '../lib/rexApi';
import { supabase } from '../lib/supabaseClient';
import '../styles/rex.css';

type UiMessage = {
  id: string;
  sender: 'user' | 'rex';
  content: string;
};

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
      credits: { min: 300, max: 600, unit: 'credits', notes: 'Estimated from step complexity and enrichment volume.' },
      time: { min_minutes: 10, max_minutes: 20, notes: 'Depends on sourcing and enrichment throughput.' },
      risk: { level: 'low', notes: 'Execution uses existing recruiting tools and queues.' }
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

export default function REXChat() {
  const [userName, setUserName] = useState('Alex Chen');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
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

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const allowReconnectRef = useRef(false);
  const streamTokenRef = useRef<string>('');
  const streamRunIdRef = useRef<string>('');
  const messagesScrollerRef = useRef<HTMLDivElement>(null);

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
      content: typeof m.content === 'string' ? m.content : (m.content?.text || JSON.stringify(m.content))
    }));
    setMessages(mapped);
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const name = `${(user.user_metadata as any)?.first_name || ''} ${(user.user_metadata as any)?.last_name || ''}`.trim();
          setUserName(name || user.email || 'Alex Chen');
        }
      } catch {}
      await loadConversations();
    })();
    return () => cleanupStream();
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;
    loadConversationMessages(activeConversationId).catch(() => {});
  }, [activeConversationId]);

  useEffect(() => {
    messagesScrollerRef.current?.scrollTo({
      top: messagesScrollerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages, planJson, runProgress, toolCalls, runArtifacts]);

  async function ensureConversation(seedTitle: string) {
    if (activeConversationId) return activeConversationId;
    const conv = await createConversation(seedTitle.slice(0, 120));
    setActiveConversationId(conv.id);
    await loadConversations();
    return conv.id;
  }

  async function sendPlannerMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');

    const userMsg: UiMessage = { id: makeId('m_user'), sender: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const conversationId = await ensureConversation(text);
      await postMessage(conversationId, 'user', { text });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/rex/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user?.id,
          conversationId,
          messages: [...messages, userMsg].map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        })
      });
      const data = await response.json().catch(() => ({}));
      const assistantReply = typeof data?.reply?.content === 'string'
        ? data.reply.content
        : (data?.reply?.content?.text || data?.error || 'I can build a recruiting run plan for that request.');
      const rexMsg: UiMessage = { id: makeId('m_rex'), sender: 'rex', content: assistantReply };
      setMessages((prev) => [...prev, rexMsg]);
      await postMessage(conversationId, 'assistant', { text: assistantReply });

      setPlanJson(buildPlanFromText(text, assistantReply, conversationId));
      setActiveConsoleTab('plan');
      setRunId(null);
      setRunStatus('idle');
      setRunProgress(null);
      setRunArtifacts([]);
      setToolCalls([]);
      setRunStats(null);
    } catch (e) {
      setMessages((prev) => [...prev, { id: makeId('m_err'), sender: 'rex', content: 'Failed to generate plan. Please try again.' }]);
    } finally {
      setSending(false);
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

  return (
    <div id="rex-container" className="flex h-screen overflow-hidden bg-dark-950 text-gray-100 font-sans antialiased">
      <aside id="sidebar" className="w-[280px] bg-dark-900 border-r border-dark-800 flex flex-col">
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
          {[
            { icon: 'fa-magnifying-glass', color: 'text-purple-400', bg: 'bg-purple-500/20', name: 'Talent Hunter', status: 'dot', subtitle: 'Last run: 2 hours ago' },
            { icon: 'fa-chart-line', color: 'text-blue-400', bg: 'bg-blue-500/20', name: 'Pipeline Optimizer', status: 'dot-muted', subtitle: 'Last run: 1 day ago' },
            { icon: 'fa-user-tie', color: 'text-emerald-400', bg: 'bg-emerald-500/20', name: 'Executive Headhunter', status: 'Running', subtitle: 'Started: 15 min ago' },
            { icon: 'fa-envelope', color: 'text-amber-400', bg: 'bg-amber-500/20', name: 'Outreach Automator', status: 'dot-muted', subtitle: 'Last run: 3 days ago' }
          ].map((a) => (
            <div key={a.name} className="agent-item bg-dark-800 hover:bg-dark-700 rounded-lg p-3 mb-2 cursor-pointer transition-all duration-150 border border-transparent hover:border-purple-500/30">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 ${a.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <i className={`fa-solid ${a.icon} ${a.color} text-sm`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-white truncate">{a.name}</h4>
                    {a.status === 'Running' ? (
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded flex-shrink-0">Running</span>
                    ) : (
                      <span className={`w-2 h-2 ${a.status === 'dot' ? 'bg-green-500' : 'bg-gray-500'} rounded-full flex-shrink-0`} />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{a.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
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
              onClick={() => setActiveConversationId(c.id)}
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
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="User" className="w-8 h-8 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-gray-400">Premium Plan</p>
            </div>
            <i className="fa-solid fa-ellipsis-vertical text-gray-400" />
          </div>
        </div>
      </aside>

      <main id="chat-panel" className="flex-1 flex flex-col bg-dark-950">
        <header id="chat-header" className="h-16 border-b border-dark-800 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{planJson?.goal?.title || 'REX Recruiting Console'}</h2>
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
          </div>
        </header>

        <div id="chat-messages" className="flex-1 overflow-y-auto px-6 py-6" ref={messagesScrollerRef}>
          {messages.map((m) => (
            <div key={m.id} className="message-group mb-8">
              {m.sender === 'user' ? (
                <div className="flex justify-end mb-4">
                  <div className="max-w-2xl bg-purple-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-lg">
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <i className="fa-solid fa-robot text-white text-sm" />
                  </div>
                  <div className="flex-1 max-w-3xl">
                    <div className="bg-dark-900 border border-dark-800 rounded-2xl rounded-tl-sm shadow-xl px-5 py-4">
                      <p className="text-sm text-gray-300 leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {planJson && (
            <div className="message-group mb-8">
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
            </div>
          )}
        </div>

        <div id="chat-input-container" className="border-t border-dark-800 p-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
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
                <button className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150">
                  <i className="fa-solid fa-paperclip" />
                </button>
                <button
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-purple-500/20"
                  onClick={sendPlannerMessage}
                  disabled={sending || !input.trim()}
                >
                  <i className="fa-solid fa-paper-plane" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-coins text-amber-400" />
                  <span>{Math.max(0, (runStats?.credits?.remaining ?? 1247))} credits remaining</span>
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

      <aside id="agent-console" className="w-[420px] bg-dark-900 border-l border-dark-800 flex flex-col">
        <div id="console-header" className="h-16 border-b border-dark-800 flex items-center justify-between px-5 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">Agent Console</h2>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all duration-150">
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


