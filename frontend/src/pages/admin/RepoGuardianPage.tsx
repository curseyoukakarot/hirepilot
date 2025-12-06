import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { cn } from '../../lib/utils';

type TabKey = 'health' | 'errors' | 'scenarios' | 'sweeps';
type HealthStatus = 'pass' | 'fail' | 'warn';
type SeverityLevel = 'low' | 'medium' | 'high';
type RepoErrorStatus = 'open' | 'fixing' | 'resolved';
type ScenarioType =
  | 'plan_permissions'
  | 'leads_candidates'
  | 'teams_sharing'
  | 'integrations'
  | 'other';
type ScenarioStatus = 'pass' | 'fail' | 'never_run' | 'running';
type SweepStatus = 'clean' | 'violations' | 'never_run' | 'running';
type AgentMessageRole = 'user' | 'agent' | 'system';
type PatchStatus = 'proposed' | 'applied' | 'failed';

interface PaginatedResponse<T> {
  items: T[];
  count?: number;
  limit?: number;
  offset?: number;
}

export interface HealthCheck {
  id: string;
  created_at: string;
  triggered_by: 'system' | 'user';
  triggered_by_user_id?: string | null;
  branch: string;
  tests_status: HealthStatus;
  lint_status: HealthStatus;
  build_status: HealthStatus;
  severity: SeverityLevel;
  summary?: string | null;
}

export interface HealthCheckDetail extends HealthCheck {
  logs_tests?: string | null;
  logs_lint?: string | null;
  logs_build?: string | null;
}

export interface RepoError {
  id: string;
  error_signature: string;
  error_message: string;
  occurrences: number;
  status: RepoErrorStatus;
  first_seen_at: string;
  last_seen_at: string;
  last_context_route?: string | null;
}

export interface RepoErrorDetail extends RepoError {
  stack_trace?: string | null;
  context_json?: Record<string, any> | null;
  last_health_check_id?: string | null;
  last_explanation?: string | null;
}

export interface RepoScenario {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  type: ScenarioType;
  active: boolean;
}

export interface ScenarioRun {
  id: string;
  scenario_id: string;
  started_at: string;
  finished_at?: string | null;
  status: ScenarioStatus;
  failing_step?: string | null;
  logs?: string | null;
}

export interface IntegritySweep {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  active: boolean;
}

export interface IntegritySweepRun {
  id: string;
  sweep_id: string;
  started_at: string;
  finished_at?: string | null;
  status: SweepStatus;
  violation_summary?: string | null;
  raw_report?: string | null;
  violation_count?: number | null;
}

export interface AgentMessage {
  id: string;
  created_at: string;
  role: AgentMessageRole;
  content: string;
}

export interface RepoAgentConversation {
  id: string;
  created_at: string;
  title?: string | null;
  messages: AgentMessage[];
  related_error_id?: string | null;
  related_health_check_id?: string | null;
  related_scenario_run_id?: string | null;
  related_sweep_run_id?: string | null;
}

export interface DiffChunk {
  filePath?: string;
  path?: string;
  diff: string;
}

export interface ProposedPatch {
  id: string;
  status: PatchStatus;
  branch?: string;
  summary?: string;
  diffs: DiffChunk[];
}

export interface RepoAgentSettings {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  slackEnabled: boolean;
  slackChannel?: string | null;
  slackWebhookUrl?: string | null;
  emailEnabled: boolean;
  emailRecipients: string[];
  nightlyCheckEnabled: boolean;
  nightlyCheckTimeUtc: string;
  errorAlertThreshold: number;
}

type SelectedContext =
  | { type: 'health'; id: string }
  | { type: 'error'; id: string }
  | { type: 'scenario'; id: string }
  | { type: 'sweep'; id: string }
  | null;

const ROW_LIMIT = 25;

const DEFAULT_SETTINGS: RepoAgentSettings = {
  slackEnabled: false,
  slackChannel: null,
  slackWebhookUrl: null,
  emailEnabled: false,
  emailRecipients: [],
  nightlyCheckEnabled: false,
  nightlyCheckTimeUtc: '02:00',
  errorAlertThreshold: 5,
};

const DARK_THEME_STYLES = `
#repo-guardian-page {
  background-color: #020617;
  color: #fff;
}
#repo-guardian-page .bg-dark-950 { background-color: #020617 !important; }
#repo-guardian-page .bg-dark-950\\/95 { background-color: rgba(2, 6, 23, 0.95) !important; }
#repo-guardian-page .bg-dark-900 { background-color: #0f172a !important; }
#repo-guardian-page .bg-dark-900\\/80 { background-color: rgba(15, 23, 42, 0.8) !important; }
#repo-guardian-page .bg-dark-900\\/70 { background-color: rgba(15, 23, 42, 0.7) !important; }
#repo-guardian-page .bg-dark-800 { background-color: #1e293b !important; }
#repo-guardian-page .bg-dark-800\\/60 { background-color: rgba(30, 41, 59, 0.6) !important; }
#repo-guardian-page .bg-dark-800\\/40 { background-color: rgba(30, 41, 59, 0.4) !important; }
#repo-guardian-page .border-dark-900 { border-color: #0f172a !important; }
#repo-guardian-page .border-dark-800 { border-color: #1e293b !important; }
#repo-guardian-page .border-dark-700 { border-color: #334155 !important; }
#repo-guardian-page .text-dark-300 { color: #cbd5e1 !important; }
#repo-guardian-page .text-dark-400 { color: #94a3b8 !important; }
#repo-guardian-page .text-dark-500 { color: #64748b !important; }
#repo-guardian-page .text-dark-600 { color: #475569 !important; }
`;

const statusTone = (value?: string | null) => {
  switch (value) {
    case 'pass':
    case 'clean':
    case 'low':
      return 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200';
    case 'warn':
    case 'medium':
    case 'fixing':
      return 'bg-amber-400/10 border border-amber-400/30 text-amber-200';
    case 'fail':
    case 'violations':
    case 'high':
    case 'open':
    case 'failed':
      return 'bg-rose-500/10 border border-rose-500/30 text-rose-200';
    case 'running':
      return 'bg-blue-500/10 border border-blue-500/30 text-blue-200';
    case 'resolved':
      return 'bg-slate-700/60 border border-slate-700 text-slate-100';
    default:
      return 'bg-slate-800 border border-slate-700 text-slate-300';
  }
};

const timeAgo = (value?: string | null) => {
  if (!value) return '—';
  const target = new Date(value).getTime();
  const diff = Date.now() - target;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
};

const SettingsToggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <p className="text-sm text-slate-100">{label}</p>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-12 h-6 rounded-full relative transition-colors',
        checked ? 'bg-emerald-500/80' : 'bg-slate-700'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-0'
        )}
      />
    </button>
  </div>
);

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: RepoAgentSettings | null;
  onSave: (next: RepoAgentSettings) => Promise<void>;
  isSaving: boolean;
}

const SettingsModal = ({
  open,
  onClose,
  settings,
  onSave,
  isSaving,
}: SettingsModalProps) => {
  const [draft, setDraft] = useState<RepoAgentSettings>(settings || DEFAULT_SETTINGS);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  if (!open) return null;

  const handleChange = <K extends keyof RepoAgentSettings>(key: K, value: RepoAgentSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="w-full max-w-2xl bg-dark-950 border border-dark-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Repo Guardian Settings</h3>
            <p className="text-sm text-dark-400">Configure automation + alerting.</p>
          </div>
          <button className="text-dark-400 hover:text-white" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <section className="space-y-4">
            <h4 className="text-sm font-semibold text-dark-300 uppercase tracking-wide">Notifications</h4>
            <SettingsToggle
              label="Slack alerts"
              checked={Boolean(draft.slackEnabled)}
              onChange={(next) => handleChange('slackEnabled', next)}
            />
            {draft.slackEnabled && (
              <input
                type="text"
                value={draft.slackChannel || ''}
                onChange={(e) => handleChange('slackChannel', e.target.value)}
                placeholder="#infra-alerts"
                className="w-full rounded-xl bg-dark-900 border border-dark-800 px-3 py-2 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70 focus:border-emerald-500/50"
              />
            )}
            <SettingsToggle
              label="Email alerts"
              checked={Boolean(draft.emailEnabled)}
              onChange={(next) => handleChange('emailEnabled', next)}
            />
            {draft.emailEnabled && (
              <input
                type="text"
                value={draft.emailRecipients.join(', ')}
                onChange={(e) =>
                  handleChange(
                    'emailRecipients',
                    e.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="infra@hirepilot.ai, sre@hirepilot.ai"
                className="w-full rounded-xl bg-dark-900 border border-dark-800 px-3 py-2 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70 focus:border-emerald-500/50"
              />
            )}
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-semibold text-dark-300 uppercase tracking-wide">Nightly Checks</h4>
            <SettingsToggle
              label="Enable nightly full check"
              checked={Boolean(draft.nightlyCheckEnabled)}
              onChange={(next) => handleChange('nightlyCheckEnabled', next)}
            />
            {draft.nightlyCheckEnabled && (
              <div className="flex items-center gap-3">
                <label className="text-xs text-dark-400">Run at (UTC)</label>
                <input
                  type="time"
                  value={draft.nightlyCheckTimeUtc}
                  onChange={(e) => handleChange('nightlyCheckTimeUtc', e.target.value)}
                  className="rounded-xl bg-dark-900 border border-dark-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/70 focus:border-emerald-500/50"
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-dark-300 uppercase tracking-wide">Error thresholds</h4>
            <div className="flex items-center gap-3">
              <label className="text-xs text-dark-400">Alert on ≥</label>
              <input
                type="number"
                min={1}
                value={draft.errorAlertThreshold}
                onChange={(e) => handleChange('errorAlertThreshold', Number(e.target.value) || 1)}
                className="w-24 rounded-xl bg-dark-900 border border-dark-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/70 focus:border-emerald-500/50"
              />
              <span className="text-xs text-dark-500">incidents / 24h</span>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-dark-700 text-dark-300 hover:bg-dark-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={cn(
                'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all',
                isSaving && 'opacity-60 cursor-not-allowed'
              )}
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SummaryCard = ({
  title,
  value,
  description,
  icon,
  accent,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}) => (
  <div className="bg-dark-900/70 border border-dark-800 rounded-2xl p-5 flex items-center justify-between hover:border-dark-700 transition-colors">
    <div>
      <p className="text-xs text-dark-400">{title}</p>
      <p className={cn('text-2xl font-semibold mt-2', accent)}>{value}</p>
      <p className="text-xs text-dark-500 mt-1">{description}</p>
    </div>
    <div className="w-12 h-12 rounded-2xl bg-dark-800 flex items-center justify-center">
      {icon}
    </div>
  </div>
);

const LoadingRows = () => (
  <div className="space-y-3">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div key={idx} className="h-12 rounded-xl bg-dark-900/60 border border-dark-900 animate-pulse" />
    ))}
  </div>
);

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
    <div className="w-10 h-10 rounded-full bg-dark-900 border border-dark-800 flex items-center justify-center text-dark-400">
      •
    </div>
    <h4 className="text-sm font-semibold text-white">{title}</h4>
    <p className="text-xs text-dark-400">{description}</p>
  </div>
);

const DiffBlock = ({ chunk }: { chunk: DiffChunk }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-white">{chunk.filePath || chunk.path || 'Diff'}</p>
    <pre className="bg-dark-900 border border-dark-800 rounded-lg p-3 text-xs font-mono text-dark-300 overflow-auto max-h-48">
      {chunk.diff.split('\n').map((line, idx) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={`${chunk.filePath}-${idx}`}
          className={cn(
            'block whitespace-pre-wrap',
            line.startsWith('+') && 'text-emerald-300',
            line.startsWith('-') && 'text-rose-300',
            !line.startsWith('+') && !line.startsWith('-') && 'text-dark-400'
          )}
        >
          {line || ' '}
        </span>
      ))}
    </pre>
  </div>
);

const RepoGuardianPage: React.FC = () => {
  const [roleState, setRoleState] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [activeTab, setActiveTab] = useState<TabKey>('health');
  const [selected, setSelected] = useState<SelectedContext>(null);
  const [healthDetails, setHealthDetails] = useState<Record<string, HealthCheckDetail>>({});
  const [errorDetails, setErrorDetails] = useState<Record<string, RepoErrorDetail>>({});
  const [scenarioRuns, setScenarioRuns] = useState<Record<string, ScenarioRun | null>>({});
  const [sweepRuns, setSweepRuns] = useState<Record<string, IntegritySweepRun | null>>({});
  const [patchesByError, setPatchesByError] = useState<Record<string, ProposedPatch | null>>({});
  const [chatConversation, setChatConversation] = useState<RepoAgentConversation | null>(null);
  const [chatMode, setChatMode] = useState<'explain' | 'patch'>('explain');
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'repo-guardian-dark-theme';
    if (!document.getElementById(styleId)) {
      const styleTag = document.createElement('style');
      styleTag.id = styleId;
      styleTag.innerHTML = DARK_THEME_STYLES;
      document.head.appendChild(styleTag);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setRoleState('denied');
          return;
        }
        const role =
          (user.app_metadata?.role ||
            user.user_metadata?.role ||
            '').toString().toLowerCase();
        if (mounted) setRoleState(role === 'super_admin' ? 'granted' : 'denied');
      } catch {
        if (mounted) setRoleState('denied');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const canAccess = roleState === 'granted';

  const healthQuery = useQuery<PaginatedResponse<HealthCheck>>({
    queryKey: ['repo-guardian', 'health'],
    queryFn: () => apiGet(`/api/repo-agent/health-checks?limit=${ROW_LIMIT}&offset=0`),
    enabled: canAccess,
    refetchInterval: 60_000,
  });

  const errorsQuery = useQuery<PaginatedResponse<RepoError>>({
    queryKey: ['repo-guardian', 'errors'],
    queryFn: () => apiGet(`/api/repo-agent/errors?limit=${ROW_LIMIT}&offset=0`),
    enabled: canAccess,
    refetchInterval: 60_000,
  });

  const scenariosQuery = useQuery<RepoScenario[]>({
    queryKey: ['repo-guardian', 'scenarios'],
    queryFn: () => apiGet('/api/repo-agent/scenarios'),
    enabled: canAccess,
  });

  const sweepsQuery = useQuery<IntegritySweep[]>({
    queryKey: ['repo-guardian', 'sweeps'],
    queryFn: () => apiGet('/api/repo-agent/sweeps'),
    enabled: canAccess,
  });

  const settingsQuery = useQuery<RepoAgentSettings>({
    queryKey: ['repo-guardian', 'settings'],
    queryFn: () => apiGet('/api/repo-agent/settings'),
    enabled: canAccess,
  });

  const loadHealthDetail = useCallback(
    async (id: string) => {
      if (healthDetails[id]) return;
      try {
        const detail = await apiGet(`/api/repo-agent/health-checks/${id}`);
        setHealthDetails((prev) => ({ ...prev, [id]: detail }));
      } catch (error: any) {
        toast.error(error?.message || 'Unable to load health check detail');
      }
    },
    [healthDetails]
  );

  const loadErrorDetail = useCallback(
    async (id: string) => {
      if (errorDetails[id]) return;
      try {
        const detail = await apiGet(`/api/repo-agent/errors/${id}`);
        setErrorDetails((prev) => ({ ...prev, [id]: detail }));
      } catch (error: any) {
        toast.error(error?.message || 'Unable to load error detail');
      }
    },
    [errorDetails]
  );

  const fetchScenarioRun = useCallback(
    async (id: string) => {
      if (scenarioRuns[id] !== undefined) return;
      try {
        const latest = await apiGet(`/api/repo-agent/scenarios/${id}/latest-run`);
        setScenarioRuns((prev) => ({ ...prev, [id]: latest }));
      } catch {
        setScenarioRuns((prev) => ({ ...prev, [id]: null }));
      }
    },
    [scenarioRuns]
  );

  const fetchSweepRun = useCallback(
    async (id: string) => {
      if (sweepRuns[id] !== undefined) return;
      try {
        const latest = await apiGet(`/api/repo-agent/sweeps/${id}/latest-run`);
        setSweepRuns((prev) => ({ ...prev, [id]: latest }));
      } catch {
        setSweepRuns((prev) => ({ ...prev, [id]: null }));
      }
    },
    [sweepRuns]
  );

  useEffect(() => {
    if (!selected && healthQuery.data?.items?.length) {
      const first = healthQuery.data.items[0];
      setSelected({ type: 'health', id: first.id });
      loadHealthDetail(first.id);
    }
  }, [selected, healthQuery.data, loadHealthDetail]);

  useEffect(() => {
    if (!scenariosQuery.data?.length) return;
    scenariosQuery.data.forEach((scenario) => {
      if (scenarioRuns[scenario.id] === undefined) {
        fetchScenarioRun(scenario.id);
      }
    });
  }, [scenariosQuery.data, scenarioRuns, fetchScenarioRun]);

  useEffect(() => {
    if (!sweepsQuery.data?.length) return;
    sweepsQuery.data.forEach((sweep) => {
      if (sweepRuns[sweep.id] === undefined) {
        fetchSweepRun(sweep.id);
      }
    });
  }, [sweepsQuery.data, sweepRuns, fetchSweepRun]);

  const runFullCheck = useMutation({
    mutationFn: () => apiPost('/api/repo-agent/run-full-check', {}),
    onSuccess: () => {
      toast.success('Full check started');
      queryClient.invalidateQueries({ queryKey: ['repo-guardian', 'health'] });
      queryClient.invalidateQueries({ queryKey: ['repo-guardian', 'errors'] });
      queryClient.invalidateQueries({ queryKey: ['repo-guardian', 'scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['repo-guardian', 'sweeps'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to run full check'),
  });

  const autoFixError = useMutation({
    mutationFn: (id: string) => apiPost(`/api/repo-agent/errors/${id}/auto-fix`, {}),
    onSuccess: (data: any, id) => {
      toast.success('Patch proposal ready');
      if (data?.patch) {
        setPatchesByError((prev) => ({ ...prev, [id]: data.patch }));
      } else if (data?.diffs) {
        setPatchesByError((prev) => ({
          ...prev,
          [id]: {
            id: `patch-${Date.now()}`,
            status: 'proposed',
            summary: data?.summary || data?.explanation || 'Patch proposal',
            diffs: data.diffs,
          },
        }));
      }
      if (data?.explanation) {
        setErrorDetails((prev) => ({
          ...prev,
          [id]: prev[id] ? { ...prev[id], last_explanation: data.explanation } : prev[id],
        }));
      }
    },
    onError: (error: any) => toast.error(error?.message || 'Auto-fix failed'),
  });

  const runScenarioMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/repo-agent/scenarios/${id}/run`, {}),
    onSuccess: async (_, id) => {
      toast.success('Scenario execution started');
      try {
        const latest = await apiGet(`/api/repo-agent/scenarios/${id}/latest-run`);
        setScenarioRuns((prev) => ({ ...prev, [id]: latest }));
      } catch {
        /* ignore */
      }
    },
    onError: (error: any) => toast.error(error?.message || 'Scenario failed to start'),
  });

  const runSweepMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/repo-agent/sweeps/${id}/run`, {}),
    onSuccess: async (_, id) => {
      toast.success('Sweep started');
      try {
        const latest = await apiGet(`/api/repo-agent/sweeps/${id}/latest-run`);
        setSweepRuns((prev) => ({ ...prev, [id]: latest }));
      } catch {
        /* ignore */
      }
    },
    onError: (error: any) => toast.error(error?.message || 'Sweep failed to start'),
  });

  const handleSaveSettings = async (next: RepoAgentSettings) => {
    try {
      setSettingsSaving(true);
      const saved = await apiPut('/api/repo-agent/settings', next);
      queryClient.setQueryData(['repo-guardian', 'settings'], saved);
      toast.success('Settings updated');
      setSettingsOpen(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    setChatSending(true);
    const payload: Record<string, any> = {
      conversationId: chatConversation?.id,
      message: chatInput.trim(),
      mode: chatMode,
    };
    if (selected?.type === 'health') payload.relatedHealthCheckId = selected.id;
    if (selected?.type === 'error') payload.relatedErrorId = selected.id;
    if (selected?.type === 'scenario') {
      const runId = scenarioRuns[selected.id]?.id;
      if (runId) payload.relatedScenarioRunId = runId;
    }
    if (selected?.type === 'sweep') {
      const runId = sweepRuns[selected.id]?.id;
      if (runId) payload.relatedSweepRunId = runId;
    }
    try {
      const response = await apiPost('/api/repo-agent/chat', payload);
      setChatConversation(response);
      setChatInput('');
    } catch (error: any) {
      toast.error(error?.message || 'Chat failed');
    } finally {
      setChatSending(false);
    }
  };

  const detailData = useMemo(() => {
    if (!selected) return null;
    switch (selected.type) {
      case 'health':
        return healthDetails[selected.id] || healthQuery.data?.items?.find((item) => item.id === selected.id);
      case 'error':
        return errorDetails[selected.id] || errorsQuery.data?.items?.find((item) => item.id === selected.id);
      case 'scenario':
        return {
          scenario: scenariosQuery.data?.find((item) => item.id === selected.id),
          run: scenarioRuns[selected.id],
        };
      case 'sweep':
        return {
          sweep: sweepsQuery.data?.find((item) => item.id === selected.id),
          run: sweepRuns[selected.id],
        };
      default:
        return null;
    }
  }, [
    selected,
    healthDetails,
    healthQuery.data,
    errorDetails,
    errorsQuery.data,
    scenariosQuery.data,
    scenarioRuns,
    sweepsQuery.data,
    sweepRuns,
  ]);

  const selectedPatch =
    selected?.type === 'error' ? patchesByError[selected.id] || null : null;

  const automationSummary = useMemo(() => {
    const settings = settingsQuery.data;
    if (!settings) return 'Loading automation status…';
    if (!settings.nightlyCheckEnabled) return '⚪ Auto checks: Off · Manual only';
    return [
      '🟢 Auto checks: On',
      `Nightly at ${settings.nightlyCheckTimeUtc || '02:00'} UTC`,
      `Slack: ${settings.slackEnabled ? 'On' : 'Off'}`,
      `Email: ${settings.emailEnabled ? 'On' : 'Off'}`,
    ].join(' · ');
  }, [settingsQuery.data]);

  const latestHealth = healthQuery.data?.items?.[0];
  const systemHealthValue = latestHealth ? latestHealth.severity.toUpperCase() : '--';
  const systemHealthDescription = latestHealth ? `Tests ${latestHealth.tests_status} • Lint ${latestHealth.lint_status} • Build ${latestHealth.build_status}` : 'Awaiting runs';
  const systemHealthAccent =
    latestHealth && latestHealth.severity === 'low'
      ? 'text-emerald-400'
      : latestHealth && latestHealth.severity === 'medium'
      ? 'text-amber-300'
      : latestHealth
      ? 'text-rose-300'
      : 'text-white';

  const openErrors = errorsQuery.data?.items?.filter((err) => err.status === 'open') || [];
  const scenarioCount = scenariosQuery.data?.length || 0;
  const passingScenarios = Object.values(scenarioRuns).filter((run) => run?.status === 'pass').length;
  const sweepValues = Object.values(sweepRuns).filter(Boolean) as IntegritySweepRun[];
  const lastSweepRun = sweepValues.sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )[0];

  const renderTabContent = () => {
    if (activeTab === 'health') {
      if (healthQuery.isLoading) return <LoadingRows />;
      if (healthQuery.isError) return <EmptyState title="Unable to load" description="Health check history unavailable." />;
      if (!healthQuery.data?.items?.length) {
        return <EmptyState title="No health checks" description="Kick off a run to populate this list." />;
      }
      return (
        <div className="space-y-2">
          {healthQuery.data.items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelected({ type: 'health', id: item.id });
                loadHealthDetail(item.id);
              }}
              className={cn(
                'w-full text-left bg-dark-800/60 border border-dark-800 rounded-xl p-4 hover:border-dark-600 transition-colors',
                selected?.type === 'health' && selected.id === item.id && 'border-blue-500/60 bg-dark-800'
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{item.branch}</p>
                  <p className="text-xs text-dark-400">
                    {timeAgo(item.created_at)} • {item.triggered_by === 'system' ? 'System' : 'Manual'}
                  </p>
                </div>
                <span className={cn('px-3 py-1 rounded-full text-[11px] font-semibold', statusTone(item.severity))}>
                  {item.severity.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {(['tests_status', 'lint_status', 'build_status'] as const).map((key) => (
                  <span
                    key={key}
                    className={cn(
                      'px-2 py-1 text-[11px] rounded-full border font-medium',
                      statusTone(item[key])
                    )}
                  >
                    {key.replace('_status', '').toUpperCase()}: {item[key].toUpperCase()}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      );
    }

    if (activeTab === 'errors') {
      if (errorsQuery.isLoading) return <LoadingRows />;
      if (errorsQuery.isError) return <EmptyState title="Unable to load" description="Error queue unavailable." />;
      if (!errorsQuery.data?.items?.length) {
        return <EmptyState title="No repo errors" description="Zero tracked incidents — love to see it." />;
      }
      return (
        <div className="space-y-2">
          {errorsQuery.data.items.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setSelected({ type: 'error', id: item.id });
                loadErrorDetail(item.id);
              }}
              className={cn(
                'bg-dark-800/60 border border-dark-800 rounded-xl p-4 hover:border-dark-600 transition-colors cursor-pointer',
                selected?.type === 'error' && selected.id === item.id && 'border-blue-500/60 bg-dark-800'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.error_message}</p>
                  <p className="text-xs text-dark-400 truncate">{item.last_context_route || 'No route'}</p>
                </div>
                <span className={cn('px-2 py-1 text-[11px] rounded-full border font-semibold', statusTone(item.status))}>
                  {item.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-dark-400 mt-3">
                <span>{item.occurrences} occurrences</span>
                <span>Last seen {timeAgo(item.last_seen_at)}</span>
              </div>
              <div className="flex items-center justify-end mt-3">
                <button
                  className={cn(
                    'px-3 py-1.5 text-[11px] rounded-full border border-purple-500/40 text-purple-300 hover:bg-purple-500/10 transition-colors',
                    autoFixError.isPending && 'opacity-60 pointer-events-none'
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    autoFixError.mutate(item.id);
                  }}
                >
                  {autoFixError.isPending ? 'Analyzing…' : 'Auto-Fix'}
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'scenarios') {
      if (scenariosQuery.isLoading) return <LoadingRows />;
      if (scenariosQuery.isError) return <EmptyState title="Unable to load" description="Scenarios unavailable." />;
      if (!scenariosQuery.data?.length) {
        return <EmptyState title="No scenarios" description="Define critical user journeys to monitor." />;
      }
      return (
        <div className="space-y-2">
          {scenariosQuery.data.map((scenario) => {
            const latest = scenarioRuns[scenario.id];
            const status = latest?.status || 'never_run';
            return (
              <div
                key={scenario.id}
                className={cn(
                  'bg-dark-800/60 border border-dark-800 rounded-xl p-4 hover:border-dark-600 transition-colors cursor-pointer',
                  selected?.type === 'scenario' && selected.id === scenario.id && 'border-blue-500/60 bg-dark-800'
                )}
                onClick={() => setSelected({ type: 'scenario', id: scenario.id })}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{scenario.label}</p>
                    <p className="text-xs text-dark-400">{scenario.description || scenario.type}</p>
                  </div>
                  <span className={cn('px-2 py-1 text-[11px] rounded-full border font-semibold', statusTone(status))}>
                    {status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-dark-400 mt-3">
                  <span>{latest?.finished_at ? timeAgo(latest.finished_at) : 'No runs yet'}</span>
                  <button
                    className={cn(
                      'px-3 py-1.5 text-[11px] rounded-full border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 transition-colors',
                      runScenarioMutation.isPending && 'opacity-60 pointer-events-none'
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      runScenarioMutation.mutate(scenario.id);
                    }}
                  >
                    Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'sweeps') {
      if (sweepsQuery.isLoading) return <LoadingRows />;
      if (sweepsQuery.isError) return <EmptyState title="Unable to load" description="Integrity sweeps unavailable." />;
      if (!sweepsQuery.data?.length) {
        return <EmptyState title="No sweeps" description="Define sweeps to watch data integrity guards." />;
      }
      return (
        <div className="space-y-2">
          {sweepsQuery.data.map((sweep) => {
            const latest = sweepRuns[sweep.id];
            const status = latest?.status || 'never_run';
            return (
              <div
                key={sweep.id}
                className={cn(
                  'bg-dark-800/60 border border-dark-800 rounded-xl p-4 hover:border-dark-600 transition-colors cursor-pointer',
                  selected?.type === 'sweep' && selected.id === sweep.id && 'border-blue-500/60 bg-dark-800'
                )}
                onClick={() => setSelected({ type: 'sweep', id: sweep.id })}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{sweep.label}</p>
                    <p className="text-xs text-dark-400">{sweep.description || sweep.name}</p>
                  </div>
                  <span className={cn('px-2 py-1 text-[11px] rounded-full border font-semibold', statusTone(status))}>
                    {status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-dark-400 mt-3">
                  <span>{latest?.finished_at ? timeAgo(latest.finished_at) : 'No runs yet'}</span>
                  <button
                    className={cn(
                      'px-3 py-1.5 text-[11px] rounded-full border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors',
                      runSweepMutation.isPending && 'opacity-60 pointer-events-none'
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      runSweepMutation.mutate(sweep.id);
                    }}
                  >
                    Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  const renderDetailsPanel = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center text-dark-400">
          <p className="text-sm font-semibold text-white">No item selected</p>
          <p className="text-xs text-dark-400 mt-1">Choose a health check, error, scenario, or sweep to inspect.</p>
        </div>
      );
    }

    if (selected.type === 'health') {
      const detail = detailData as HealthCheckDetail | undefined;
      if (!detail) {
        return <LoadingRows />;
      }
      return (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Health Check</p>
            <p className="text-lg font-semibold text-white mt-1">{detail.branch}</p>
            <p className="text-xs text-dark-400">Triggered {timeAgo(detail.created_at)} by {detail.triggered_by}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tests', value: detail.tests_status },
              { label: 'Lint', value: detail.lint_status },
              { label: 'Build', value: detail.build_status },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-dark-800 bg-dark-900/80 p-3">
                <p className="text-xs text-dark-400">{item.label}</p>
                <p className={cn('text-sm font-semibold mt-1', item.value === 'pass' ? 'text-emerald-300' : item.value === 'warn' ? 'text-amber-300' : 'text-rose-300')}>
                  {item.value.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Summary</p>
            <p className="text-sm text-dark-300 mt-2">{detail.summary || 'No summary captured.'}</p>
          </div>
          {(['logs_tests', 'logs_lint', 'logs_build'] as const).map((key) => (
            detail[key] ? (
              <div key={key}>
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">
                  {key.replace('logs_', '').toUpperCase()}
                </p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-dark-900 border border-dark-800 p-3 text-xs font-mono text-dark-300 whitespace-pre-wrap">
                  {detail[key]}
                </pre>
              </div>
            ) : null
          ))}
        </div>
      );
    }

    if (selected.type === 'error') {
      const detail = detailData as RepoErrorDetail | undefined;
      if (!detail) return <LoadingRows />;
      return (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Error</p>
            <p className="text-lg font-semibold text-white mt-1">{detail.error_message}</p>
            <p className="text-xs text-dark-400">Signature: {detail.error_signature.slice(0, 12)}…</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-dark-300">
            <div className="rounded-xl bg-dark-900/80 border border-dark-800 p-3">
              <p className="text-dark-400 text-[11px] uppercase tracking-wide">Occurrences</p>
              <p className="text-sm text-white mt-1">{detail.occurrences}</p>
            </div>
            <div className="rounded-xl bg-dark-900/80 border border-dark-800 p-3">
              <p className="text-dark-400 text-[11px] uppercase tracking-wide">Last Seen</p>
              <p className="text-sm text-white mt-1">{timeAgo(detail.last_seen_at)}</p>
            </div>
          </div>
          {detail.last_context_route && (
            <div>
              <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Route</p>
              <p className="text-sm text-dark-200">{detail.last_context_route}</p>
            </div>
          )}
          {detail.stack_trace && (
            <div>
              <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Stack Trace</p>
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-dark-900 border border-dark-800 p-3 text-xs font-mono text-dark-300 whitespace-pre-wrap">
                {detail.stack_trace}
              </pre>
            </div>
          )}
          {detail.last_explanation && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3">
              <p className="text-xs font-semibold text-purple-200 uppercase tracking-wide">Agent Explanation</p>
              <p className="text-sm text-purple-100 mt-1">{detail.last_explanation}</p>
            </div>
          )}
          <div className="pt-4 border-t border-dark-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles text-purple-400" /> Repair Actions
              </p>
              <span className={cn('text-[11px] px-2 py-1 rounded-full border', selectedPatch ? statusTone(selectedPatch.status) : 'text-dark-400 border-dark-700')}>
                {selectedPatch ? selectedPatch.status.toUpperCase() : 'NO PATCH'}
              </span>
            </div>
            <button
              className={cn(
                'w-full px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors flex items-center justify-center gap-2',
                autoFixError.isPending && 'opacity-60 cursor-not-allowed'
              )}
              onClick={() => autoFixError.mutate(detail.id)}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-sm" />
              {autoFixError.isPending ? 'Analyzing…' : 'Analyze & Propose Patch'}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="px-4 py-2.5 rounded-xl border border-dark-700 text-dark-400 bg-dark-900/60 cursor-not-allowed"
                title="Apply endpoint coming soon"
              >
                Apply Patch (soon)
              </button>
              <button
                className="px-4 py-2.5 rounded-xl border border-dark-700 text-dark-400 bg-dark-900/60 cursor-not-allowed"
                title="PR automation coming soon"
              >
                Create PR (soon)
              </button>
            </div>
            {selectedPatch && (
              <div className="space-y-3 pt-3 border-t border-dark-800">
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Proposed Patch</p>
                {selectedPatch.summary && <p className="text-sm text-dark-200">{selectedPatch.summary}</p>}
                {selectedPatch.diffs.map((chunk) => (
                  <DiffBlock key={`${chunk.filePath}-${chunk.path}-${chunk.diff.slice(0, 10)}`} chunk={chunk} />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (selected.type === 'scenario') {
      const data = detailData as { scenario?: RepoScenario; run?: ScenarioRun | null } | null;
      if (!data?.scenario) return <LoadingRows />;
      return (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Scenario</p>
            <p className="text-lg font-semibold text-white">{data.scenario.label}</p>
            <p className="text-xs text-dark-400">{data.scenario.description || data.scenario.type}</p>
          </div>
          <div className="rounded-xl border border-dark-800 bg-dark-900/80 p-3">
            <p className="text-xs text-dark-400 uppercase tracking-wide">Latest run</p>
            <p className="text-sm text-white mt-1">
              {data.run ? `${data.run.status.toUpperCase()} • ${timeAgo(data.run.finished_at || data.run.started_at)}` : 'Never run'}
            </p>
            {data.run?.logs && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-dark-950 border border-dark-800 p-3 text-xs font-mono text-dark-300 whitespace-pre-wrap">
                {data.run.logs}
              </pre>
            )}
          </div>
        </div>
      );
    }

    if (selected.type === 'sweep') {
      const data = detailData as { sweep?: IntegritySweep; run?: IntegritySweepRun | null } | null;
      if (!data?.sweep) return <LoadingRows />;
      return (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Integrity Sweep</p>
            <p className="text-lg font-semibold text-white">{data.sweep.label}</p>
            <p className="text-xs text-dark-400">{data.sweep.description || data.sweep.name}</p>
          </div>
          <div className="rounded-xl border border-dark-800 bg-dark-900/80 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-dark-400 uppercase tracking-wide">Status</span>
              <span className={cn('px-2 py-1 text-[11px] rounded-full border font-semibold', statusTone(data.run?.status))}>
                {data.run?.status ? data.run.status.toUpperCase() : 'NEVER RUN'}
              </span>
            </div>
            {typeof data.run?.violation_count === 'number' && (
              <p className="text-sm text-white">{data.run.violation_count} violations</p>
            )}
            {data.run?.violation_summary && (
              <p className="text-sm text-dark-200">{data.run.violation_summary}</p>
            )}
            {data.run?.raw_report && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-dark-950 border border-dark-800 p-3 text-xs font-mono text-dark-300 whitespace-pre-wrap">
                {data.run.raw_report}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  if (roleState === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-950 text-white">
        <p>Loading Repo Guardian…</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-dark-950 text-white text-center px-6">
        <h1 className="text-2xl font-semibold">Repo Guardian</h1>
        <p className="text-dark-400 mt-2 max-w-md">
          This area is restricted to Super Admins. If you believe you should have access, please contact your HirePilot administrator.
        </p>
      </div>
    );
  }

  const chatMessages = chatConversation?.messages || [];
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  return (
    <div id="repo-guardian-page" className="min-h-screen bg-dark-950 text-white pb-10">
      <div className="px-6 py-6 space-y-4">
        <header className="sticky top-0 z-10 bg-dark-950/95 backdrop-blur border border-dark-900 rounded-2xl px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-shield-halved text-blue-400 text-2xl" />
              <div>
                <h1 className="text-xl md:text-2xl font-semibold text-white">Repo Guardian</h1>
                <p className="text-sm text-dark-400">System Health & Integrity Control Center</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={cn(
                'px-4 py-2 rounded-xl border border-dark-700 text-white flex items-center gap-2 bg-dark-900/70 hover:bg-dark-800 transition-colors',
                runFullCheck.isPending && 'opacity-60 cursor-not-allowed'
              )}
              onClick={() => runFullCheck.mutate()}
              disabled={runFullCheck.isPending}
            >
              <i className="fa-solid fa-play text-sm" />
              {runFullCheck.isPending ? 'Running…' : 'Run Full Check'}
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 transition-colors"
              onClick={() => setSettingsOpen(true)}
            >
              <i className="fa-solid fa-cog text-sm" />
              Settings
            </button>
          </div>
        </header>

        <div className="rounded-2xl border border-dark-900 bg-dark-950/70 px-4 py-3 text-xs text-dark-300 flex flex-wrap items-center gap-2">
          <span>{automationSummary}</span>
          <span className="text-dark-600">·</span>
          <span>Auto Fix: Off (manual review)</span>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard
            title="System Health"
            value={systemHealthValue}
            description={systemHealthDescription}
            icon={<i className="fa-solid fa-heart-pulse text-green-400 text-xl" />}
            accent={systemHealthAccent}
          />
          <SummaryCard
            title="Open Errors"
            value={String(openErrors.length)}
            description={openErrors[0]?.error_message?.slice(0, 32) || 'No active incidents'}
            icon={<i className="fa-solid fa-triangle-exclamation text-red-400 text-xl" />}
            accent="text-red-300"
          />
          <SummaryCard
            title="Scenarios"
            value={scenarioCount ? `${passingScenarios}/${scenarioCount}` : '--'}
            description={scenarioCount ? 'Passing vs total' : 'No scenarios yet'}
            icon={<i className="fa-solid fa-flask text-blue-400 text-xl" />}
            accent="text-white"
          />
          <SummaryCard
            title="Last Sweep"
            value={lastSweepRun ? timeAgo(lastSweepRun.finished_at || lastSweepRun.started_at) : '--'}
            description={lastSweepRun ? (lastSweepRun.status === 'clean' ? 'Clean' : 'Violations detected') : 'No sweeps yet'}
            icon={<i className="fa-solid fa-broom text-yellow-400 text-xl" />}
            accent="text-yellow-300"
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
          <div className="bg-dark-900/70 border border-dark-900 rounded-2xl h-[640px] flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b border-dark-800 px-4 pt-3 pb-2">
              {(['health', 'errors', 'scenarios', 'sweeps'] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-2',
                    activeTab === tab ? 'bg-dark-800 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-800/60'
                  )}
                >
                  {tab === 'health' && <i className="fa-solid fa-heartbeat" />}
                  {tab === 'errors' && <i className="fa-solid fa-bug" />}
                  {tab === 'scenarios' && <i className="fa-solid fa-flask" />}
                  {tab === 'sweeps' && <i className="fa-solid fa-broom" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">{renderTabContent()}</div>
          </div>

          <div className="space-y-4 h-[640px] flex flex-col">
            <div className="bg-dark-900/70 border border-dark-900 rounded-2xl flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <i className="fa-solid fa-info-circle text-blue-400" /> Details
                  </h3>
                  {selected && (
                    <p className="text-xs text-dark-400">
                      {selected.type === 'health' && 'Health Check'}
                      {selected.type === 'error' && 'Repo Error'}
                      {selected.type === 'scenario' && 'Scenario'}
                      {selected.type === 'sweep' && 'Integrity Sweep'}
                    </p>
                  )}
                </div>
              </div>
              {renderDetailsPanel()}
            </div>

            <div className="bg-dark-900/70 border border-dark-900 rounded-2xl flex flex-col h-[280px]">
              <div className="border-b border-dark-800 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <i className="fa-solid fa-robot text-purple-400" /> Repo Agent Chat
                  </h3>
                  <p className="text-[11px] text-dark-400">Ask about errors, health checks, or data sweeps.</p>
                </div>
                <div className="inline-flex items-center rounded-full border border-dark-800 bg-dark-900 p-1 text-[11px] text-dark-400">
                  <button
                    className={cn(
                      'px-3 py-1 rounded-full transition-colors',
                      chatMode === 'explain' ? 'bg-dark-800 text-white' : 'hover:text-white'
                    )}
                    onClick={() => setChatMode('explain')}
                  >
                    Explain Only
                  </button>
                  <button
                    className={cn(
                      'px-3 py-1 rounded-full transition-colors',
                      chatMode === 'patch' ? 'bg-dark-800 text-white' : 'hover:text-white'
                    )}
                    onClick={() => setChatMode('patch')}
                  >
                    Allow Patching
                  </button>
                </div>
              </div>
              <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-dark-400 text-center mt-6">Start the conversation and Repo Agent will respond here.</p>
                )}
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'max-w-[90%] rounded-2xl px-3 py-2 text-xs sm:text-sm border',
                      message.role === 'user'
                        ? 'ml-auto bg-emerald-500/20 border-emerald-500/40 text-emerald-50 rounded-br-sm'
                        : 'mr-auto bg-dark-900 border-dark-800 text-slate-100 rounded-bl-sm'
                    )}
                  >
                    <p>{message.content}</p>
                    <p className="text-[10px] text-dark-500 mt-1 text-right">{formatDateTime(message.created_at)}</p>
                  </div>
                ))}
                {chatSending && (
                  <p className="text-[11px] text-dark-400">Agent is thinking…</p>
                )}
              </div>
              <form
                className="border-t border-dark-800 bg-dark-950/80 backdrop-blur px-4 py-3 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSendMessage();
                }}
              >
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask about health, errors, or integrity…"
                  className="w-full min-h-[60px] max-h-[140px] resize-none rounded-xl bg-dark-950 border border-dark-800 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/40 text-sm text-white placeholder:text-dark-500 px-3 py-2 outline-none"
                />
                <div className="flex items-center justify-between text-[10px] text-dark-500">
                  <p>Press {isMac ? '⌘' : 'Ctrl'} + Enter to send</p>
                  <button
                    type="submit"
                    className={cn(
                      'px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors',
                      chatSending && 'opacity-60 cursor-not-allowed'
                    )}
                    disabled={chatSending}
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settingsQuery.data || null}
        onSave={handleSaveSettings}
        isSaving={settingsSaving}
      />
    </div>
  );
};

export default RepoGuardianPage;


