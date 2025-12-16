import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { usePlan } from '../../context/PlanContext';

type ResumeTemplate = {
  id: string;
  name: string;
  slug: string;
  is_ats_safe: boolean;
  is_one_page: boolean;
  tags: string[];
  preview_image_url: string | null;
  template_config: any;
};

const MOCK_TEMPLATES: ResumeTemplate[] = [
  {
    id: 'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c002',
    name: 'Executive Sidebar',
    slug: 'executive_sidebar',
    is_ats_safe: false,
    is_one_page: false,
    tags: ['design', 'leadership'],
    preview_image_url: null,
    template_config: {},
  },
  {
    id: 'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c001',
    name: 'ATS-Safe Classic',
    slug: 'ats_safe_classic',
    is_ats_safe: true,
    is_one_page: true,
    tags: ['ats', 'classic', 'onepage'],
    preview_image_url: null,
    template_config: {},
  },
  {
    id: 'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c003',
    name: 'Modern Timeline',
    slug: 'modern_timeline',
    is_ats_safe: false,
    is_one_page: false,
    tags: ['design', 'timeline'],
    preview_image_url: null,
    template_config: {},
  },
  {
    id: 'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c004',
    name: 'Compact Operator',
    slug: 'compact_operator',
    is_ats_safe: true,
    is_one_page: true,
    tags: ['ats', 'compact', 'onepage'],
    preview_image_url: null,
    template_config: {},
  },
  {
    id: 'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c005',
    name: 'Brand Header Clean',
    slug: 'brand_header_clean',
    is_ats_safe: false,
    is_one_page: true,
    tags: ['design', 'brand', 'onepage'],
    preview_image_url: null,
    template_config: {},
  },
];

const pageCss = `
  /* Subtle motion + polish (Framer-ish vibes) */
  .fade-in { animation: fadeIn 420ms ease-out both; }
  .slide-up { animation: slideUp 520ms cubic-bezier(.2,.8,.2,1) both; }
  .slide-in-right { animation: slideInRight 520ms cubic-bezier(.2,.8,.2,1) both; }
  .shimmer {
    background: linear-gradient(110deg, rgba(255,255,255,.06) 8%, rgba(255,255,255,.14) 18%, rgba(255,255,255,.06) 33%);
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes slideUp { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform: translateY(0) } }
  @keyframes slideInRight { from { opacity:0; transform: translateX(18px) } to { opacity:1; transform: translateX(0) } }
  @keyframes shimmer { to { background-position-x: -200% } }
  .glass {
    background: radial-gradient(1200px 600px at 20% 0%, rgba(99,102,241,.18), transparent 50%),
                radial-gradient(900px 500px at 90% 10%, rgba(16,185,129,.16), transparent 45%),
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

export default function ResumeTemplatesPage() {
  const navigate = useNavigate();
  const { role } = usePlan();
  const roleLc = String(role || '').toLowerCase().replace(/\s|-/g, '_');
  const isEliteFromClient = roleLc === 'job_seeker_elite' || ['super_admin', 'admin', 'team_admin', 'team_admins'].includes(roleLc);

  const backend = (import.meta as any)?.env?.VITE_BACKEND_URL || '';
  const [templates, setTemplates] = useState<ResumeTemplate[]>(MOCK_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>('a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c001');
  const [serverElite, setServerElite] = useState<boolean | null>(null);
  const isElite = (serverElite ?? isEliteFromClient) === true;
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{ ats: boolean; design: boolean; onepage: boolean }>({ ats: false, design: false, onepage: false });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTemplate, setModalTemplate] = useState<ResumeTemplate | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const currentTemplateName = useMemo(() => {
    const match = templates.find((t) => t.id === selectedTemplateId);
    return match?.name || 'ATS-Safe Classic';
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const resp = await fetch(`${backend}/api/resume-templates`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) return;
        if (!cancelled) {
          // Only replace mocks if server returns non-empty list (migrations may not be applied yet)
          const serverTemplates = Array.isArray(json?.templates) ? (json.templates as ResumeTemplate[]) : [];
          if (serverTemplates.length > 0) setTemplates(serverTemplates);
          if (json?.selectedTemplateId) setSelectedTemplateId(json.selectedTemplateId);
          setServerElite(Boolean(json?.isElite));
        }
      } catch {
        // non-blocking (page still renders with empty state)
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [backend]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return templates.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const tags = (t.tags || []).join(',').toLowerCase();
      const desc = ''; // (we can add descriptions later)
      let ok = true;
      if (q) ok = name.includes(q) || tags.includes(q) || desc.includes(q);
      if (ok && filters.ats && !t.is_ats_safe) ok = false;
      if (ok && filters.onepage && !t.is_one_page) ok = false;
      if (ok && filters.design && !tags.includes('design')) ok = false;
      return ok;
    });
  }, [templates, search, filters]);

  const openModalFor = (t: ResumeTemplate) => {
    setModalTemplate(t);
    setApplyError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalTemplate(null);
    setApplyError(null);
  };

  const applyTemplate = async (t: ResumeTemplate) => {
    setApplyError(null);
    if (!isElite) {
      setApplyError('Upgrade to Job Seeker Elite to unlock templates.');
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in required');
      const resp = await fetch(`${backend}/api/resume-templates/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ templateId: t.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (json?.code === 'ELITE_REQUIRED') {
          setApplyError('Upgrade to Job Seeker Elite to unlock templates.');
          return;
        }
        throw new Error(json?.error || 'Failed to apply template');
      }
      setSelectedTemplateId(t.id);
      closeModal();
    } catch (e: any) {
      setApplyError(e?.message || 'Failed to apply template');
    }
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100">
      <style>{pageCss}</style>

      {/* Top gradient ambience */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-3xl"></div>
        <div className="absolute top-24 right-[-140px] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-3xl"></div>
        <div className="absolute bottom-[-180px] left-[-160px] h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-7 lg:px-8">
        {/* Header */}
        <header className="fade-in flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/15 soft-border ring-glow grid place-items-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M7 7h10M7 11h10M7 15h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 3h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" opacity=".5" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Resume Templates</h1>
                <span className="pill inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  Job Seeker Elite
                </span>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-slate-300">
              Choose a premium layout, preview instantly, and apply it to your resume export. Marked templates are{' '}
              <span className="text-slate-100 font-medium">ATS-Safe</span>.
            </p>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => navigate('/prep')}
                className="btn rounded-xl bg-white/6 px-3 py-2 text-xs font-medium soft-border hover:bg-white/10"
              >
                Back to Prep
              </button>
              <Link
                to="/prep/resume/builder"
                className="btn rounded-xl bg-white/6 px-3 py-2 text-xs font-medium soft-border hover:bg-white/10"
              >
                Open Resume Builder
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="pill inline-flex items-center justify-between rounded-xl bg-white/5 px-4 py-2 text-sm soft-border">
              <span className="text-slate-300">Current Template</span>
              <span className="ml-3 inline-flex items-center rounded-lg bg-indigo-500/15 px-2.5 py-1 text-xs text-indigo-100 soft-border">
                {currentTemplateName}
              </span>
            </div>

            <button
              onClick={() => navigate('/pricing')}
              className={`${isElite ? 'hidden' : ''} btn rounded-xl bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-100 soft-border hover:bg-indigo-500/28`}
            >
              Upgrade to Elite
            </button>
          </div>
        </header>

        {/* Controls */}
        <section className="slide-up mt-6 glass rounded-2xl soft-border ring-glow p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-12 md:items-center">
            <div className="md:col-span-5">
              <label className="text-xs text-slate-300">Search</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-white/5 soft-border px-3 py-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-300">
                  <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" />
                  <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                  placeholder="e.g. ATS, executive, one-page, timeline"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="md:col-span-7">
              <label className="text-xs text-slate-300">Filters</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  className={`filterBtn pill btn rounded-xl px-3 py-2 text-sm hover:bg-white/8 ${
                    filters.ats ? 'bg-indigo-500/15 text-indigo-100' : 'bg-white/5 text-slate-200'
                  }`}
                  onClick={() => setFilters((p) => ({ ...p, ats: !p.ats }))}
                >
                  ATS-Safe
                </button>
                <button
                  className={`filterBtn pill btn rounded-xl px-3 py-2 text-sm hover:bg-white/8 ${
                    filters.design ? 'bg-indigo-500/15 text-indigo-100' : 'bg-white/5 text-slate-200'
                  }`}
                  onClick={() => setFilters((p) => ({ ...p, design: !p.design }))}
                >
                  Design-Forward
                </button>
                <button
                  className={`filterBtn pill btn rounded-xl px-3 py-2 text-sm hover:bg-white/8 ${
                    filters.onepage ? 'bg-indigo-500/15 text-indigo-100' : 'bg-white/5 text-slate-200'
                  }`}
                  onClick={() => setFilters((p) => ({ ...p, onepage: !p.onepage }))}
                >
                  One Page
                </button>

                <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isElite ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    {isElite ? 'Elite Unlocked' : 'Locked (upgrade to apply)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {!filtered.length && (
              <div className="soft-border rounded-2xl bg-white/5 p-6 text-sm text-slate-300">
                {loading ? 'Loading templates…' : 'No templates found yet. If this is a fresh environment, apply the Supabase migration to seed templates.'}
              </div>
            )}
            {filtered.map((t, idx) => {
              const tagsLc = (t.tags || []).map((x) => String(x).toLowerCase());
              const isDesign = tagsLc.includes('design');
              const isSelected = t.id === selectedTemplateId;
              return (
                <article
                  key={t.id}
                  className="templateCard card-hover soft-border rounded-2xl bg-white/5 overflow-hidden"
                  data-name={t.name}
                >
                  <div className="relative h-44 bg-slate-900/40">
                    <div className="absolute inset-0 shimmer" style={{ animationDelay: `${idx * 180}ms` }}></div>
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                      {t.preview_image_url ? 'Preview' : 'Preview Placeholder'}
                    </div>
                    <div className="absolute top-3 left-3 flex gap-2">
                      {t.is_ats_safe ? (
                        <span className="pill rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">ATS-Safe</span>
                      ) : (
                        <span className="pill rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-[11px] text-fuchsia-200">Design-Forward</span>
                      )}
                      <span className="pill rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                        {t.is_one_page ? 'One Page' : 'Multi-page'}
                      </span>
                      {isSelected && (
                        <span className="pill rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-100">Current</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold tracking-tight">{t.name}</h3>
                        <p className="mt-1 text-sm text-slate-300">
                          {t.is_ats_safe ? 'Highest parsing reliability for applications.' : 'Premium, personality-friendly layout for standout resumes.'}
                        </p>
                      </div>
                      <button
                        className={`previewBtn btn rounded-xl bg-white/6 px-3 py-2 text-xs font-medium soft-border hover:bg-white/10 ${!isElite ? 'opacity-60' : ''}`}
                        onClick={() => openModalFor(t)}
                      >
                        Preview
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {(t.tags || []).slice(0, 3).map((tag) => (
                        <span key={`${t.id}-${tag}`} className={`pill rounded-full px-2.5 py-1 ${tag === 'ats' ? 'bg-emerald-500/10 text-emerald-100' : tag === 'design' ? 'bg-fuchsia-500/10 text-fuchsia-200' : 'bg-white/5 text-slate-200'}`}>
                          {String(tag).replace(/_/g, ' ')}
                        </span>
                      ))}
                      {isDesign && !t.tags.includes('Design') && (
                        <span className="pill rounded-full bg-indigo-500/10 px-2.5 py-1 text-indigo-100">Modern</span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-slate-400">{t.is_ats_safe ? 'Best for: applying fast' : 'Best for: standout visuals'}</div>
                      <button
                        className={`applyBtn btn rounded-xl bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 soft-border hover:bg-indigo-500/28 ${!isElite ? 'opacity-60' : ''}`}
                        onClick={() => applyTemplate(t)}
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
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl soft-border bg-slate-950/70 glass ring-glow slide-up">
            <div className="flex items-center justify-between px-5 py-4 soft-border border-b border-slate-700/30">
              <div>
                <div className="text-xs text-slate-300">Template Preview</div>
                <h2 className="text-lg font-semibold tracking-tight">{modalTemplate?.name || 'Template'}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`btn rounded-xl bg-indigo-500/22 px-4 py-2 text-sm font-semibold text-indigo-100 soft-border hover:bg-indigo-500/30 ${!isElite ? 'opacity-60' : ''}`}
                  onClick={() => modalTemplate && applyTemplate(modalTemplate)}
                >
                  Apply Template
                </button>
                <button className="btn rounded-xl bg-white/6 px-4 py-2 text-sm font-medium soft-border hover:bg-white/10" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-0 md:grid-cols-12">
              <div className="md:col-span-8 p-5">
                <div className="soft-border rounded-xl bg-slate-900/30 h-[420px] grid place-items-center text-slate-400 text-sm">
                  Large Preview Placeholder
                </div>
              </div>
              <aside className="md:col-span-4 p-5 soft-border border-l border-slate-700/30">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {modalTemplate?.is_ats_safe && (
                      <span className="pill rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">ATS-Safe</span>
                    )}
                    {!modalTemplate?.is_ats_safe && (
                      <span className="pill rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-xs text-fuchsia-200">Design-Forward</span>
                    )}
                    {modalTemplate?.is_one_page && (
                      <span className="pill rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-200">One Page</span>
                    )}
                  </div>

                  <p className="text-sm text-slate-300">
                    {modalTemplate?.is_ats_safe
                      ? 'Single-column ATS-friendly layout with clean hierarchy and strong parsing.'
                      : 'Premium layout with stronger visual hierarchy while keeping your content clean.'}
                  </p>

                  <div className="soft-border rounded-xl bg-white/5 p-4">
                    <div className="text-xs text-slate-300">What changes when applied</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300 list-disc pl-5">
                      <li>Export layout + typography</li>
                      <li>Section ordering rules</li>
                      <li>Spacing and heading styles</li>
                      <li>Optional sidebar blocks (where supported)</li>
                    </ul>
                  </div>

                  {!isElite && (
                    <div className="soft-border rounded-xl bg-indigo-500/10 p-4">
                      <div className="text-xs text-indigo-100 font-semibold">Elite required</div>
                      <p className="mt-1 text-xs text-slate-300">
                        You can browse and preview templates, but applying is locked. Upgrade to Job Seeker Elite to unlock 1-click template swapping.
                      </p>
                      <button
                        className="mt-3 btn w-full rounded-xl bg-indigo-500/22 px-4 py-2 text-sm font-semibold text-indigo-100 soft-border hover:bg-indigo-500/30"
                        onClick={() => navigate('/pricing')}
                      >
                        Upgrade to Elite
                      </button>
                    </div>
                  )}

                  {applyError && <div className="text-xs text-amber-200">{applyError}</div>}

                  <div className="text-xs text-slate-400">Tip: “ATS-Safe” templates are best when applying directly on job boards.</div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

