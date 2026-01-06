import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { usePlan } from '../../context/PlanContext';
import toast from 'react-hot-toast';

type LandingTheme = {
  id: string;
  name: string;
  slug: string;
  tags: string[];
  preview_image_url: string | null;
  theme_config: any;
  theme_html: string;
};

function normalizeRolePlan(v: any) {
  return String(v || '').toLowerCase().replace(/\s|-/g, '_');
}
function isEliteFromRolePlan(role?: any, plan?: any, accountType?: any) {
  const r = normalizeRolePlan(role);
  const p = normalizeRolePlan(plan);
  const a = normalizeRolePlan(accountType);
  if (['super_admin', 'admin', 'team_admin', 'team_admins'].includes(r)) return true;
  return r === 'job_seeker_elite' || p === 'job_seeker_elite' || a === 'job_seeker_elite';
}

function getBackendBase() {
  const env = String((import.meta as any)?.env?.VITE_BACKEND_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  try {
    const host = typeof window !== 'undefined' ? window.location.host : '';
    if (host.endsWith('thehirepilot.com')) return 'https://api.thehirepilot.com';
  } catch {}
  return 'http://localhost:8080';
}

const MOCK_THEMES: LandingTheme[] = [
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d003', name: 'Executive Serif', slug: 'executive_serif', tags: ['executive', 'modern'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d010', name: 'Bold Dark Neon', slug: 'bold_dark_neon', tags: ['dark', 'modern', 'sales'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d007', name: 'Creative Portfolio', slug: 'creative_portfolio', tags: ['portfolio', 'modern'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d001', name: 'Minimal Clean', slug: 'minimal_clean', tags: ['clean', 'executive', 'minimal'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d002', name: 'Modern Gradient Hero', slug: 'modern_gradient_hero', tags: ['modern', 'hero', 'gradient'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d004', name: 'Sales Leader Metrics', slug: 'sales_leader_metrics', tags: ['sales', 'metrics', 'modern'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d005', name: 'Product PM Case Study', slug: 'product_pm_case_study', tags: ['product', 'pm', 'case_study'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d006', name: 'Engineer Builder', slug: 'engineer_builder', tags: ['engineer', 'builder', 'minimal'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d008', name: 'Healthcare Trust', slug: 'healthcare_trust', tags: ['healthcare', 'trust', 'clean'], preview_image_url: null, theme_config: {}, theme_html: '' },
  { id: 'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d009', name: 'Startup Operator', slug: 'startup_operator', tags: ['startup', 'operator', 'modern'], preview_image_url: null, theme_config: {}, theme_html: '' },
];

const pageCss = `
  .fade-in { animation: fadeIn 420ms ease-out both; }
  .slide-up { animation: slideUp 520ms cubic-bezier(.2,.8,.2,1) both; }
  .shimmer {
    background: linear-gradient(110deg, rgba(255,255,255,.06) 8%, rgba(255,255,255,.14) 18%, rgba(255,255,255,.06) 33%);
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes slideUp { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform: translateY(0) } }
  @keyframes shimmer { to { background-position-x: -200% } }
  .glass {
    background: radial-gradient(1100px 520px at 20% 0%, rgba(99,102,241,.18), transparent 52%),
                radial-gradient(900px 520px at 90% 10%, rgba(16,185,129,.16), transparent 46%),
                rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(14px);
  }
  .ring-glow { box-shadow: 0 0 0 1px rgba(148,163,184,.22), 0 0 40px rgba(99,102,241,.12); }
  .soft-border { border: 1px solid rgba(148,163,184,.16); }
  .card-hover { transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease; }
  .card-hover:hover { transform: translateY(-4px); border-color: rgba(148,163,184,.28); box-shadow: 0 18px 55px rgba(0,0,0,.35); }
  .btn { transition: transform 160ms ease, opacity 160ms ease, background 160ms ease; }
  .btn:active { transform: scale(.98); }
  .pill { border: 1px solid rgba(148,163,184,.18); }
`;

function buildThemePreviewHtml(theme: LandingTheme) {
  const wrapper = theme.theme_html || '';
  const content = `
    <div style="max-width:980px;margin:0 auto;">
      <div style="border:1px solid rgba(255,255,255,.10);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;">
        <div style="font-size:12px;opacity:.7;margin-bottom:10px;">HirePilot Jobs • Landing Page</div>
        <div style="font-size:24px;font-weight:800;letter-spacing:-.02em;margin-bottom:6px;">Eric Lopez</div>
        <div style="opacity:.7;margin-bottom:12px;">Revenue leader • B2B SaaS • Head of Sales</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);">Book a call</div>
          <div style="padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);">Email me</div>
        </div>
        <div style="display:grid;gap:10px;">
          <div style="height:10px;width:90%;border-radius:8px;background:rgba(255,255,255,.10)"></div>
          <div style="height:10px;width:70%;border-radius:8px;background:rgba(255,255,255,.08)"></div>
          <div style="height:10px;width:82%;border-radius:8px;background:rgba(255,255,255,.08)"></div>
        </div>
      </div>
    </div>
  `;
  const body = wrapper
    ? (wrapper.includes('{{content}}') ? wrapper.replace('{{content}}', content) : `${wrapper}${content}`)
    : `<div style="min-height:100vh;background:#070A0F;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:24px 16px;">${content}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0">${body}</body></html>`;
}

export default function LandingThemesPage() {
  const navigate = useNavigate();
  const { role } = usePlan();
  const roleLc = String(role || '').toLowerCase().replace(/\s|-/g, '_');
  const isEliteFromClient = roleLc === 'job_seeker_elite' || ['super_admin', 'admin', 'team_admin', 'team_admins'].includes(roleLc);
  const backend = getBackendBase();
  const isJobsHost = (() => {
    try {
      return window.location.hostname.startsWith('jobs.');
    } catch {
      return false;
    }
  })();
  const backTo = isJobsHost ? '/prep' : '/dashboard';
  const publicUrlExample = (() => {
    try {
      const host = window.location.host || '';
      if (host.endsWith('thehirepilot.com')) return 'app.thehirepilot.com/p/yourname';
      return `${host}/p/yourname`;
    } catch {
      return 'app.thehirepilot.com/p/yourname';
    }
  })();

  const [themes, setThemes] = useState<LandingTheme[]>(MOCK_THEMES);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>('b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d001');
  const [serverElite, setServerElite] = useState<boolean | null>(null);
  const isElite = (serverElite ?? isEliteFromClient) === true;
  const [loading, setLoading] = useState(false);
  const [eliteLoading, setEliteLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTheme, setModalTheme] = useState<LandingTheme | null>(null);
  const [tab, setTab] = useState<'desktop' | 'mobile'>('desktop');
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setEliteLoading(true);
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const [resp, meResp] = await Promise.all([
          fetch(`${backend}/api/landing-themes`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
          fetch(`${backend}/api/user/me`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
        ]);

        const [json, me] = await Promise.all([
          resp.json().catch(() => ({})),
          meResp.json().catch(() => ({})),
        ]);

        if (!cancelled) {
          const meElite = meResp.ok ? isEliteFromRolePlan(me?.role, me?.plan, me?.account_type) : null;
          const apiElite = typeof json?.isElite === 'boolean' ? Boolean(json.isElite) : null;
          setServerElite((meElite ?? apiElite) ?? null);

          if (resp.ok) {
            const serverThemes = Array.isArray(json?.themes) ? (json.themes as LandingTheme[]) : [];
            if (serverThemes.length > 0) setThemes(serverThemes);
            if (json?.selectedThemeId) setSelectedThemeId(json.selectedThemeId);
          }
        }
      } catch {
        // non-blocking
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) setEliteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [backend]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filters = Array.from(activeFilters);
    return themes.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const tags = (t.tags || []).join(',').toLowerCase();
      const desc = '';
      let ok = true;
      if (q) ok = name.includes(q) || tags.includes(q) || desc.includes(q);
      if (ok && filters.length) {
        for (const f of filters) {
          if (!tags.includes(f)) ok = false;
        }
      }
      return ok;
    });
  }, [themes, search, activeFilters]);

  const openModalFor = (t: LandingTheme) => {
    setModalTheme(t);
    setApplyError(null);
    setTab('desktop');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalTheme(null);
    setApplyError(null);
  };

  const toggleFilter = (f: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const applyTheme = async (t: LandingTheme) => {
    setApplyError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in required');
      const resp = await fetch(`${backend}/api/landing-themes/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ themeId: t.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (json?.code === 'ELITE_REQUIRED') {
          setApplyError('Upgrade to Job Seeker Elite to unlock themes.');
          return;
        }
        throw new Error(json?.error || 'Failed to apply theme');
      }
      setSelectedThemeId(t.id);
      toast.success(`Applied "${t.name}". Your landing page will use this theme when you publish.`, { duration: 4500 });
      closeModal();
    } catch (e: any) {
      setApplyError(e?.message || 'Failed to apply theme');
      toast.error(e?.message || 'Failed to apply theme');
    }
  };

  const selectedThemeName = useMemo(() => {
    return themes.find((t) => t.id === selectedThemeId)?.name || 'Minimal Clean';
  }, [themes, selectedThemeId]);

  return (
    <div className="h-full bg-slate-950 text-slate-100">
      <style>{pageCss}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-56 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-3xl"></div>
        <div className="absolute top-24 right-[-160px] h-[460px] w-[460px] rounded-full bg-emerald-500/10 blur-3xl"></div>
        <div className="absolute bottom-[-200px] left-[-160px] h-[540px] w-[540px] rounded-full bg-fuchsia-500/10 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-7 lg:px-8">
        <header className="fade-in flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/15 soft-border ring-glow grid place-items-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Landing Page Themes</h1>
                <span className="pill inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  Job Seeker Elite
                </span>
              </div>
            </div>

            <p className="max-w-2xl text-sm text-slate-300">Pick a theme (HTML skin), preview instantly, apply with one click, then publish your page.</p>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => navigate(backTo)}
                className="btn rounded-xl bg-white/6 px-3 py-2 text-xs font-medium soft-border hover:bg-white/10"
              >
                {isJobsHost ? 'Back to Prep' : 'Back to Dashboard'}
              </button>
              <Link
                to="/prep/landing-page"
                className="btn rounded-xl bg-white/6 px-3 py-2 text-xs font-medium soft-border hover:bg-white/10"
              >
                Open Landing Builder
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="pill rounded-2xl bg-white/5 soft-border px-4 py-3">
              <div className="flex items-center justify-between gap-4 text-xs text-slate-300">
                <span>Current theme</span>
                <span className="inline-flex items-center gap-2 text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  {selectedThemeName}
                </span>
              </div>
              <div className="mt-2 text-sm font-medium">{publicUrlExample}</div>
              <div className="mt-1 text-xs text-slate-400">Last published: —</div>
            </div>

            <button
              onClick={() => navigate('/prep/landing-page')}
              id="publishBtn"
              className="btn rounded-2xl bg-indigo-500/22 px-4 py-3 text-sm font-semibold text-indigo-100 soft-border hover:bg-indigo-500/30"
            >
              Publish changes
            </button>

            <button
              onClick={() => navigate('/pricing')}
              className={`${isElite ? 'hidden' : ''} btn rounded-2xl bg-indigo-500/16 px-4 py-3 text-sm font-semibold text-indigo-100 soft-border hover:bg-indigo-500/24`}
            >
              Upgrade to Elite
            </button>
          </div>
        </header>

        <section className="slide-up mt-6 glass rounded-2xl soft-border ring-glow p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-12 md:items-center">
            <div className="md:col-span-5">
              <label className="text-xs text-slate-300">Search Themes</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-white/5 soft-border px-3 py-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-300">
                  <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" />
                  <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                  placeholder="e.g. executive, dark, portfolio, modern"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-7">
              <label className="text-xs text-slate-300">Tags</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {[
                  ['executive', 'Executive'],
                  ['modern', 'Modern'],
                  ['dark', 'Dark Mode'],
                  ['portfolio', 'Portfolio'],
                  ['sales', 'Sales'],
                ].map(([key, label]) => {
                  const active = activeFilters.has(key);
                  return (
                    <button
                      key={key}
                      data-filter={key}
                      className={`filterBtn pill btn rounded-xl px-3 py-2 text-sm hover:bg-white/8 ${
                        active ? 'bg-indigo-500/15 text-indigo-100' : 'bg-white/5 text-slate-200'
                      }`}
                      onClick={() => toggleFilter(key)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {!filtered.length && (
              <div className="soft-border rounded-2xl bg-white/5 p-6 text-sm text-slate-300">
                {loading ? 'Loading themes…' : 'No themes found yet. If this is a fresh environment, apply the Supabase migration to seed themes.'}
              </div>
            )}
            {filtered.map((t, idx) => {
              const isSelected = t.id === selectedThemeId;
              const tagsLc = (t.tags || []).map((x) => String(x).toLowerCase());
              const pill1 = tagsLc[0] || 'modern';
              const pill2 = tagsLc[1] || 'clean';
              return (
                <article key={t.id} className="themeCard card-hover soft-border rounded-2xl bg-white/5 overflow-hidden" data-name={t.name}>
                  <div className="relative h-44 bg-slate-900/40">
                    {/* Live-ish preview thumbnail */}
                    <iframe
                      title={`${t.name} preview`}
                      className="absolute inset-0 h-full w-full"
                      srcDoc={buildThemePreviewHtml(t)}
                      sandbox="allow-same-origin"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="pill rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-100">{pill1}</span>
                      <span className="pill rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">{pill2}</span>
                      {isSelected && <span className="pill rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">Current</span>}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold tracking-tight">{t.name}</h3>
                        <p className="mt-1 text-sm text-slate-300">Premium theme skin for your personal landing page.</p>
                      </div>
                      <button
                        className={`previewBtn btn rounded-xl bg-white/6 px-3 py-2 text-xs font-medium soft-border hover:bg-white/10 ${!isElite ? 'opacity-60' : ''}`}
                        onClick={() => openModalFor(t)}
                      >
                        Preview
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-slate-400">Includes: hero + CTA + sections</div>
                      <button
                        className={`applyBtn btn rounded-xl bg-indigo-500/22 px-3 py-2 text-xs font-semibold text-indigo-100 soft-border hover:bg-indigo-500/30 ${!isElite ? 'opacity-60' : ''}`}
                        onClick={() => applyTheme(t)}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* Preview Modal */}
      {modalOpen && (
        <div id="previewModal" className="fixed inset-0 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl soft-border bg-slate-950/70 glass ring-glow slide-up">
            <div className="flex items-center justify-between px-5 py-4 soft-border border-b border-slate-700/30">
              <div>
                <div className="text-xs text-slate-300">Theme Preview</div>
                <h2 className="text-lg font-semibold tracking-tight">{modalTheme?.name || 'Theme Name'}</h2>
                <p className="mt-1 text-sm text-slate-300">Theme description.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="modalApply"
                  className={`btn rounded-xl bg-indigo-500/22 px-4 py-2 text-sm font-semibold text-indigo-100 soft-border hover:bg-indigo-500/30 ${!isElite ? 'opacity-60' : ''}`}
                  onClick={() => modalTheme && applyTheme(modalTheme)}
                >
                  Apply Theme
                </button>
                <button id="modalClose" className="btn rounded-xl bg-white/6 px-4 py-2 text-sm font-medium soft-border hover:bg-white/10" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="flex gap-2">
                <button
                  className={`tabBtn btn rounded-xl px-3 py-2 text-sm font-medium soft-border ${tab === 'desktop' ? 'bg-indigo-500/15 text-indigo-100' : 'bg-white/6 hover:bg-white/10'}`}
                  data-tab="desktop"
                  onClick={() => setTab('desktop')}
                >
                  Desktop
                </button>
                <button
                  className={`tabBtn btn rounded-xl px-3 py-2 text-sm font-medium soft-border ${tab === 'mobile' ? 'bg-indigo-500/15 text-indigo-100' : 'bg-white/6 hover:bg-white/10'}`}
                  data-tab="mobile"
                  onClick={() => setTab('mobile')}
                >
                  Mobile
                </button>
              </div>

              <div className="mt-4 soft-border rounded-xl bg-slate-900/30 h-[440px] grid place-items-center text-slate-400 text-sm">
                {modalTheme ? (
                  <iframe
                    title={`${modalTheme.name} preview ${tab}`}
                    className="h-full w-full"
                    srcDoc={buildThemePreviewHtml(modalTheme)}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <>Responsive Preview Placeholder ({tab})</>
                )}
              </div>

              <div className="mt-4 text-xs text-slate-400">
                Applying a theme changes layout, typography, and section styles—your content stays the same.
              </div>

              {!isElite && (
                <div className="mt-4 soft-border rounded-xl bg-indigo-500/10 p-4">
                  <div className="text-xs text-indigo-100 font-semibold">Elite required</div>
                  <p className="mt-1 text-xs text-slate-300">You can browse and preview themes, but applying is locked. Upgrade to Job Seeker Elite to unlock.</p>
                  <button
                    className="mt-3 btn w-full rounded-xl bg-indigo-500/22 px-4 py-2 text-sm font-semibold text-indigo-100 soft-border hover:bg-indigo-500/30"
                    onClick={() => navigate('/pricing')}
                  >
                    Upgrade to Elite
                  </button>
                </div>
              )}

              {applyError && <div className="mt-3 text-xs text-amber-200">{applyError}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

