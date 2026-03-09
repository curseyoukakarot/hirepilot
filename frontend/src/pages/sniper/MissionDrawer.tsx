import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import type { MissionDef } from './MissionCard';
import AIMessageModal from './AIMessageModal';
import type { ProfileForAI } from './AIMessageModal';
import { useUserCredits } from '../../services/creditService';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ToastT = { show: boolean; message: string; type: 'success' | 'error' | 'info' };

function Toast({ show, message, type }: ToastT) {
  if (!show) return null;
  return (
    <div className="fixed top-5 right-5 z-[99999]">
      <div
        className={cx(
          'rounded-xl border px-4 py-3 shadow-xl backdrop-blur',
          'bg-white/90 border-slate-200 text-slate-900 dark:bg-slate-950/90 dark:border-slate-800 dark:text-slate-100',
          type === 'success' && 'border-emerald-300 dark:border-emerald-700/60',
          type === 'error' && 'border-rose-300 dark:border-rose-700/60',
          type === 'info' && 'border-sky-300 dark:border-sky-700/60',
        )}
      >
        <div className="text-sm font-semibold">{message}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Credit cost bar                                                    */
/* ------------------------------------------------------------------ */

function CreditCostBar({ cost, balance }: { cost: number; balance: number }) {
  const insufficient = balance < cost;
  return (
    <div className={cx(
      'flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-medium',
      insufficient
        ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-400'
        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-400',
    )}>
      <span>⚡ Estimated cost: <strong>{cost} credits</strong></span>
      <span className="tabular-nums">
        {insufficient ? (
          <span className="text-rose-600 dark:text-rose-400">Insufficient credits ({balance} remaining)</span>
        ) : (
          <span>{balance} credits remaining</span>
        )}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LinkedIn URL helpers                                               */
/* ------------------------------------------------------------------ */

function normalizeLinkedinUrl(input: unknown): string | null {
  const raw = String(input || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw) || !/linkedin\.com/i.test(raw)) return null;
  try {
    const u = new URL(raw);
    ['trk', 'lipi'].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return null;
  }
}

function extractLinkedinUrls(rows: unknown[], columnKey?: string): string[] {
  const arr = Array.isArray(rows) ? rows : [];
  const urls: string[] = [];
  for (const r of arr) {
    const obj = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
    const candidates: unknown[] = [];
    if (columnKey) candidates.push(obj[columnKey]);
    candidates.push(obj.linkedin_url, obj.linkedinUrl, obj.linkedin, obj.profile_url, obj.profileUrl, obj.url);
    for (const c of candidates) {
      const n = normalizeLinkedinUrl(c);
      if (n) { urls.push(n); break; }
    }
  }
  return Array.from(new Set(urls));
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type SniperSettings = {
  cloud_engine_enabled?: boolean;
  max_actions_per_day?: number;
  timezone?: string;
  active_hours_start?: string;
};

type Props = {
  mission: MissionDef;
  conn: { connected: boolean; profileId?: string };
  onClose: () => void;
  onNavigate: (tab: string) => void;
  initialProfileUrls?: string[];
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function MissionDrawer({ mission, conn, onClose, onNavigate, initialProfileUrls }: Props) {
  /* ---- Shared state ---- */
  const [toast, setToast] = useState<ToastT>({ show: false, message: '', type: 'info' });
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const showToast = (message: string, type: ToastT['type'] = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ show: true, message, type });
    toastTimer.current = setTimeout(() => setToast((p) => ({ ...p, show: false })), 3500);
  };

  const [settings, setSettings] = useState<SniperSettings | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  /* ---- Credits ---- */
  const { credits, refetch: refetchCredits } = useUserCredits();
  const CREDIT_COSTS: Record<string, number> = {
    prospect_post_engagers: 2, people_search: 3, jobs_intent: 5,
    sn_lead_search: 5, decision_maker_lookup: 10,
  };
  const CONNECT_COST_PER = 5;
  const MESSAGE_COST_PER = 5;
  const SN_CONNECT_COST_PER = 8;
  const SN_INMAIL_COST_PER = 10;
  const SN_MESSAGE_COST_PER = 5;

  /* ---- Load settings ---- */
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
        const API_ROOT = API_BASE ? `${API_BASE}/api` : '/api';
        const res = await fetch(`${API_ROOT}/sniper/settings`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setSettings(await res.json());
      } catch {}
    })();
  }, []);

  const cloudEnabled = Boolean(settings?.cloud_engine_enabled);
  const dailyCap = Number(settings?.max_actions_per_day);
  const effectiveDailyCap = Number.isFinite(dailyCap) && dailyCap > 0 ? dailyCap : null;

  /* ---- Schedule prompt state ---- */
  const [schedulePrompt, setSchedulePrompt] = useState<{
    open: boolean; title: string; limit: number; dailyCap: number;
  }>({ open: false, title: '', limit: 0, dailyCap: 0 });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const schedulePendingRef = useRef<{
    toolPayload?: Record<string, unknown>;
    scheduleName?: string;
    onRunOnce?: () => void;
  }>({});

  const scheduleTimezone = String(settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const scheduleStart = String(settings?.active_hours_start || '09:00');

  const buildDailyCronExpr = (start: string) => {
    const parts = String(start || '09:00').split(':');
    const h = Math.max(0, Math.min(Number(parts[0] || 9), 23));
    const m = Math.max(0, Math.min(Number(parts[1] || 0), 59));
    return `${m} ${h} * * *`;
  };

  const promptScheduleIfNeeded = (opts: {
    limit: number; title: string; scheduleName: string;
    toolPayload: Record<string, unknown>;
    onRunOnce: () => void;
  }) => {
    schedulePendingRef.current = opts;
    if (effectiveDailyCap && opts.limit > effectiveDailyCap) {
      setSchedulePrompt({ open: true, title: opts.title, limit: opts.limit, dailyCap: effectiveDailyCap });
    } else {
      opts.onRunOnce();
    }
  };

  const handleScheduleDaily = async () => {
    const pending = schedulePendingRef.current || {};
    const toolPayload = pending.toolPayload || {};
    if (!toolPayload?.job_type) {
      showToast('Missing job payload for schedule.', 'error');
      setSchedulePrompt((p) => ({ ...p, open: false }));
      return;
    }
    setScheduleSaving(true);
    try {
      const perRunLimit = effectiveDailyCap && effectiveDailyCap > 0
        ? Math.min(Number(toolPayload.limit || effectiveDailyCap), effectiveDailyCap)
        : toolPayload.limit;
      await apiPost('/api/schedules', {
        name: pending.scheduleName || 'Cloud Engine Mission',
        action_type: 'launch_campaign',
        schedule_kind: 'recurring',
        cron_expr: buildDailyCronExpr(scheduleStart),
        run_at: null,
        action_tool: 'sniper.run_job',
        tool_payload: { ...toolPayload, limit: perRunLimit, timezone: scheduleTimezone },
      });
      showToast('Daily schedule created. It will run automatically.', 'success');
      setSchedulePrompt((p) => ({ ...p, open: false }));
      setTimeout(() => onClose(), 1200);
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to create schedule', 'error');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleRunOnceAnyway = () => {
    const pending = schedulePendingRef.current || {};
    setSchedulePrompt((p) => ({ ...p, open: false }));
    pending.onRunOnce?.();
  };

  /* ---- Per-mission form state ---- */
  const [postUrl, setPostUrl] = useState('');
  const [runLimit, setRunLimit] = useState(200);

  const [searchUrl, setSearchUrl] = useState('');
  const [searchLimit, setSearchLimit] = useState(mission.id === 'jobs_intent' ? 100 : 200);

  const [profileUrls, setProfileUrls] = useState<string[]>(
    initialProfileUrls?.length ? Array.from(new Set(initialProfileUrls)) : []
  );
  const [connectNote, setConnectNote] = useState('');
  const [messageText, setMessageText] = useState('');
  const [inmailSubject, setInmailSubject] = useState('');

  const [companyUrls, setCompanyUrls] = useState('');
  const [limitPerCompany, setLimitPerCompany] = useState(3);
  const [dmCriteria, setDmCriteria] = useState('');

  const [addLeadsOpen, setAddLeadsOpen] = useState(false);

  /* ---- AI Message Generator state ---- */
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalMode, setAiModalMode] = useState<'connect_note' | 'message'>('connect_note');
  const [perProfileNotes, setPerProfileNotes] = useState<Map<string, string>>(new Map());

  const profilesForAI: ProfileForAI[] = useMemo(() => {
    return profileUrls.map((url) => ({
      profile_url: url,
      name: null,
      headline: null,
      company_name: null,
    }));
  }, [profileUrls]);

  const handleAIApply = (messages: Map<string, string>) => {
    if (aiModalMode === 'connect_note') {
      setPerProfileNotes(messages);
      const first = messages.values().next().value;
      if (first) setConnectNote(first);
    } else {
      const first = messages.values().next().value;
      if (first) setMessageText(first);
    }
  };

  /* ---- Saved targets (post engagement only) ---- */
  const [targets, setTargets] = useState<Array<{
    id: string; post_url: string; status: string;
    last_run_status?: string; last_run_at?: string; last_run_leads_found?: number;
  }>>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (mission.id !== 'post_engagement') return;
    (async () => {
      try {
        const res = await apiGet('/api/sniper/targets');
        setTargets(Array.isArray(res) ? res : []);
      } catch {}
    })();
  }, [mission.id]);

  const selectedTarget = selectedTargetId ? targets.find((t) => String(t.id) === String(selectedTargetId)) : null;

  /* ---- API actions ---- */

  const createAndRun = async () => {
    const url = String(postUrl || '').trim();
    if (!url) return showToast('Paste a LinkedIn post URL.', 'info');
    setWorkingId('create');
    try {
      showToast('Target created. Run queued...', 'info');
      await apiPost('/api/sniper/targets', { type: 'linkedin_post_engagement', post_url: url, auto_run: true });
      setPostUrl('');
      const res = await apiGet('/api/sniper/targets');
      setTargets(Array.isArray(res) ? res : []);
      showToast('Run queued.', 'success');
    } catch (e: unknown) {
      showToast(`Create failed: ${(e as Error)?.message || 'Unknown error'}`, 'error');
    } finally {
      setWorkingId(null);
    }
  };

  const runNow = async (id: string, limit = 200) => {
    setWorkingId(id);
    try {
      showToast('Run queued...', 'info');
      const n = Number(limit);
      const safeLimit = Math.max(1, Math.min(Number.isFinite(n) && n > 0 ? n : 200, 1000));
      await apiPost(`/api/sniper/targets/${id}/run`, { limit: safeLimit });
      showToast('Run queued.', 'success');
    } catch (e: unknown) {
      showToast(`Run failed: ${(e as Error)?.message || 'Unknown error'}`, 'error');
    } finally {
      setWorkingId(null);
    }
  };

  const queuePeopleSearch = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to run this mission.', 'info');
    const url = String(searchUrl || '').trim();
    if (!url) return showToast('Paste a LinkedIn people search URL.', 'info');
    const limit = Math.max(1, Math.min(Number(searchLimit) || 200, 2000));
    promptScheduleIfNeeded({
      limit,
      title: 'People Search run exceeds daily cap.',
      scheduleName: `Cloud Engine - People Search - Daily (${limit})`,
      toolPayload: { job_type: 'people_search', search_url: url, limit },
      onRunOnce: async () => {
        setWorkingId('people_search');
        try {
          const out = await apiPost('/api/sniper/jobs', {
            target_id: null, job_type: 'people_search', input_json: { search_url: url, limit },
          });
          showToast('People Search queued. Track progress in Activity.', 'success');
          const jobId = (out as Record<string, unknown>)?.job
            ? ((out as Record<string, unknown>).job as Record<string, unknown>)?.id
            : (out as Record<string, unknown>)?.job_id;
          if (jobId) {
            onNavigate('activity');
          }
        } catch (e: unknown) {
          showToast((e as Error)?.message || 'Failed to queue People Search', 'error');
        } finally {
          setWorkingId(null);
        }
      },
    });
  };

  const queueJobsIntent = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to run this mission.', 'info');
    const url = String(searchUrl || '').trim();
    if (!url) return showToast('Paste a LinkedIn Jobs search URL.', 'info');
    const limit = Math.max(1, Math.min(Number(searchLimit) || 100, 2000));
    promptScheduleIfNeeded({
      limit,
      title: 'Jobs Intent run exceeds daily cap.',
      scheduleName: `Cloud Engine - Jobs Intent - Daily (${limit})`,
      toolPayload: { job_type: 'jobs_intent', search_url: url, limit },
      onRunOnce: async () => {
        setWorkingId('jobs_intent');
        try {
          const out = await apiPost('/api/sniper/jobs', {
            target_id: null, job_type: 'jobs_intent', input_json: { search_url: url, limit },
          });
          showToast('Jobs Intent queued. Track progress in Activity.', 'success');
          refetchCredits();
          const jobId = (out as Record<string, unknown>)?.job
            ? ((out as Record<string, unknown>).job as Record<string, unknown>)?.id
            : (out as Record<string, unknown>)?.job_id;
          if (jobId) {
            onNavigate('activity');
          }
        } catch (e: unknown) {
          showToast((e as Error)?.message || 'Failed to queue Jobs Intent', 'error');
        } finally {
          setWorkingId(null);
        }
      },
    });
  };

  const queueDecisionMakerLookup = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to run this mission.', 'info');
    const urls = companyUrls
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u && /linkedin\.com\/company\//i.test(u));
    if (!urls.length) return showToast('Paste at least one LinkedIn company URL.', 'info');
    const companies = urls.map((url) => ({ company_url: url.split('?')[0].replace(/\/+$/, '') }));
    setWorkingId('decision_maker_lookup');
    try {
      await apiPost('/api/sniper/jobs', {
        target_id: null,
        job_type: 'decision_maker_lookup',
        input_json: { companies, limit_per_company: limitPerCompany, criteria: dmCriteria.trim() || null },
      });
      showToast('Decision Maker Lookup queued. Track progress in Activity.', 'success');
      refetchCredits();
      onNavigate('activity');
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to queue Decision Maker Lookup', 'error');
    } finally {
      setWorkingId(null);
    }
  };

  const queueConnectRequests = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to queue requests.', 'info');
    if (!profileUrls.length) return showToast('Add leads first (LinkedIn profile URLs).', 'info');
    const note = String(connectNote || '').trim();
    if (note.length > 300) return showToast('Connect note must be 300 characters or less.', 'error');
    setWorkingId('connect');
    try {
      // Use per-profile notes if AI-generated
      const hasPerProfile = perProfileNotes.size > 0;
      const payload = hasPerProfile
        ? {
            requests: profileUrls.map((url) => ({
              profile_url: url,
              note: perProfileNotes.get(url) || note || null,
            })),
          }
        : { profile_urls: profileUrls, note: note || null };
      await apiPost('/api/sniper/actions/connect', payload);
      showToast(hasPerProfile ? 'Queued personalized connection requests. Track progress in Activity.' : 'Queued connection requests. Track progress in Activity.', 'success');
      refetchCredits();
      setTimeout(() => onClose(), 1200);
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to queue connection requests', 'error');
    } finally {
      setWorkingId(null);
    }
  };

  const queueSendMessages = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to queue messages.', 'info');
    if (!profileUrls.length) return showToast('Add leads first (LinkedIn profile URLs).', 'info');
    const msg = String(messageText || '').trim();
    if (!msg) return showToast('Message is required.', 'info');
    if (msg.length > 3000) return showToast('Message must be 3000 characters or less.', 'error');
    setWorkingId('message');
    try {
      await apiPost('/api/sniper/actions/message', { profile_urls: profileUrls, message: msg });
      showToast('Queued messages. Track progress in Activity.', 'success');
      setTimeout(() => onClose(), 1200);
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to queue messages', 'error');
    } finally {
      setWorkingId(null);
    }
  };

  /* ---- SN Lead Search ---- */
  const queueSnLeadSearch = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to run this mission.', 'info');
    const url = String(searchUrl || '').trim();
    if (!url) return showToast('Paste a Sales Navigator search URL.', 'info');
    const limit = Math.max(1, Math.min(Number(searchLimit) || 200, 2000));
    promptScheduleIfNeeded({
      limit,
      title: 'SN Lead Search run exceeds daily cap.',
      scheduleName: `Cloud Engine - SN Lead Search - Daily (${limit})`,
      toolPayload: { job_type: 'sn_lead_search', search_url: url, limit },
      onRunOnce: async () => {
        setWorkingId('sn_lead_search');
        try {
          const out = await apiPost('/api/sniper/jobs', {
            target_id: null, job_type: 'sn_lead_search', input_json: { search_url: url, limit },
          });
          showToast('SN Lead Search queued. Track progress in Activity.', 'success');
          const jobId = (out as Record<string, unknown>)?.job
            ? ((out as Record<string, unknown>).job as Record<string, unknown>)?.id
            : (out as Record<string, unknown>)?.job_id;
          if (jobId) onNavigate('activity');
        } catch (e: unknown) {
          showToast((e as Error)?.message || 'Failed to queue SN Lead Search', 'error');
        } finally {
          setWorkingId(null);
        }
      },
    });
  };

  /* ---- SN Connect ---- */
  const queueSnConnect = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to queue requests.', 'info');
    if (!profileUrls.length) return showToast('Add leads first (LinkedIn profile URLs).', 'info');
    const note = String(connectNote || '').trim();
    if (note.length > 300) return showToast('Connect note must be 300 characters or less.', 'error');
    setWorkingId('sn_connect');
    try {
      await apiPost('/api/sniper/actions/sn-connect', { profile_urls: profileUrls, note: note || null });
      showToast('Queued SN connection requests. Track progress in Activity.', 'success');
      setTimeout(() => onClose(), 1200);
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to queue SN connection requests', 'error');
    } finally {
      setWorkingId(null);
    }
  };

  /* ---- SN InMail ---- */
  const queueSnInMail = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to queue InMails.', 'info');
    if (!profileUrls.length) return showToast('Add leads first (LinkedIn profile URLs).', 'info');
    const subj = String(inmailSubject || '').trim();
    if (!subj) return showToast('Subject line is required for InMail.', 'info');
    if (subj.length > 200) return showToast('Subject must be 200 characters or less.', 'error');
    const msg = String(messageText || '').trim();
    if (!msg) return showToast('Message is required.', 'info');
    if (msg.length > 1900) return showToast('InMail message must be 1900 characters or less.', 'error');
    setWorkingId('sn_inmail');
    try {
      await apiPost('/api/sniper/actions/sn-inmail', { profile_urls: profileUrls, subject: subj, message: msg });
      showToast('Queued InMails. Track progress in Activity.', 'success');
      setTimeout(() => onClose(), 1200);
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to queue InMails', 'error');
    } finally {
      setWorkingId(null);
    }
  };

  /* ---- SN Message ---- */
  const queueSnMessage = async () => {
    if (!cloudEnabled) return showToast('Enable Cloud Engine in Settings to queue messages.', 'info');
    if (!profileUrls.length) return showToast('Add leads first (LinkedIn profile URLs).', 'info');
    const msg = String(messageText || '').trim();
    if (!msg) return showToast('Message is required.', 'info');
    if (msg.length > 3000) return showToast('Message must be 3000 characters or less.', 'error');
    setWorkingId('sn_message');
    try {
      await apiPost('/api/sniper/actions/sn-message', { profile_urls: profileUrls, message: msg });
      showToast('Queued SN messages. Track progress in Activity.', 'success');
      setTimeout(() => onClose(), 1200);
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to queue SN messages', 'error');
    } finally {
      setWorkingId(null);
    }
  };

  /* ---- Schedule Picker state ---- */
  const [schedMode, setSchedMode] = useState('manual');
  const [schedName, setSchedName] = useState(`Cloud Engine - ${mission.title}`);
  const [schedRunAt, setSchedRunAt] = useState('');
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedWeekday, setSchedWeekday] = useState('1');
  const [schedSaving, setSchedSaving] = useState(false);

  const buildSchedulePayload = (): Record<string, unknown> => {
    switch (mission.id) {
      case 'post_engagement':
        return {
          job_type: 'prospect_post_engagers',
          post_url: selectedTarget?.post_url || String(postUrl || '').trim(),
          limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
        };
      case 'people_search':
        return {
          job_type: 'people_search',
          search_url: String(searchUrl || '').trim(),
          limit: Math.max(1, Math.min(Number(searchLimit) || 200, 2000)),
        };
      case 'jobs_intent':
        return {
          job_type: 'jobs_intent',
          search_url: String(searchUrl || '').trim(),
          limit: Math.max(1, Math.min(Number(searchLimit) || 100, 2000)),
        };
      case 'connect_requests':
        return {
          job_type: 'send_connect_requests',
          profile_urls: profileUrls,
          note: String(connectNote || '').trim().slice(0, 300) || null,
        };
      case 'send_message':
        return {
          job_type: 'send_messages',
          profile_urls: profileUrls,
          message: String(messageText || '').trim().slice(0, 3000),
        };
      case 'sn_lead_search':
        return {
          job_type: 'sn_lead_search',
          search_url: String(searchUrl || '').trim(),
          limit: Math.max(1, Math.min(Number(searchLimit) || 200, 2000)),
        };
      case 'sn_connect':
        return {
          job_type: 'sn_send_connect',
          profile_urls: profileUrls,
          note: String(connectNote || '').trim().slice(0, 300) || null,
        };
      case 'sn_inmail':
        return {
          job_type: 'sn_send_inmail',
          profile_urls: profileUrls,
          subject: String(inmailSubject || '').trim().slice(0, 200),
          message: String(messageText || '').trim().slice(0, 1900),
        };
      case 'sn_message':
        return {
          job_type: 'sn_send_message',
          profile_urls: profileUrls,
          message: String(messageText || '').trim().slice(0, 3000),
        };
      default:
        return {};
    }
  };

  const saveSchedule = async () => {
    if (schedMode === 'manual') return showToast('Select a schedule type first.', 'info');
    const toolPayload = { ...buildSchedulePayload(), timezone: scheduleTimezone };
    if (!toolPayload?.job_type) return showToast('Missing job type for schedule.', 'error');

    let schedule_kind = 'one_time';
    let run_at: string | null = null;
    let cron_expr: string | null = null;

    if (schedMode === 'run_at') {
      const v = String(schedRunAt || '').trim();
      if (!v) return showToast('Pick a valid date/time.', 'info');
      const d = new Date(v);
      if (!Number.isFinite(d.getTime())) return showToast('Pick a valid date/time.', 'info');
      run_at = d.toISOString();
      schedule_kind = 'one_time';
    } else {
      const parts = String(schedTime || '09:00').split(':');
      const h = Math.max(0, Math.min(Number(parts[0] || 9), 23));
      const m = Math.max(0, Math.min(Number(parts[1] || 0), 59));
      cron_expr = schedMode === 'weekly' ? `${m} ${h} * * ${schedWeekday}` : `${m} ${h} * * *`;
      schedule_kind = 'recurring';
    }

    setSchedSaving(true);
    try {
      await apiPost('/api/schedules', {
        name: String(schedName || `Cloud Engine - ${mission.title}`),
        action_type: 'launch_campaign',
        schedule_kind, cron_expr, run_at,
        action_tool: 'sniper.run_job',
        tool_payload: toolPayload,
      });
      showToast('Schedule saved. It will run automatically.', 'success');
      setTimeout(() => onClose(), 1200);
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to create schedule', 'error');
    } finally {
      setSchedSaving(false);
    }
  };

  /* ---- Cloud Engine disabled banner ---- */
  const disabledBanner = !cloudEnabled ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/20">
      <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">Cloud Engine is disabled</div>
      <div className="mt-1 text-sm text-amber-700 dark:text-amber-200/80">
        Enable Cloud Engine in{' '}
        <button type="button" onClick={() => { onClose(); onNavigate('settings'); }} className="text-indigo-600 hover:underline dark:text-indigo-400">
          Settings
        </button>{' '}
        to run this mission.
      </div>
    </div>
  ) : null;

  /* ---- Render ---- */
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Toast show={toast.show} message={toast.message} type={toast.type} />
      <SchedulePromptModal
        open={schedulePrompt.open}
        title={schedulePrompt.title}
        limit={schedulePrompt.limit}
        dailyCap={schedulePrompt.dailyCap}
        saving={scheduleSaving}
        onClose={() => setSchedulePrompt((p) => ({ ...p, open: false }))}
        onSchedule={handleScheduleDaily}
        onRunOnce={handleRunOnceAnyway}
      />
      <AddLeadsModal
        open={addLeadsOpen}
        onClose={() => setAddLeadsOpen(false)}
        onConfirm={(urls) => {
          setProfileUrls((prev) => Array.from(new Set([...prev, ...urls])));
          setAddLeadsOpen(false);
        }}
      />
      <AIMessageModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        profiles={profilesForAI}
        mode={aiModalMode}
        onApply={handleAIApply}
      />

      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className={cx('inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm text-lg', mission.color)}>
              {mission.emoji}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{mission.title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{mission.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          {disabledBanner}

          {/* ═══ POST ENGAGEMENT ═══ */}
          {mission.id === 'post_engagement' && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">LinkedIn post URL</label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/posts/..."
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={createAndRun}
                    disabled={workingId === 'create'}
                    className={cx(
                      'rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500',
                      workingId === 'create' && 'opacity-70 cursor-not-allowed',
                    )}
                  >
                    {workingId === 'create' ? 'Creating...' : 'Create + Run'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Run limit</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={runLimit}
                    onChange={(e) => setRunLimit(Number(e.target.value))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {effectiveDailyCap ? (
                    <div className="mt-2 text-[11px] text-slate-500">Daily cap: {effectiveDailyCap} profiles.</div>
                  ) : null}
                </div>

                {targets.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Run saved mission</label>
                    <select
                      value={selectedTargetId || ''}
                      onChange={(e) => setSelectedTargetId(e.target.value || null)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Select a mission...</option>
                      {targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {String(t.post_url || '').slice(0, 50)}{String(t.post_url || '').length > 50 ? '...' : ''}
                        </option>
                      ))}
                    </select>
                    <CreditCostBar cost={CREDIT_COSTS.prospect_post_engagers || 2} balance={credits.remainingCredits} />
                    <button
                      type="button"
                      disabled={!selectedTarget || workingId === selectedTarget?.id || credits.remainingCredits < (CREDIT_COSTS.prospect_post_engagers || 2)}
                      onClick={() => selectedTarget && promptScheduleIfNeeded({
                        limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
                        title: 'Post Engagement run exceeds daily cap.',
                        scheduleName: `Cloud Engine - Post Engagement - Daily (${runLimit})`,
                        toolPayload: { job_type: 'prospect_post_engagers', post_url: selectedTarget.post_url, limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)) },
                        onRunOnce: () => runNow(selectedTarget.id, runLimit),
                      })}
                      className={cx(
                        'mt-2 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500',
                        (!selectedTarget || workingId === selectedTarget?.id || credits.remainingCredits < (CREDIT_COSTS.prospect_post_engagers || 2)) && 'opacity-70 cursor-not-allowed',
                      )}
                    >
                      Run now
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ PEOPLE SEARCH ═══ */}
          {mission.id === 'people_search' && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Search URL</label>
                <input
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/search/results/people/?keywords=..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-2 text-xs text-slate-500">Tip: Use the URL from your LinkedIn people search results page.</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Limit</label>
                <input
                  type="number" min={1} max={2000} value={searchLimit}
                  onChange={(e) => setSearchLimit(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {effectiveDailyCap ? (
                  <div className="mt-2 text-[11px] text-slate-500">Daily cap: {effectiveDailyCap} profiles.</div>
                ) : null}
              </div>
              <CreditCostBar cost={CREDIT_COSTS.people_search || 3} balance={credits.remainingCredits} />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('activity')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Activity
                </button>
                <button
                  type="button"
                  disabled={!cloudEnabled || workingId === 'people_search' || credits.remainingCredits < (CREDIT_COSTS.people_search || 3)}
                  onClick={queuePeopleSearch}
                  className={cx(
                    'rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500',
                    (!cloudEnabled || workingId === 'people_search' || credits.remainingCredits < (CREDIT_COSTS.people_search || 3)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'people_search' ? 'Queuing...' : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ JOBS INTENT ═══ */}
          {mission.id === 'jobs_intent' && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Jobs search URL</label>
                <input
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/jobs/search/?keywords=..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-2 text-xs text-slate-500">Tip: Use the URL from your LinkedIn Jobs search results page.</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Limit</label>
                <input
                  type="number" min={1} max={2000} value={searchLimit}
                  onChange={(e) => setSearchLimit(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {effectiveDailyCap ? (
                  <div className="mt-2 text-[11px] text-slate-500">Daily cap: {effectiveDailyCap} profiles.</div>
                ) : null}
              </div>
              <CreditCostBar cost={CREDIT_COSTS.jobs_intent || 5} balance={credits.remainingCredits} />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('activity')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Activity
                </button>
                <button
                  type="button"
                  disabled={!cloudEnabled || workingId === 'jobs_intent' || credits.remainingCredits < (CREDIT_COSTS.jobs_intent || 5)}
                  onClick={queueJobsIntent}
                  className={cx(
                    'rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500',
                    (!cloudEnabled || workingId === 'jobs_intent' || credits.remainingCredits < (CREDIT_COSTS.jobs_intent || 5)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'jobs_intent' ? 'Queuing...' : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ DECISION MAKER LOOKUP ═══ */}
          {mission.id === 'decision_maker_lookup' && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Company URLs</label>
                <textarea
                  value={companyUrls}
                  onChange={(e) => setCompanyUrls(e.target.value)}
                  rows={5}
                  placeholder={"https://www.linkedin.com/company/acme-corp/\nhttps://www.linkedin.com/company/example-inc/"}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-2 text-xs text-slate-500">
                  Paste LinkedIn company URLs, one per line. Tip: Use results from Jobs Intent Miner for best results.
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Who are you looking for? (optional)</label>
                <textarea
                  value={dmCriteria}
                  onChange={(e) => setDmCriteria(e.target.value)}
                  rows={3}
                  placeholder={'E.g., "VP or Director of Engineering who would buy our AI platform" or "Someone who controls the recruiting budget"'}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-2 text-[11px] text-slate-500">
                  Describe your ideal contact. Leave blank to find all senior decision makers (VP, Director, C-suite, etc.)
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Profiles per company</label>
                <input
                  type="number" min={1} max={10} value={limitPerCompany}
                  onChange={(e) => setLimitPerCompany(Math.max(1, Math.min(10, Number(e.target.value) || 3)))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-2 text-[11px] text-slate-500">
                  Number of decision makers to find at each company (1-10).
                </div>
              </div>
              <CreditCostBar cost={CREDIT_COSTS.decision_maker_lookup || 10} balance={credits.remainingCredits} />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('activity')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Activity
                </button>
                <button
                  type="button"
                  disabled={!cloudEnabled || workingId === 'decision_maker_lookup' || credits.remainingCredits < (CREDIT_COSTS.decision_maker_lookup || 10)}
                  onClick={queueDecisionMakerLookup}
                  className={cx(
                    'rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-500',
                    (!cloudEnabled || workingId === 'decision_maker_lookup' || credits.remainingCredits < (CREDIT_COSTS.decision_maker_lookup || 10)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'decision_maker_lookup' ? 'Queuing...' : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ CONNECT REQUESTS ═══ */}
          {mission.id === 'connect_requests' && (
            <>
              <LeadsSection
                profileUrls={profileUrls}
                onAddLeads={() => setAddLeadsOpen(true)}
                onClear={() => setProfileUrls([])}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Optional connect note (max 300 chars)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setAiModalMode('connect_note'); setAiModalOpen(true); }}
                      disabled={!profileUrls.length}
                      className={cx(
                        'text-[11px] font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-400',
                        !profileUrls.length && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      ✨ AI Generate
                    </button>
                    <TemplatePicker onSelect={(body) => setConnectNote(body.slice(0, 300))} />
                  </div>
                </div>
                {perProfileNotes.size > 0 && (
                  <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-800/50 dark:bg-violet-950/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                        ✨ {perProfileNotes.size} personalized note{perProfileNotes.size !== 1 ? 's' : ''} ready
                      </span>
                      <button
                        type="button"
                        onClick={() => setPerProfileNotes(new Map())}
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
                <textarea
                  value={connectNote}
                  onChange={(e) => { setConnectNote(e.target.value); setPerProfileNotes(new Map()); }}
                  rows={3}
                  maxLength={300}
                  placeholder={perProfileNotes.size > 0 ? 'AI-generated per-profile notes will be used' : 'Optional note to include with the connection request.'}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500">{String(connectNote || '').length}/300</div>
              </div>
              {profileUrls.length > 0 && (
                <CreditCostBar cost={profileUrls.length * CONNECT_COST_PER} balance={credits.remainingCredits} />
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('activity')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Activity
                </button>
                <button
                  type="button"
                  disabled={!cloudEnabled || !profileUrls.length || workingId === 'connect' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * CONNECT_COST_PER)}
                  onClick={queueConnectRequests}
                  className={cx(
                    'rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500',
                    (!cloudEnabled || !profileUrls.length || workingId === 'connect' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * CONNECT_COST_PER)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'connect'
                    ? 'Queuing...'
                    : perProfileNotes.size > 0
                      ? `Queue ${perProfileNotes.size} Personalized`
                      : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ SEND MESSAGE ═══ */}
          {mission.id === 'send_message' && (
            <>
              <LeadsSection
                profileUrls={profileUrls}
                onAddLeads={() => setAddLeadsOpen(true)}
                onClear={() => setProfileUrls([])}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Message (required, max 3000 chars)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setAiModalMode('message'); setAiModalOpen(true); }}
                      disabled={!profileUrls.length}
                      className={cx(
                        'text-[11px] font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-400',
                        !profileUrls.length && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      ✨ AI Generate
                    </button>
                    <TemplatePicker onSelect={(body) => setMessageText(body.slice(0, 3000))} />
                  </div>
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={5}
                  maxLength={3000}
                  placeholder="Write your message..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500">{String(messageText || '').length}/3000</div>
              </div>
              {profileUrls.length > 0 && (
                <CreditCostBar cost={profileUrls.length * MESSAGE_COST_PER} balance={credits.remainingCredits} />
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('activity')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Activity
                </button>
                <button
                  type="button"
                  disabled={!cloudEnabled || !profileUrls.length || !String(messageText || '').trim() || workingId === 'message' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * MESSAGE_COST_PER)}
                  onClick={queueSendMessages}
                  className={cx(
                    'rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500',
                    (!cloudEnabled || !profileUrls.length || !String(messageText || '').trim() || workingId === 'message' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * MESSAGE_COST_PER)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'message' ? 'Queuing...' : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ SN LEAD SEARCH ═══ */}
          {mission.id === 'sn_lead_search' && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Sales Navigator Search URL</label>
                <input
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/sales/search/people?..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-2 text-xs text-slate-500">Tip: Copy the URL from your Sales Navigator lead search page. Requires active SN subscription.</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Limit</label>
                <input
                  type="number" min={1} max={2000} value={searchLimit}
                  onChange={(e) => setSearchLimit(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {effectiveDailyCap ? (
                  <div className="mt-2 text-[11px] text-slate-500">Daily cap: {effectiveDailyCap} profiles.</div>
                ) : null}
              </div>
              <CreditCostBar cost={CREDIT_COSTS.sn_lead_search || 5} balance={credits.remainingCredits} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => onNavigate('activity')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">View Activity</button>
                <button
                  type="button"
                  disabled={!cloudEnabled || workingId === 'sn_lead_search' || credits.remainingCredits < (CREDIT_COSTS.sn_lead_search || 5)}
                  onClick={queueSnLeadSearch}
                  className={cx(
                    'rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500',
                    (!cloudEnabled || workingId === 'sn_lead_search' || credits.remainingCredits < (CREDIT_COSTS.sn_lead_search || 5)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'sn_lead_search' ? 'Queuing...' : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ SN CONNECT ═══ */}
          {mission.id === 'sn_connect' && (
            <>
              <LeadsSection profileUrls={profileUrls} onAddLeads={() => setAddLeadsOpen(true)} onClear={() => setProfileUrls([])} />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Optional connect note (max 300 chars)</label>
                  <TemplatePicker onSelect={(body) => setConnectNote(body.slice(0, 300))} />
                </div>
                <textarea
                  value={connectNote}
                  onChange={(e) => setConnectNote(e.target.value)}
                  rows={3} maxLength={300}
                  placeholder="Optional note to include with the connection request."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500">{String(connectNote || '').length}/300</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
                <div className="text-xs text-amber-800 dark:text-amber-200">Requires active Sales Navigator subscription on your LinkedIn account.</div>
              </div>
              {profileUrls.length > 0 && (
                <CreditCostBar cost={profileUrls.length * SN_CONNECT_COST_PER} balance={credits.remainingCredits} />
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => onNavigate('activity')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">View Activity</button>
                <button
                  type="button"
                  disabled={!cloudEnabled || !profileUrls.length || workingId === 'sn_connect' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * SN_CONNECT_COST_PER)}
                  onClick={queueSnConnect}
                  className={cx(
                    'rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500',
                    (!cloudEnabled || !profileUrls.length || workingId === 'sn_connect' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * SN_CONNECT_COST_PER)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'sn_connect' ? 'Queuing...' : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ SN INMAIL ═══ */}
          {mission.id === 'sn_inmail' && (
            <>
              <LeadsSection profileUrls={profileUrls} onAddLeads={() => setAddLeadsOpen(true)} onClear={() => setProfileUrls([])} />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Subject line (required, max 200 chars)</label>
                <input
                  value={inmailSubject}
                  onChange={(e) => setInmailSubject(e.target.value)}
                  maxLength={200}
                  placeholder="InMail subject line..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500">{String(inmailSubject || '').length}/200</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Message (required, max 1900 chars)</label>
                  <TemplatePicker onSelect={(body) => setMessageText(body.slice(0, 1900))} />
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={5} maxLength={1900}
                  placeholder="Write your InMail message..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500">{String(messageText || '').length}/1900</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
                <div className="text-xs text-amber-800 dark:text-amber-200">Requires active Sales Navigator subscription. Each InMail uses one credit from your SN account.</div>
              </div>
              {profileUrls.length > 0 && (
                <CreditCostBar cost={profileUrls.length * SN_INMAIL_COST_PER} balance={credits.remainingCredits} />
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => onNavigate('activity')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">View Activity</button>
                <button
                  type="button"
                  disabled={!cloudEnabled || !profileUrls.length || !String(inmailSubject || '').trim() || !String(messageText || '').trim() || workingId === 'sn_inmail' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * SN_INMAIL_COST_PER)}
                  onClick={queueSnInMail}
                  className={cx(
                    'rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500',
                    (!cloudEnabled || !profileUrls.length || !String(inmailSubject || '').trim() || !String(messageText || '').trim() || workingId === 'sn_inmail' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * SN_INMAIL_COST_PER)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'sn_inmail' ? 'Queuing...' : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ SN MESSAGE ═══ */}
          {mission.id === 'sn_message' && (
            <>
              <LeadsSection profileUrls={profileUrls} onAddLeads={() => setAddLeadsOpen(true)} onClear={() => setProfileUrls([])} />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Message (required, max 3000 chars)</label>
                  <TemplatePicker onSelect={(body) => setMessageText(body.slice(0, 3000))} />
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={5} maxLength={3000}
                  placeholder="Write your message..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500">{String(messageText || '').length}/3000</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
                <div className="text-xs text-amber-800 dark:text-amber-200">Requires active Sales Navigator subscription. Target must be a 1st-degree connection.</div>
              </div>
              {profileUrls.length > 0 && (
                <CreditCostBar cost={profileUrls.length * SN_MESSAGE_COST_PER} balance={credits.remainingCredits} />
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => onNavigate('activity')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">View Activity</button>
                <button
                  type="button"
                  disabled={!cloudEnabled || !profileUrls.length || !String(messageText || '').trim() || workingId === 'sn_message' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * SN_MESSAGE_COST_PER)}
                  onClick={queueSnMessage}
                  className={cx(
                    'rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500',
                    (!cloudEnabled || !profileUrls.length || !String(messageText || '').trim() || workingId === 'sn_message' || (profileUrls.length > 0 && credits.remainingCredits < profileUrls.length * SN_MESSAGE_COST_PER)) && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {workingId === 'sn_message' ? 'Queuing...' : 'Run now'}
                </button>
              </div>
            </>
          )}

          {/* ═══ Schedule Picker (shared) ═══ */}
          <SchedulePickerSection
            missionTitle={mission.title}
            mode={schedMode}
            onModeChange={setSchedMode}
            name={schedName}
            onNameChange={setSchedName}
            runAt={schedRunAt}
            onRunAtChange={setSchedRunAt}
            time={schedTime}
            onTimeChange={setSchedTime}
            weekday={schedWeekday}
            onWeekdayChange={setSchedWeekday}
            timezone={scheduleTimezone}
            saving={schedSaving}
            onSave={saveSchedule}
            disabled={!cloudEnabled}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LeadsSection                                                       */
/* ------------------------------------------------------------------ */

function LeadsSection({ profileUrls, onAddLeads, onClear }: {
  profileUrls: string[];
  onAddLeads: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Leads</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddLeads}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Add Leads
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!profileUrls.length}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        {profileUrls.length ? (
          <><span className="font-semibold">{profileUrls.length}</span> LinkedIn profile(s) selected.</>
        ) : (
          <span className="text-slate-400">No leads added yet.</span>
        )}
      </div>
      {profileUrls.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold text-slate-500">Preview</div>
          <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {profileUrls.slice(0, 5).map((u) => (
              <div key={u} className="break-all text-xs">{u}</div>
            ))}
            {profileUrls.length > 5 && (
              <div className="text-xs text-slate-400">+ {profileUrls.length - 5} more...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TemplatePicker                                                     */
/* ------------------------------------------------------------------ */

function TemplatePicker({ onSelect }: { onSelect: (body: string) => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const fetchTemplates = async () => {
    if (templates.length) { setOpen(true); return; }
    setLoading(true);
    setOpen(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('email_templates')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        setTemplates(data || []);
      }
    } catch {}
    setLoading(false);
  };

  const pick = (tpl: any) => {
    const body = stripHtml(tpl.content || '');
    onSelect(body);
    setOpen(false);
  };

  // Strip basic HTML for display
  const stripHtml = (html: string) =>
    html?.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || '';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={fetchTemplates}
        className="flex items-center gap-1 rounded-lg bg-indigo-600/10 px-2.5 py-1 text-xs font-semibold text-indigo-500 hover:bg-indigo-600/20 transition-colors"
      >
        <span>📝</span> Use Template
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[9999] mt-1 w-80 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-500">No templates found.</p>
              <a
                href="/messages"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-indigo-500 hover:text-indigo-400"
              >
                Create one in Messages →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {templates.map((tpl: any) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => pick(tpl)}
                  className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{tpl.name}</div>
                  {tpl.subject && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{tpl.subject}</div>
                  )}
                  <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
                    {stripHtml(tpl.content || '').slice(0, 90)}{stripHtml(tpl.content || '').length > 90 ? '…' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SchedulePickerSection                                              */
/* ------------------------------------------------------------------ */

function SchedulePickerSection({
  missionTitle, mode, onModeChange, name, onNameChange,
  runAt, onRunAtChange, time, onTimeChange,
  weekday, onWeekdayChange, timezone, saving, onSave, disabled,
}: {
  missionTitle: string;
  mode: string; onModeChange: (v: string) => void;
  name: string; onNameChange: (v: string) => void;
  runAt: string; onRunAtChange: (v: string) => void;
  time: string; onTimeChange: (v: string) => void;
  weekday: string; onWeekdayChange: (v: string) => void;
  timezone: string;
  saving: boolean;
  onSave: () => void;
  disabled: boolean;
}) {
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Schedule</div>
          <div className="mt-1 text-xs text-slate-500">Timezone: {timezone}</div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {mode === 'manual' ? 'Manual' : mode === 'run_at' ? 'One-time' : 'Recurring'}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Mode</label>
          <select value={mode} onChange={(e) => onModeChange(e.target.value)} disabled={disabled} className={cx(inputCls, 'mt-1')}>
            <option value="manual">Manual (no schedule)</option>
            <option value="run_at">Run at (one-time)</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        {mode === 'run_at' && (
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Run at</label>
            <input type="datetime-local" value={runAt} onChange={(e) => onRunAtChange(e.target.value)} disabled={disabled} className={cx(inputCls, 'mt-1')} />
          </div>
        )}

        {(mode === 'daily' || mode === 'weekly') && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mode === 'weekly' && (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Day</label>
                <select value={weekday} onChange={(e) => onWeekdayChange(e.target.value)} disabled={disabled} className={cx(inputCls, 'mt-1')}>
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Time</label>
              <input type="time" value={time} onChange={(e) => onTimeChange(e.target.value)} disabled={disabled} className={cx(inputCls, 'mt-1')} />
            </div>
          </div>
        )}

        {mode !== 'manual' && (
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Schedule name</label>
            <input value={name} onChange={(e) => onNameChange(e.target.value)} disabled={disabled} className={cx(inputCls, 'mt-1')} />
          </div>
        )}

        {mode !== 'manual' && (
          <button
            type="button"
            onClick={onSave}
            disabled={disabled || saving}
            className={cx(
              'w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500',
              (disabled || saving) && 'opacity-70 cursor-not-allowed',
            )}
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SchedulePromptModal                                                */
/* ------------------------------------------------------------------ */

function SchedulePromptModal({ open, title, limit, dailyCap, saving, onClose, onSchedule, onRunOnce }: {
  open: boolean; title: string; limit: number; dailyCap: number;
  saving: boolean; onClose: () => void; onSchedule: () => void; onRunOnce: () => void;
}) {
  if (!open) return null;
  const safeLimit = Math.max(1, Number(limit || 0));
  const safeDaily = Math.max(1, Number(dailyCap || 0));
  const days = Math.max(1, Math.ceil(safeLimit / safeDaily));

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Schedule recommended</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{title || 'Large run detected.'}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            Close
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            You selected <span className="font-semibold">{safeLimit}</span> profiles. Your daily cap is{' '}
            <span className="font-semibold">{safeDaily}</span>. To keep pulls safe, schedule this to run daily.
          </div>
          <div className="text-xs text-slate-500">
            Estimated: about {days} day{days === 1 ? '' : 's'} at {safeDaily} profiles/day.
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button
            type="button" onClick={onRunOnce} disabled={saving}
            className={cx('rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200', saving && 'opacity-70 cursor-not-allowed')}
          >
            Run once anyway
          </button>
          <button
            type="button" onClick={onSchedule} disabled={saving}
            className={cx('rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500', saving && 'opacity-70 cursor-not-allowed')}
          >
            {saving ? 'Scheduling...' : 'Schedule daily'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AddLeadsModal                                                      */
/* ------------------------------------------------------------------ */

function AddLeadsModal({ open, onClose, onConfirm }: {
  open: boolean; onClose: () => void; onConfirm: (urls: string[]) => void;
}) {
  const [source, setSource] = useState<'campaigns' | 'sourcing' | 'table' | 'paste'>('campaigns');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');

  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>>>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);

  const [sourcingCampaigns, setSourcingCampaigns] = useState<Array<Record<string, unknown>>>([]);
  const [selectedSourcingIds, setSelectedSourcingIds] = useState<string[]>([]);

  const [tables, setTables] = useState<Array<Record<string, unknown>>>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [tableColumnKey, setTableColumnKey] = useState('linkedin_url');

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setPreviewUrls([]);
    setSelectedCampaignIds([]);
    setSelectedSourcingIds([]);
    setPasteText('');
  }, [open]);

  const loadCampaigns = async () => {
    setLoading(true); setError('');
    try {
      const resp = await apiGet('/api/getCampaigns');
      setCampaigns(Array.isArray((resp as Record<string, unknown>)?.campaigns) ? (resp as Record<string, unknown>).campaigns as Array<Record<string, unknown>> : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Failed to load campaigns');
      setCampaigns([]);
    } finally { setLoading(false); }
  };

  const loadSourcingCampaigns = async () => {
    setLoading(true); setError('');
    try {
      const resp = await apiGet('/api/sourcing/campaigns');
      setSourcingCampaigns(Array.isArray(resp) ? resp as Array<Record<string, unknown>> : (Array.isArray((resp as Record<string, unknown>)?.campaigns) ? (resp as Record<string, unknown>).campaigns as Array<Record<string, unknown>> : []));
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Failed to load sourcing campaigns');
      setSourcingCampaigns([]);
    } finally { setLoading(false); }
  };

  const loadTables = async () => {
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('unauthenticated');
      const { data: rows, error: supaErr } = await supabase
        .from('custom_tables')
        .select('id,name,updated_at,schema_json,data_json')
        .order('updated_at', { ascending: false });
      if (supaErr) throw new Error(supaErr.message);
      setTables(Array.isArray(rows) ? rows : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Failed to load tables');
      setTables([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    if (source === 'campaigns') void loadCampaigns();
    if (source === 'sourcing') void loadSourcingCampaigns();
    if (source === 'table') void loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  const toggleId = (arr: string[], id: string) => {
    const key = String(id);
    return arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key];
  };

  const preview = async () => {
    setLoading(true); setError(''); setPreviewUrls([]);
    try {
      if (source === 'campaigns') {
        if (!selectedCampaignIds.length) throw new Error('Select at least one campaign.');
        const all: unknown[] = [];
        for (const id of selectedCampaignIds) {
          const resp = await apiGet(`/api/getLeads?campaignId=${encodeURIComponent(id)}`);
          all.push(...(Array.isArray(resp) ? resp : []));
        }
        setPreviewUrls(extractLinkedinUrls(all));
        return;
      }
      if (source === 'sourcing') {
        if (!selectedSourcingIds.length) throw new Error('Select at least one sourcing campaign.');
        const all: unknown[] = [];
        for (const id of selectedSourcingIds) {
          const resp = await apiGet(`/api/sourcing/campaigns/${encodeURIComponent(id)}/leads?limit=2000&offset=0`);
          const leads = Array.isArray((resp as Record<string, unknown>)?.leads) ? (resp as Record<string, unknown>).leads as unknown[] : [];
          all.push(...leads);
        }
        setPreviewUrls(extractLinkedinUrls(all));
        return;
      }
      if (source === 'table') {
        const t = tables.find((x) => String(x.id) === String(selectedTableId));
        if (!t) throw new Error('Select a table.');
        const rows = Array.isArray(t.data_json) ? t.data_json as unknown[] : [];
        setPreviewUrls(extractLinkedinUrls(rows, tableColumnKey));
        return;
      }
      if (source === 'paste') {
        const lines = pasteText
          .split(/[\n,]+/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        if (!lines.length) throw new Error('Paste at least one LinkedIn profile URL.');
        const valid = lines
          .map((l) => normalizeLinkedinUrl(l))
          .filter((u): u is string => u !== null);
        if (!valid.length) throw new Error('No valid LinkedIn profile URLs found. Make sure each line is a full LinkedIn URL (e.g. https://www.linkedin.com/in/...)');
        setPreviewUrls(Array.from(new Set(valid)));
        return;
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Failed to preview leads');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
  const tabCls = (active: boolean) => cx(
    'rounded-xl border px-3 py-2 text-sm font-semibold',
    active
      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-200'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  );

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Leads</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Import LinkedIn profile URLs from Campaigns, Sourcing Campaigns, a Table, or paste them directly.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { id: 'campaigns' as const, label: 'Campaigns' },
              { id: 'sourcing' as const, label: 'Sourcing Campaigns' },
              { id: 'table' as const, label: 'Custom Table' },
              { id: 'paste' as const, label: 'Paste URLs' },
            ]).map((t) => (
              <button key={t.id} type="button" onClick={() => setSource(t.id)} className={tabCls(t.id === source)}>
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/20 dark:text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            {source === 'campaigns' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select campaign(s)</div>
                  <button type="button" onClick={loadCampaigns} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    Refresh
                  </button>
                </div>
                <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  {!campaigns.length ? (
                    <div className="px-4 py-4 text-sm text-slate-400">No campaigns found.</div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {campaigns.map((c) => {
                        const id = String(c.id);
                        return (
                          <label key={id} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                            <input type="checkbox" checked={selectedCampaignIds.includes(id)} onChange={() => setSelectedCampaignIds((prev) => toggleId(prev, id))} />
                            <span className="flex-1">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{String(c.name || c.title || 'Campaign')}</span>
                              <span className="ml-2 text-xs text-slate-500">({Number(c.total_leads || 0)} leads)</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {source === 'sourcing' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select sourcing campaign(s)</div>
                  <button type="button" onClick={loadSourcingCampaigns} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    Refresh
                  </button>
                </div>
                <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  {!sourcingCampaigns.length ? (
                    <div className="px-4 py-4 text-sm text-slate-400">No sourcing campaigns found.</div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {sourcingCampaigns.map((c) => {
                        const id = String(c.id);
                        return (
                          <label key={id} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                            <input type="checkbox" checked={selectedSourcingIds.includes(id)} onChange={() => setSelectedSourcingIds((prev) => toggleId(prev, id))} />
                            <span className="flex-1">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{String(c.title || c.name || 'Sourcing Campaign')}</span>
                              {c.status ? <span className="ml-2 text-xs text-slate-500">({String(c.status)})</span> : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {source === 'table' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select a table</div>
                  <button type="button" onClick={loadTables} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    Refresh
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Table</label>
                    <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)} className={cx(inputCls, 'mt-1')}>
                      <option value="">Select...</option>
                      {tables.map((t) => (
                        <option key={String(t.id)} value={String(t.id)}>{String(t.name || 'Untitled Table')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">LinkedIn URL column</label>
                    <input value={tableColumnKey} onChange={(e) => setTableColumnKey(e.target.value)} placeholder="linkedin_url" className={cx(inputCls, 'mt-1')} />
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Tip: We also auto-detect common fields like <span className="font-mono">linkedin_url</span>, <span className="font-mono">profile_url</span>, or <span className="font-mono">url</span>.
                </div>
              </>
            )}

            {source === 'paste' && (
              <>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">LinkedIn Profile URLs</div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={8}
                  placeholder={'https://www.linkedin.com/in/johndoe/\nhttps://www.linkedin.com/in/janesmith/\nhttps://www.linkedin.com/in/alexjones/'}
                  className={cx(inputCls, 'mt-2 font-mono text-xs')}
                />
                <div className="mt-2 text-xs text-slate-500">
                  Paste LinkedIn profile URLs, one per line. Duplicates will be removed automatically.
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-500">
              {previewUrls.length ? (
                <>Found <span className="font-semibold text-slate-900 dark:text-slate-100">{previewUrls.length}</span> LinkedIn profile URL(s).</>
              ) : 'Preview to calculate how many LinkedIn URLs will be added.'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button" onClick={preview} disabled={loading}
                className={cx('rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200', loading && 'opacity-70 cursor-not-allowed')}
              >
                {loading ? 'Loading...' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => onConfirm(previewUrls)}
                disabled={!previewUrls.length || loading}
                className={cx('rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500', (!previewUrls.length || loading) && 'opacity-70 cursor-not-allowed')}
              >
                Add {previewUrls.length ? `(${previewUrls.length})` : ''} leads
              </button>
            </div>
          </div>

          {previewUrls.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold text-slate-500">Preview</div>
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {previewUrls.slice(0, 5).map((u) => (
                  <div key={u} className="break-all text-xs">{u}</div>
                ))}
                {previewUrls.length > 5 && (
                  <div className="text-xs text-slate-400">+ {previewUrls.length - 5} more...</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
