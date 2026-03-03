import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabaseClient';
import MissionsPanel from './MissionsPanel';
import ActivityPanel from './ActivityPanel';
import SettingsPanel from './SettingsPanel';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SniperTab = 'missions' | 'activity' | 'settings';

const VALID_TABS: SniperTab[] = ['missions', 'activity', 'settings'];

function normalizeTab(raw: string | null): SniperTab {
  const v = (raw || '').toLowerCase() as SniperTab;
  return VALID_TABS.includes(v) ? v : 'missions';
}

type ConnectionStatus = {
  connected: boolean;
  profileId?: string;
  lastAuthAt?: string;
};

/* ------------------------------------------------------------------ */
/*  Tab button styling (mirrors AgentModeCenter)                       */
/* ------------------------------------------------------------------ */

const tabButtonClass = (isActive: boolean) => {
  const base =
    'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:ring-slate-800 dark:hover:bg-slate-800 transition';
  if (isActive) return `${base} bg-indigo-600 text-white dark:bg-indigo-500 ring-indigo-600 dark:ring-indigo-500`;
  return `${base} bg-white dark:bg-slate-900`;
};

const TAB_META: { id: SniperTab; emoji: string; label: string; emojiBg: string }[] = [
  { id: 'missions', emoji: '🚀', label: 'Missions', emojiBg: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  { id: 'activity', emoji: '📊', label: 'Activity', emojiBg: 'bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  { id: 'settings', emoji: '⚙️', label: 'Settings', emojiBg: 'bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300' },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function SniperHub() {
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(() => normalizeTab(searchParams.get('tab')), [searchParams]);
  const setActiveTab = (next: SniperTab) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp);
  };

  /* ---- Connection & engine status ---- */
  const [conn, setConn] = useState<ConnectionStatus>({ connected: false });
  const [engineEnabled, setEngineEnabled] = useState<boolean | null>(null);

  const API_BASE = (import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}` : '').replace(/\/$/, '');
  const API_ROOT = API_BASE ? `${API_BASE}/api` : '/api';

  const fetchStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // Fetch LinkedIn auth status
      const res = await fetch(`${API_ROOT}/sniper/linkedin/auth/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConn({
          connected: data.connected === true,
          profileId: data.profile_id,
          lastAuthAt: data.last_auth_at,
        });
      }

      // Fetch engine settings
      const settingsRes = await fetch(`${API_ROOT}/sniper/settings`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setEngineEnabled(Boolean(s?.cloud_engine_enabled));
      }
    } catch {}
  };

  useEffect(() => { fetchStatus(); }, []);

  /* ---- Render ---- */
  return (
    <div className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="min-h-screen">
        {/* ═══ Header ═══ */}
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              {/* Left: Back + Icon + Title */}
              <div className="flex items-center gap-3">
                <Link
                  to="/agent"
                  className="hidden sm:inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  title="Back to Agent Center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                    <line x1="12" y1="2" x2="12" y2="6" strokeWidth="2" />
                    <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2" />
                    <line x1="2" y1="12" x2="6" y2="12" strokeWidth="2" />
                    <line x1="18" y1="12" x2="22" y2="12" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">Cloud Engine</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Automate LinkedIn sourcing, outreach, and engagement.
                  </p>
                </div>
              </div>

              {/* Right: Theme toggle */}
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  type="button"
                  onClick={toggleTheme}
                >
                  <span aria-hidden="true">{theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}</span>
                  <span className="hidden sm:inline">Theme</span>
                </button>

                {/* Connect LinkedIn shortcut */}
                <StatusPill connected={conn.connected} onClick={() => setActiveTab('settings')} />
              </div>
            </div>

            {/* ═══ Tab Navigation ═══ */}
            <nav className="pb-4">
              <div className="flex flex-wrap gap-2">
                {TAB_META.map((t) => (
                  <button
                    key={t.id}
                    className={tabButtonClass(activeTab === t.id)}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${t.emojiBg}`}>
                      {t.emoji}
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </header>

        {/* ═══ Status Strip ═══ */}
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            {/* Engine status */}
            <div className={cx(
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
              engineEnabled === true
                ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                : engineEnabled === false
                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
            )}>
              <span className={cx(
                'h-2 w-2 rounded-full',
                engineEnabled === true ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600',
              )} />
              {engineEnabled === true ? 'Engine Online' : engineEnabled === false ? 'Engine Off' : 'Loading...'}
            </div>

            {/* LinkedIn status */}
            <div className={cx(
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
              conn.connected
                ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                : 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
            )}>
              <span className={cx('h-2 w-2 rounded-full', conn.connected ? 'bg-emerald-500' : 'bg-amber-500')} />
              {conn.connected ? 'LinkedIn Connected' : 'LinkedIn Not Connected'}
            </div>

            {/* Profile ID */}
            {conn.profileId && (
              <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {String(conn.profileId).length > 25 ? `${String(conn.profileId).slice(0, 25)}...` : conn.profileId}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Main Content ═══ */}
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          {activeTab === 'missions' && <MissionsPanel conn={conn} onNavigate={setActiveTab} />}
          {activeTab === 'activity' && <ActivityPanel />}
          {activeTab === 'settings' && <SettingsPanel conn={conn} onStatusChange={fetchStatus} />}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Pill (header)                                               */
/* ------------------------------------------------------------------ */

function StatusPill({ connected, onClick }: { connected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        connected
          ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200'
          : 'bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {connected ? 'LinkedIn Connected' : 'Connect LinkedIn'}
    </button>
  );
}
