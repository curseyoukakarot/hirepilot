import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlan } from '../../context/PlanContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import CampaignsPanel from './CampaignsPanel';
import SniperTargetsPanel from './SniperTargetsPanel';
import ActionInboxPanel from './ActionInboxPanel';
import SalesAgentSettingsCard from './SalesAgentSettingsCard';
import PersonasPanel from './PersonasPanel';
import SchedulesPanel from './SchedulesPanel';
import CreateScheduleModal from './CreateScheduleModal';
import REXConsole from './REXConsole';

function LegacyAgentModeAdvanced() {
  const navigate = useNavigate();
  const location = useLocation();

  const deriveTabFromLocation = (): 'console' | 'personas' | 'schedules' | 'campaigns' | 'inbox' => {
    const path = location.pathname || '';
    const search = new URLSearchParams(location.search || '');
    const qTab = (search.get('tab') || '').toLowerCase();
    if (qTab === 'campaigns') return 'campaigns';
    if (qTab === 'inbox') return 'inbox';
    if (qTab === 'personas') return 'personas';
    if (qTab === 'schedules') return 'schedules';
    if (path.startsWith('/agent/advanced/campaigns')) return 'campaigns';
    if (path.startsWith('/agent/advanced/inbox')) return 'inbox';
    if (path.startsWith('/agent/advanced/personas')) return 'personas';
    if (path.startsWith('/agent/advanced/schedules')) return 'schedules';
    return 'console';
  };

  const [tab, setTab] = useState<'console' | 'personas' | 'schedules' | 'campaigns' | 'inbox'>(() =>
    deriveTabFromLocation()
  );
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [modalPersonaId, setModalPersonaId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setTab(deriveTabFromLocation());
  }, [location.pathname, location.search]);

  const tabStyle = (active: boolean) =>
    `px-4 py-2 rounded-full font-medium transition-colors text-sm ${
      active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;

  return (
    <div
      className="p-6 w-full min-h-screen bg-gray-900 overflow-x-auto overscroll-x-contain"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-white">Agent Mode Center</h1>
          <p className="text-gray-400">Your recruiting assistant’s mission control.</p>
        </div>
        {/* Top-right Chat with REX button (hidden if campaigns exist via CampaignsPanel empty state handles link) */}
        <a
          href="/rex-chat"
          className="hidden md:inline-flex items-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          🤖 Chat with REX
        </a>
      </div>
      <div className="h-2" />

      <div className="flex space-x-3 mb-6">
        <button onClick={() => navigate('/agent/advanced/console')} className={tabStyle(tab === 'console')}>
          💬 REX Console
        </button>
        <button onClick={() => navigate('/agent/advanced/campaigns')} className={tabStyle(tab === 'campaigns')}>
          📦 Campaigns
        </button>
        <button onClick={() => navigate('/agent/advanced/inbox')} className={tabStyle(tab === 'inbox')}>
          📨 Action Inbox
        </button>
        <button onClick={() => navigate('/agent/advanced/personas')} className={tabStyle(tab === 'personas')}>
          🧠 Personas
        </button>
        <button onClick={() => navigate('/agent/advanced/schedules')} className={tabStyle(tab === 'schedules')}>
          ⏱️ Schedules
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-[900px]">
        <div className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4 overflow-x-visible">
          {tab === 'console' && <REXConsole />}
          {tab === 'campaigns' && <CampaignsPanel />}
          {tab === 'inbox' && <ActionInboxPanel />}
          {tab === 'personas' && (
            <PersonasPanel
              onUseInScheduler={(persona) => {
                setModalPersonaId(persona.id);
                setShowCreateSchedule(true);
              }}
              onCreatePersona={() => {
                // Placeholder: In V1 we can reuse the schedule modal to collect persona basics later
                alert('Create Persona (UI only placeholder)');
              }}
            />
          )}
          {tab === 'schedules' && (
            <SchedulesPanel
              onCreate={() => {
                setModalPersonaId(undefined);
                setShowCreateSchedule(true);
              }}
              onEdit={() => {
                /* placeholder */
              }}
              onPause={() => {
                /* placeholder */
              }}
              onDelete={() => {
                /* placeholder */
              }}
            />
          )}
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <SalesAgentSettingsCard />
        </div>
      </div>

      {/* Nested drawers mount here */}
      <Outlet />
      {showCreateSchedule && (
        <CreateScheduleModal
          open={showCreateSchedule}
          onClose={() => setShowCreateSchedule(false)}
          defaultPersonaId={modalPersonaId}
        />
      )}
    </div>
  );
}

type AgentTuningTab = 'sourcing' | 'sales' | 'rex';

function normalizeAgentTuningTab(s: string | null | undefined): AgentTuningTab {
  const v = String(s || '').toLowerCase();
  if (v === 'sales') return 'sales';
  if (v === 'rex') return 'rex';
  return 'sourcing';
}

export default function AgentModeCenter() {
  const { isFree, role } = usePlan() as any;
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agentModeEnabled, setAgentModeEnabled] = useState<boolean | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [leadsSourced, setLeadsSourced] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [showSalesSettings, setShowSalesSettings] = useState(false);

  // Never block super admins regardless of plan
  const normalizedRole = String(role || '').toLowerCase().replace(/\s|-/g, '_');
  const isSuperAdmin = ['super_admin', 'superadmin'].includes(normalizedRole);

  if (isFree && !isSuperAdmin) {
    return (
      <div className="p-6 w-full min-h-screen bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mt-8">
            <h2 className="text-xl font-bold text-yellow-800 mb-2">Agent Mode is a paid plan feature</h2>
            <p className="text-yellow-700 mb-4">Upgrade to unlock autonomous sourcing and campaigns.</p>
            <a
              href="/pricing"
              className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              See Plans
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Preserve legacy advanced routes for now (these routes already exist in the app).
  if (location.pathname.startsWith('/agent/advanced')) {
    return <LegacyAgentModeAdvanced />;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Workspace / company name (same source as Settings -> Profile Info)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const fromMeta = String(user?.user_metadata?.company || '').trim();
        if (fromMeta) {
          if (!cancelled) setCompanyName(fromMeta);
        } else if (user?.id) {
          try {
            const { data: row } = await supabase
              .from('users')
              .select('company')
              .eq('id', user.id)
              .maybeSingle();
            const fromDb = String((row as any)?.company || '').trim();
            if (!cancelled) setCompanyName(fromDb || null);
          } catch {
            if (!cancelled) setCompanyName(null);
          }
        } else {
          if (!cancelled) setCompanyName(null);
        }
      } catch {
        if (!cancelled) setCompanyName(null);
      }

      // Agent Mode status (same source as Settings -> Integrations Hub and CampaignsPanel)
      try {
        const data = await api('/api/agent-mode');
        if (!cancelled) setAgentModeEnabled(!!(data as any)?.agent_mode_enabled);
      } catch {
        if (!cancelled) setAgentModeEnabled(null);
      }

      // Credits remaining (same source as /billing)
      try {
        // Prefer backend canonical status (handles fallbacks server-side)
        const credit = await api('/api/credits/status');
        const remaining = Number((credit as any)?.remaining_credits);
        if (!cancelled) setCreditsRemaining(Number.isFinite(remaining) ? remaining : null);
      } catch {
        // Fallback to direct Supabase table read if backend fails
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('No user');
          const { data: row } = await supabase
            .from('user_credits')
            .select('remaining_credits')
            .eq('user_id', user.id)
            .maybeSingle();
          const remaining = Number((row as any)?.remaining_credits);
          if (!cancelled) setCreditsRemaining(Number.isFinite(remaining) ? remaining : null);
        } catch {
          if (!cancelled) setCreditsRemaining(null);
        }
      }

      // Leads sourced (sum of "new leads found" across sourcing campaigns)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;
        const resp = await api(`/api/sourcing/campaigns${userId ? `?created_by=${userId}` : ''}`);
        const list: any[] = Array.isArray(resp)
          ? resp
          : Array.isArray((resp as any)?.campaigns)
            ? (resp as any).campaigns
            : [];

        const statsResults = await Promise.all(
          list.map(async (c: any) => {
            try {
              const s = await api(`/api/sourcing/campaigns/${c.id}/stats`);
              return Number((s as any)?.total_leads || 0);
            } catch {
              return 0;
            }
          })
        );
        const total = statsResults.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
        if (!cancelled) setLeadsSourced(total);
      } catch {
        if (!cancelled) setLeadsSourced(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showSalesSettings) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSalesSettings(false);
    };
    window.addEventListener('keydown', onKeyDown);
    // Prevent background scroll while modal is open
    const prevOverflow = document?.body?.style?.overflow;
    try {
      document.body.style.overflow = 'hidden';
    } catch {}
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      try {
        document.body.style.overflow = prevOverflow || '';
      } catch {}
    };
  }, [showSalesSettings]);

  const activeTab: AgentTuningTab = useMemo(() => normalizeAgentTuningTab(searchParams.get('s')), [searchParams]);
  const setActiveTab = (next: AgentTuningTab) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('s', next);
    setSearchParams(sp);
  };

  const tabButtonClass = (isActive: boolean) => {
    const base =
      'agentTab inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:ring-slate-800 dark:hover:bg-slate-800';
    if (isActive) return `${base} bg-indigo-600 text-white dark:bg-indigo-500`;
    return `${base} bg-white dark:bg-slate-900`;
  };

  return (
    <div className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* Top App Shell */}
      <div className="min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-soft">
                  {/* simple spark icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 3l1.8 6.3L20 12l-6.2 1.7L12 21l-1.8-7.3L4 12l6.2-2.7L12 3z"
                    />
                  </svg>
                </div>

                <div>
                  <h1 className="text-lg font-semibold leading-tight">Agent Mode Center</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Tune your agents. Control what runs, when it runs, and what happens next.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Dark mode toggle */}
                <button
                  id="themeToggle"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  type="button"
                  onClick={toggleTheme}
                >
                  <span id="themeIcon" aria-hidden="true">
                    {theme === 'dark' ? '☀️' : '🌙'}
                  </span>
                  <span className="hidden sm:inline">Theme</span>
                </button>

                {/* Primary CTA */}
                <a
                  href="/rex-chat"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-900"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white/15">🤖</span>
                  Chat with REX
                </a>
              </div>
            </div>

            {/* Agent Tabs */}
            <nav className="pb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  data-tab="tab-sourcing"
                  className={tabButtonClass(activeTab === 'sourcing')}
                  type="button"
                  onClick={() => setActiveTab('sourcing')}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                    🔎
                  </span>
                  Sourcing Agent
                </button>
                <button
                  data-tab="tab-sales"
                  className={tabButtonClass(activeTab === 'sales')}
                  type="button"
                  onClick={() => setActiveTab('sales')}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    💬
                  </span>
                  Sales Agent
                </button>
                <button
                  data-tab="tab-rex"
                  className={tabButtonClass(activeTab === 'rex')}
                  type="button"
                  onClick={() => setActiveTab('rex')}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-fuchsia-600/10 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300">
                    🧠
                  </span>
                  REX Console
                </button>
              </div>
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          {/* Shared top status strip */}
          <section className="mb-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-grid border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-2.5 w-2.5 rounded-full ${
                          agentModeEnabled ? 'bg-emerald-500' : agentModeEnabled === false ? 'bg-slate-400' : 'bg-slate-400'
                        }`}
                      ></span>
                      <span className="text-sm font-semibold">
                        {agentModeEnabled ? 'Agent System Online' : agentModeEnabled === false ? 'Agent Mode Off' : 'Agent System Online'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {agentModeEnabled
                        ? 'Your agents are ready. Configure controls below, then run or schedule.'
                        : agentModeEnabled === false
                          ? 'Agent Mode is currently disabled. Enable it in Settings to run or schedule.'
                          : 'Your agents are ready. Configure controls below, then run or schedule.'}
                    </p>
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {companyName ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Workspace: <span className="font-bold">{companyName}</span>
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                        Active persona: <span className="font-bold">None selected</span>
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                        Scheduler: <span className="font-bold">2 jobs running</span>
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Credits remaining</p>
                        <p className="mt-1 text-lg font-bold">{creditsRemaining == null ? '—' : creditsRemaining.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Today: leads sourced</p>
                        <p className="mt-1 text-lg font-bold">{leadsSourced == null ? '—' : leadsSourced.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Today: replies handled</p>
                        <p className="mt-1 text-lg font-bold">3</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <a
                    href="/agent/advanced/schedules"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
                  >
                    ⏱ Manage schedules
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Tabs Panels */}
          {/* SOURCING TAB */}
          <section id="tab-sourcing" className={`tabPanel fade-in ${activeTab === 'sourcing' ? '' : 'hidden'}`}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left: Control Tiles */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">Sourcing Agent</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Define your target (Personas), decide when to run (Schedules), and control automation + risk
                        (Sniper).
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                      Mode: <span className="font-bold">Sourcing</span>
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Personas Tile */}
                    <a
                      href="/agent/advanced/personas"
                      className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                          👥
                        </div>
                        <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
                          Open →
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold">Personas</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Build targeting profiles and filters that your agent can run repeatedly.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Saved profiles
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Reusable filters
                        </span>
                      </div>
                    </a>

                    {/* Schedules Tile */}
                    <a
                      href="/agent/advanced/schedules"
                      className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900">
                          ⏱
                        </div>
                        <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
                          Open →
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold">Schedules</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Automate sourcing runs and campaign starts on a predictable cadence.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Recurring
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          One-time
                        </span>
                      </div>
                    </a>

                    {/* Sniper Tile */}
                    <a
                      href="/sniper"
                      className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                          🎯
                        </div>
                        <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
                          Open →
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold">Sniper</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Extract Leads and send messages on LinkedIn and Sales Navigator at scale
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Risk controls
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Throttling
                        </span>
                      </div>
                    </a>
                  </div>

                  {/* Tuning Controls */}
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold">Quality vs Quantity</h4>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tuning</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Guide how strict your agent should be about persona match.
                      </p>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        defaultValue={7}
                        className="mt-4 w-full accent-indigo-600"
                      />
                      <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>More leads</span>
                        <span>Higher match</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold">Daily sourcing limit</h4>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Safety</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Keep your agent predictable. Great for reputation + reliability.
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <input
                          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900"
                          defaultValue="25"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">leads/day</span>
                        <span className="ml-auto inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                          Recommended
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Next actions */}
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">Next step:</span>
                      Select a Persona, then run now or schedule.
                    </div>
                    <div className="flex gap-2">
                      <a href="/agent/advanced/personas" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                        Select Persona
                      </a>
                      <a
                        href="/agent/schedules/new"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
                      >
                        Create Schedule
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Agent brain + timeline */}
              <aside className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold">Agent state</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Sourcing agent</span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Enabled
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Active persona</span>
                      <span className="font-semibold">None</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Output</span>
                      <span className="font-semibold">Leads + Campaigns</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Safety pacing</span>
                      <span className="font-semibold">Standard</span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                    <p className="font-semibold">What your agent will do</p>
                    <ol className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
                      <li className="flex gap-2">
                        <span className="font-bold text-indigo-600">1.</span> Run persona filters
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-indigo-600">2.</span> Source leads into Campaigns + Leads
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-indigo-600">3.</span> (Optional) Kick off outreach sequence
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold">Upcoming automation</h3>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                      <p className="text-sm font-semibold">Source — VC Persona 2</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Next run: Today • 4:00 PM</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                      <p className="text-sm font-semibold">Source — Enterprise AE</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Next run: Tomorrow • 9:00 AM</p>
                    </div>
                  </div>
                  <a
                    href="/agent/advanced/schedules"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
                  >
                    Manage schedules
                  </a>
                </div>
              </aside>
            </div>
          </section>

          {/* SALES TAB */}
          <section id="tab-sales" className={`tabPanel fade-in ${activeTab === 'sales' ? '' : 'hidden'}`}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">Sales Agent</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Handle replies, share links, route to Calendly, and keep outreach moving. Campaigns live here.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                      Mode: <span className="font-bold">Sales</span>
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Sales Settings */}
                    <button
                      type="button"
                      onClick={() => setShowSalesSettings(true)}
                      className="group w-full text-left rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                          ⚙️
                        </div>
                        <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
                          Open →
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold">Sales Settings</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Configure auto-send mode, sender rotation, links, Calendly, and reply strategy.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Auto-send
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Calendly
                        </span>
                      </div>
                    </button>

                    {/* Campaigns */}
                    <a
                      href="/agent/advanced/campaigns"
                      className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                          📣
                        </div>
                        <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
                          Open →
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold">Campaigns</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        View sourcing campaigns, start sequences, and monitor replies + performance.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Sequences
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                          Replies
                        </span>
                      </div>
                    </a>
                  </div>

                  {/* Live preview (light/dark safe) */}
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">Reply strategy preview</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mode:</span>
                        <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
                          Share &amp; ask
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
                      Hey {'{{firstName}}'} — appreciate the reply!
                      <br />
                      <br />
                      Grab a time here: https://calendly.com/hirepilot/30min
                      <br />
                      <br />
                      — {'{{yourName}}'}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSalesSettings(true)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                      >
                        Tune Sales Agent
                      </button>
                      <a
                        href="/agent/advanced/campaigns"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
                      >
                        View Campaigns
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Sales agent state */}
              <aside className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold">Sales agent state</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Mode</span>
                      <span className="font-semibold">Share &amp; ask</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Send from</span>
                      <span className="font-semibold">Single sender</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Sender</span>
                      <span className="font-semibold">brandon@thehirepilot.com</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Quiet hours</span>
                      <span className="font-semibold">20:00–07:00</span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    <p className="font-semibold">Setup tip</p>
                    <p className="mt-1">Add a demo video URL + pricing page URL to improve conversions.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSalesSettings(true)}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Open Sales Settings
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-bold">What happens when a reply comes in?</h3>
                  <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <li className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                        1
                      </span>
                      Agent reads the reply context + campaign stage.
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                        2
                      </span>
                      Agent chooses: auto-send, share links, or ask a question.
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                        3
                      </span>
                      If qualified → pushes a Calendly link and tracks outcome.
                    </li>
                  </ol>
                </div>
              </aside>
            </div>
          </section>

          {/* REX TAB */}
          <section id="tab-rex" className={`tabPanel fade-in ${activeTab === 'rex' ? '' : 'hidden'}`}>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              <div className="h-[calc(100vh-280px)] min-h-[640px]">
                <REXConsole embedded />
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          © HirePilot — Agent Mode Center
        </footer>
      </div>

      {/* Nested drawers mount here */}
      <Outlet />
      {showSalesSettings && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowSalesSettings(false)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Sales Agent Settings"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Sales Agent Settings</div>
                <div className="text-xs text-slate-600 dark:text-slate-300">Control replies, links, scheduling, and limits.</div>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setShowSalesSettings(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[calc(90vh-72px)] overflow-y-auto bg-gray-900 p-6">
              <SalesAgentSettingsCard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


