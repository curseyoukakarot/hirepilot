import React, { useEffect, useState, useCallback } from 'react';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaCode,
  FaLink,
  FaGlobe,
  FaRotateLeft,
  FaWandMagicSparkles,
  FaArrowUpRightFromSquare,
  FaRotateRight,
} from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';
import { apiDelete, apiGet, apiPost } from '../../lib/api';
import { usePlan } from '../../context/PlanContext';

type Tone = 'Confident' | 'Warm' | 'Direct' | 'Story-driven';
type SectionKey = 'about' | 'experience' | 'caseStudies' | 'testimonials' | 'contact';

const initialHtml = `<section class="hp-page">
  <header class="hp-hero">
    <div class="hp-hero__inner">
      <div class="hp-badge">HirePilot Jobs • Personal Landing Page</div>

      <h1 class="hp-h1">Your Name Here</h1>

      <p class="hp-sub">
        Revenue leader helping B2B SaaS teams scale from <strong>$1M → $20M ARR</strong>.
      </p>

      <div class="hp-meta">
        <span class="hp-chip">Head of Sales</span>
        <span class="hp-dot">•</span>
        <span class="hp-chip">Tone: Confident</span>
      </div>

      <div class="hp-actions">
        <a class="hp-btn hp-btn--primary" href="#" target="_blank" rel="noreferrer">
          Schedule time with me
          <span class="hp-arrow">→</span>
        </a>
        <a class="hp-btn hp-btn--ghost" href="mailto:you@example.com">
          Email me
        </a>
      </div>

      <div class="hp-divider"></div>

      <div class="hp-mini">
        <div class="hp-mini__item">
          <div class="hp-mini__label">Email</div>
          <div class="hp-mini__value">you@example.com</div>
        </div>
        <div class="hp-mini__item">
          <div class="hp-mini__label">Schedule</div>
          <div class="hp-mini__value">Add your Calendly link</div>
        </div>
      </div>
    </div>
  </header>

  <main class="hp-main">
    <section class="hp-card">
      <h2 class="hp-h2">About</h2>
      <p class="hp-p">
        Short 1–2 sentence summary of who you are and what you do.
      </p>
    </section>

    <section class="hp-card">
      <h2 class="hp-h2">Selected Experience</h2>
      <ul class="hp-list">
        <li class="hp-li">
          <span class="hp-li__title">Head of Sales</span>
          <span class="hp-li__meta">Nimbus Data • 2021–Present</span>
        </li>
        <li class="hp-li">
          <span class="hp-li__title">VP of Sales</span>
          <span class="hp-li__meta">CloudSync Technologies • 2018–2021</span>
        </li>
      </ul>
    </section>

    <section class="hp-card">
      <h2 class="hp-h2">Contact</h2>
      <p class="hp-p">
        Prefer email? Reach me at <a class="hp-link" href="mailto:you@example.com">you@example.com</a>.
        <br />
        Want to talk? <a class="hp-link" href="#" target="_blank" rel="noreferrer">Schedule time here</a>.
      </p>
    </section>
  </main>

  <footer class="hp-footer">
    <div class="hp-footer__inner">
      <span>© <span id="hpYear"></span> Your Name Here</span>
      <span class="hp-footer__dot">•</span>
      <span>Powered by HirePilot Jobs</span>
    </div>
  </footer>
</section>

<style>
  :root{
    --bg: #070A0F;
    --panel: rgba(255,255,255,0.06);
    --panel2: rgba(255,255,255,0.04);
    --border: rgba(255,255,255,0.10);
    --text: rgba(255,255,255,0.92);
    --muted: rgba(255,255,255,0.66);
    --muted2: rgba(255,255,255,0.52);
    --accent: #7C5CFF;
    --accent2: #22C55E;
    --shadow: 0 20px 80px rgba(0,0,0,0.45);
    --radius: 18px;
    --radius2: 14px;
    --max: 980px;
  }

  .hp-page{
    background:
      radial-gradient(900px 600px at 20% 10%, rgba(124,92,255,0.25), transparent 60%),
      radial-gradient(800px 500px at 80% 25%, rgba(34,197,94,0.18), transparent 65%),
      radial-gradient(700px 500px at 50% 100%, rgba(255,255,255,0.06), transparent 55%),
      var(--bg);
    color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
    min-height: 100vh;
    padding: 28px 18px 18px;
  }

  .hp-hero__inner,
  .hp-main,
  .hp-footer__inner{
    max-width: var(--max);
    margin: 0 auto;
  }

  .hp-hero{
    position: relative;
    border: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
    border-radius: calc(var(--radius) + 6px);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .hp-hero__inner{
    padding: 34px 28px 18px;
  }

  .hp-badge{
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--muted);
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    padding: 8px 12px;
    border-radius: 999px;
    letter-spacing: 0.2px;
    margin-bottom: 18px;
  }

  .hp-h1{
    font-size: clamp(30px, 5vw, 46px);
    line-height: 1.08;
    margin: 0 0 10px;
    letter-spacing: -0.02em;
  }

  .hp-sub{
    margin: 0 0 14px;
    font-size: 16px;
    color: var(--muted);
    max-width: 60ch;
  }

  .hp-meta{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 14px 0 20px;
  }

  .hp-chip{
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    color: var(--text);
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    padding: 7px 10px;
    border-radius: 999px;
  }
  .hp-dot{ color: rgba(255,255,255,0.35); }

  .hp-actions{
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }

  .hp-btn{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
    transition: transform .12s ease, background .12s ease, border-color .12s ease;
    user-select: none;
  }
  .hp-btn:hover{ transform: translateY(-1px); }
  .hp-btn--primary{
    background: linear-gradient(135deg, rgba(124,92,255,0.95), rgba(124,92,255,0.75));
    border-color: rgba(124,92,255,0.75);
    color: white;
  }
  .hp-btn--ghost{
    background: rgba(255,255,255,0.05);
    color: var(--text);
  }
  .hp-arrow{ opacity: .9; }

  .hp-divider{
    height: 1px;
    width: 100%;
    background: rgba(255,255,255,0.10);
    margin: 10px 0 8px;
  }

  .hp-mini{
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 12px 0 14px;
  }
  @media (min-width: 560px){
    .hp-mini{ grid-template-columns: 1fr 1fr; }
  }

  .hp-mini__item{
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.03);
    border-radius: 14px;
    padding: 12px 12px;
  }
  .hp-mini__label{
    font-size: 11px;
    color: var(--muted2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
  }
  .hp-mini__value{
    font-size: 13px;
    color: var(--text);
    word-break: break-word;
  }

  .hp-main{
    margin-top: 18px;
    display: grid;
    gap: 14px;
  }

  .hp-card{
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.04);
    border-radius: var(--radius);
    padding: 18px 18px;
  }

  .hp-h2{
    margin: 0 0 8px;
    font-size: 13px;
    color: rgba(255,255,255,0.72);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
  }

  .hp-p{
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.55;
  }

  .hp-list{
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }

  .hp-li{
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.03);
    border-radius: 14px;
    padding: 12px 12px;
  }
  .hp-li__title{
    display: block;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 2px;
    font-size: 14px;
  }
  .hp-li__meta{
    display: block;
    color: var(--muted2);
    font-size: 13px;
  }

  .hp-link{
    color: rgba(124,92,255,0.95);
    text-decoration: none;
    border-bottom: 1px solid rgba(124,92,255,0.35);
  }
  .hp-link:hover{
    border-bottom-color: rgba(124,92,255,0.75);
  }

  .hp-footer{
    margin-top: 18px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.10);
  }
  .hp-footer__inner{
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.55);
    font-size: 12px;
  }
  .hp-footer__dot{ color: rgba(255,255,255,0.25); }
</style>

<script>
  document.getElementById("hpYear").textContent = new Date().getFullYear();
</script>`;

const generatedHtml = initialHtml;

const caseStudySnippet = `
<section class="case-study">
  <h2>Case Study: Scaling CloudSync from $2M to $15M ARR</h2>
  <h3>Challenge</h3>
  <p>CloudSync was struggling with inconsistent sales performance and lacked a structured approach to enterprise deals.</p>
  <h3>Strategy</h3>
  <p>Implemented a consultative selling framework and built a specialized enterprise sales team.</p>
  <h3>Execution</h3>
  <p>Trained 15 AEs on enterprise sales methodology, established clear qualification criteria, and created a repeatable demo process.</p>
  <h3>Outcome</h3>
  <p>650% ARR growth over 3 years, 85% increase in average deal size, and 40% improvement in win rate.</p>
</section>`;

export default function LandingPageBuilderPage() {
  const { role: accountRole } = usePlan();
  const roleLc = String(accountRole || '').toLowerCase().replace(/\s|-/g, '_');
  const isElite = ['super_admin', 'admin', 'team_admin', 'team_admins', 'job_seeker_elite'].includes(roleLc);

  const [heroFocus, setHeroFocus] = useState(
    'Revenue leader helping B2B SaaS teams scale from $1M → $20M ARR.'
  );
  const [heroSubtext, setHeroSubtext] = useState(
    "Short 1–2 sentence summary of who you are and what you do."
  );
  const [role, setRole] = useState('Head of Sales');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [calendly, setCalendly] = useState('');
  const [tones, setTones] = useState<Tone[]>([]);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    about: true,
    experience: true,
    caseStudies: false,
    testimonials: false,
    contact: true,
  });
  const [htmlContent, setHtmlContent] = useState(initialHtml);
  const [selectedThemeName, setSelectedThemeName] = useState<string>('Minimal Clean');
  const [themeWrapperHtml, setThemeWrapperHtml] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [landingPageId, setLandingPageId] = useState<string | null>(null);

  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domains, setDomains] = useState<any[]>([]);
  const [domainInstructions, setDomainInstructions] = useState<any | null>(null);
  const [domainActionLoading, setDomainActionLoading] = useState<string | null>(null);

  const saveLandingPage = useCallback(
    async (next: { slug: string; html: string; published: boolean }) => {
      const resp = await apiPost('/api/landing-pages/upsert', next, { requireAuth: true });
      const lp = resp?.landingPage;
      if (lp?.id) setLandingPageId(lp.id);
      return lp;
    },
    []
  );
  const markPublished = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const backend = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${backend}/api/jobs/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step: 'landing_page_published', metadata: { source: 'landing_page_builder' } }),
      });
    } catch (e) {
      console.warn('onboarding landing_page_published failed (non-blocking)', e);
    }
  }, []);
  const [idea, setIdea] = useState<string>('');
  const [slug, setSlug] = useState('your-page');
  const [slugSaved, setSlugSaved] = useState(false);
  const [htmlSaved, setHtmlSaved] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load any saved landing page draft for this user (best-effort)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiGet('/api/landing-pages/me', { requireAuth: true });
        const lp = resp?.landingPage;
        if (!lp || cancelled) return;
        if (lp?.id) setLandingPageId(lp.id);
        if (lp?.slug) setSlug(String(lp.slug));
        if (typeof lp?.published === 'boolean') setIsPublished(Boolean(lp.published));
        if (lp?.html) setHtmlContent(String(lp.html));
      } catch {
        // non-blocking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const wrapWithTheme = useCallback((content: string, wrapper: string | null) => {
    const base = wrapper || '';
    if (!base) return content;
    // Theme wrappers are stored with a simple {{content}} placeholder
    return base.includes('{{content}}') ? base.replace('{{content}}', content) : `${base}${content}`;
  }, []);

  const wrappedDoc = wrapWithTheme(htmlContent || initialHtml, themeWrapperHtml);

  // Load currently selected theme (and wrapper HTML) so preview/publish reflect it
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const backend = import.meta.env.VITE_BACKEND_URL || '';
        const resp = await fetch(`${backend}/api/landing-themes`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) return;
        const themes = Array.isArray(json?.themes) ? json.themes : [];
        const selectedId = json?.selectedThemeId || null;
        const selected = selectedId ? themes.find((t: any) => t.id === selectedId) : themes.find((t: any) => t.slug === 'minimal_clean');
        if (!cancelled) {
          setSelectedThemeName(selected?.name || 'Minimal Clean');
          setThemeWrapperHtml(selected?.theme_html || null);
        }
      } catch {
        // non-blocking
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleToneToggle = (tone: Tone) => {
    setTones((prev) => {
      if (prev.includes(tone)) {
        return prev.filter((t) => t !== tone);
      }
      if (prev.length >= 2) return prev;
      return [...prev, tone];
    });
  };

  const handleSectionToggle = (key: SectionKey) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setHtmlContent(buildHtml());
    setTimeout(() => setIsGenerating(false), 400);
  };

  const handleInsertHero = () => {
    setHeroFocus('Revenue leader helping B2B SaaS teams scale from $1M → $20M ARR');
    setHeroSubtext(
      "I'm Brandon Omoregie, a revenue leader who's helped 12+ B2B SaaS companies scale from $1M to $20M+ ARR. I specialize in building high-performing sales teams, optimizing GTM strategies, and creating repeatable growth systems."
    );
  };

  const handleInsertCase = () => setHtmlContent((prev) => `${prev}\n\n${caseStudySnippet}`);

  const toneActive = (tone: Tone) => tones.includes(tone);
  const sectionActive = (key: SectionKey) => sections[key];

  useEffect(() => {
    regenerateIdea();
  }, [name, role, heroFocus, heroSubtext, tones, calendly]);

  const handleSaveSlug = async () => {
    const cleaned = slug.trim().replace(/\s+/g, '-').toLowerCase() || 'your-page';
    setSlug(cleaned);
    try {
      const htmlToSave = htmlContent || buildHtml();
      await saveLandingPage({ slug: cleaned, html: htmlToSave, published: Boolean(isPublished) });
      setSlugSaved(true);
      setTimeout(() => setSlugSaved(false), 1500);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save slug');
    }
  };

  const handleSaveHtml = async () => {
    try {
      const htmlToSave = htmlContent || buildHtml();
      await saveLandingPage({ slug, html: htmlToSave, published: Boolean(isPublished) });
      setHtmlSaved(true);
      setTimeout(() => setHtmlSaved(false), 1200);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save HTML');
    }
  };

  const loadDomains = useCallback(
    async (lpId: string) => {
      setDomainsLoading(true);
      try {
        const resp = await apiGet(`/api/landing-domains/by-landing-page/${encodeURIComponent(lpId)}`, { requireAuth: true });
        setDomains(Array.isArray(resp?.domains) ? resp.domains : []);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load domains');
      } finally {
        setDomainsLoading(false);
      }
    },
    []
  );

  const openDomainModal = useCallback(async () => {
    setDomainModalOpen(true);
    setDomainInstructions(null);
    if (!isElite) return;
    try {
      const htmlToSave = htmlContent || buildHtml();
      const lp = await saveLandingPage({ slug, html: htmlToSave, published: Boolean(isPublished) });
      const lpId = lp?.id || landingPageId;
      if (lpId) await loadDomains(lpId);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to initialize domains');
    }
  }, [buildHtml, htmlContent, isElite, isPublished, landingPageId, loadDomains, saveLandingPage, slug]);

  const requestDomain = useCallback(async () => {
    if (!isElite) return;
    const lpId = landingPageId;
    if (!lpId) return toast.error('Save your landing page first');
    const d = String(domainInput || '').trim();
    if (!d) return toast.error('Enter a domain');
    setDomainActionLoading('request');
    try {
      const resp = await apiPost('/api/landing-domains/request', { landing_page_id: lpId, domain: d }, { requireAuth: true });
      setDomainInstructions(resp?.instructions || null);
      setDomainInput('');
      await loadDomains(lpId);
      toast.success('Domain requested — add the TXT record, then verify.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to request domain');
    } finally {
      setDomainActionLoading(null);
    }
  }, [domainInput, isElite, landingPageId, loadDomains]);

  const verifyDomain = useCallback(async (domain: string) => {
    if (!isElite) return;
    const lpId = landingPageId;
    if (!lpId) return;
    setDomainActionLoading(`verify:${domain}`);
    try {
      await apiPost('/api/landing-domains/verify', { domain }, { requireAuth: true });
      await loadDomains(lpId);
      toast.success('Verified — domain is now active.');
    } catch (e: any) {
      toast.error(e?.message || 'Not verified yet (DNS may still be propagating)');
    } finally {
      setDomainActionLoading(null);
    }
  }, [isElite, landingPageId, loadDomains]);

  const removeDomain = useCallback(async (id: string) => {
    if (!isElite) return;
    const lpId = landingPageId;
    if (!lpId) return;
    setDomainActionLoading(`remove:${id}`);
    try {
      await apiDelete(`/api/landing-domains/${encodeURIComponent(id)}`, { requireAuth: true });
      await loadDomains(lpId);
      toast.success('Domain removed.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove domain');
    } finally {
      setDomainActionLoading(null);
    }
  }, [isElite, landingPageId, loadDomains]);

  const regenerateIdea = () => {
    const parts = [
      name || 'Your Name Here',
      role || 'Your role',
      heroFocus || 'Your focus statement',
      heroSubtext || 'Your summary',
      tones.length ? `Tone: ${tones.join(', ')}` : '',
      calendly ? `Schedule: ${calendly}` : '',
    ]
      .filter(Boolean)
      .join(' • ');
    setIdea(`Highlight ${parts}. Keep it concise and outcome-driven; include 2–3 bullets with metrics where possible.`);
  };

  const openPreviewTab = () => {
    const html = htmlContent || buildHtml();
    const themed = wrapWithTheme(html, themeWrapperHtml);
    const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Landing Preview • ${selectedThemeName}</title></head><body>${themed}</body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(fullDoc);
      win.document.close();
    }
  };

  function buildHtml() {
    const safeName = name?.trim() || 'Your Name Here';
    const safeEmail = email?.trim() || 'you@example.com';
    const safeCalendly = calendly?.trim() || '#';
    const scheduleLabel = calendly?.trim() || 'Add your Calendly link';
    const toneText = tones.length ? tones.join(', ') : 'Your tone';
    const safeRole = role?.trim() || 'Your role';
    const safeHeroFocus = heroFocus?.trim() || 'Your focus statement';
    const safeHeroSubtext = heroSubtext?.trim() || 'Short 1–2 sentence summary of who you are and what you do.';

    let html = initialHtml;
    html = html.replace(/Your Name Here/g, safeName);
    html = html.replace(/you@example\.com/g, safeEmail);
    html = html.replace(/Add your Calendly link/g, scheduleLabel);
    html = html.replace(/Head of Sales/g, safeRole);
    html = html.replace(/Tone: Confident/g, `Tone: ${toneText}`);
    html = html.replace(
      /Revenue leader helping B2B SaaS teams scale from <strong>\$1M → \$20M ARR<\/strong>\./g,
      safeHeroFocus
    );
    html = html.replace(
      /Short 1–2 sentence summary of who you are and what you do\./g,
      safeHeroSubtext
    );
    // schedule links
    html = html.replace(/href="#"/g, `href="${safeCalendly}"`);
    html = html.replace(/href="c"/g, `href="${safeCalendly}"`);
    html = html.replace(/>c</g, `>${scheduleLabel}<`);
    // mailto
    html = html.replace(/mailto:you@example\.com/g, `mailto:${safeEmail}`);
    // contact display
    html = html.replace(/Schedule time here/g, calendly ? 'Schedule time here' : 'Add your Calendly link');
    return html;
  }

  return (
    <div className="bg-[#020617] text-slate-100 font-sans">
      <div id="main-wrapper" className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <header id="header" className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Link
                to="/prep"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm mb-3 transition-colors"
              >
                <FaArrowLeft className="text-xs" />
                <span>Back to Prep</span>
              </Link>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-medium text-slate-500 px-2 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
                  Prep Center
                </span>
                <span className="text-slate-600">/</span>
                <span className="text-[10px] font-medium text-blue-400 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                  Landing Page Builder
                </span>
              </div>
              <h1 className="text-3xl font-bold text-slate-50 mb-2">Landing Page Builder</h1>
              <p className="text-sm text-slate-400 max-w-2xl">
                Design a personal landing page that showcases your story, achievements, and contact details.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <FaLink className="text-xs text-slate-400" />
                <span className="text-xs text-slate-400 font-mono">jobs.thehirepilot.com/p/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="text-xs font-mono bg-transparent border-b border-slate-700 focus:border-blue-500 text-slate-200 outline-none w-28"
                  placeholder="your-page"
                />
                <button
                  className="px-2 py-1 rounded bg-slate-700 text-xs text-slate-100 hover:bg-slate-600 transition"
                  onClick={handleSaveSlug}
                >
                  Save
                </button>
                {slugSaved && <span className="text-[10px] text-emerald-400">Saved</span>}
              </div>
              <button
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                  isElite
                    ? 'bg-slate-800/50 border-slate-700/50 text-slate-200 hover:bg-slate-800'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
                onClick={openDomainModal}
                title={isElite ? 'Custom Domain (Elite)' : 'Custom Domain (Elite only)'}
              >
                <FaGlobe className="text-[12px]" />
                <span>Custom Domain</span>
                {!isElite && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Elite</span>}
              </button>
              <span
                className={`text-[10px] font-medium px-2 py-1 rounded-full border ${
                  isPublished
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}
              >
                Status: {isPublished ? 'Published' : 'Draft'}
              </span>
              <button
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition"
                onClick={async () => {
                  try {
                    const htmlToSave = htmlContent || buildHtml();
                    await saveLandingPage({ slug, html: htmlToSave, published: true });
                    setIsPublished(true);
                    await markPublished();
                    toast.success('Published');
                  } catch (e: any) {
                    toast.error(e?.message || 'Publish failed');
                  }
                }}
              >
                Publish
              </button>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)] gap-6"
        >
          <div id="left-column" className="flex flex-col gap-6">
            <div
              id="page-setup-card"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 space-y-4"
            >
              <div>
                <h3 className="text-base font-semibold text-slate-100 mb-1">Page setup</h3>
                <p className="text-[11px] text-slate-500">Tell REX how to position you, and what to highlight.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">Hero focus</label>
                  <input
                    type="text"
                    value={heroFocus}
                    onChange={(e) => setHeroFocus(e.target.value)}
                    placeholder="Revenue leader helping B2B SaaS teams scale from $1M → $20M ARR."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">Hero subtext</label>
                  <textarea
                    value={heroSubtext}
                    onChange={(e) => setHeroSubtext(e.target.value)}
                    placeholder="Short 1–2 sentence summary of who you are and what you do."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">Role & persona</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Head of Sales"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors mb-3"
                  />
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-2">Tone</label>
                    <div className="flex flex-wrap gap-2">
                      {(['Confident', 'Warm', 'Direct', 'Story-driven'] as Tone[]).map((tone) => (
                        <button
                          key={tone}
                          onClick={() => handleToneToggle(tone)}
                          className={`tone-tag px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            toneActive(tone)
                              ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                              : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-blue-500/20 hover:border-blue-500/30 hover:text-blue-300'
                          }`}
                        >
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition"
                      placeholder="Your Name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition"
                      placeholder="you@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">Calendly link</label>
                    <input
                      type="text"
                      value={calendly}
                      onChange={(e) => setCalendly(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition"
                      placeholder="https://calendly.com/your-link"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">Sections to include</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['about', 'About'],
                      ['experience', 'Experience'],
                      ['caseStudies', 'Case studies'],
                      ['testimonials', 'Testimonials'],
                      ['contact', 'Contact'],
                    ] as [SectionKey, string][]).map(([key, label]) => {
                      const active = sectionActive(key);
                      return (
                        <button
                          key={key}
                          onClick={() => handleSectionToggle(key)}
                          className={`section-toggle px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            active
                              ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                              : 'bg-slate-800/50 border border-slate-700/50 text-slate-400'
                          }`}
                        >
                          {active && <FaCheck className="text-[10px] mr-1 inline" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-slate-500 mb-3">
                    These settings help REX generate your base HTML. You can always edit the code manually.
                  </p>
                  <button
                    id="generate-btn"
                    onClick={handleGenerate}
                    className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    disabled={isGenerating}
                  >
                    <FaWandMagicSparkles />
                    <span>{isGenerating ? 'Generating…' : 'Generate base layout with REX'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              id="rex-suggestions-card"
              className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 mb-1">REX content ideas</h3>
                  <p className="text-[11px] text-slate-500">Based on your Page setup fields.</p>
                </div>
                <button
                  className="p-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition"
                  onClick={regenerateIdea}
                  title="Refresh suggestions"
                >
                  <FaRotateRight className="text-xs" />
                </button>
              </div>

              <div className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-3">
                <p className="text-[11px] text-slate-300 leading-relaxed mb-3">{idea || 'We will generate a suggestion based on your inputs.'}</p>
                <button
                  className="insert-hero-btn text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  onClick={() => {
                    setHeroSubtext(idea || heroSubtext);
                  }}
                >
                  <FaArrowRight className="text-[9px]" />
                  <span>Use this in About</span>
                </button>
              </div>
            </div>
          </div>

          <div
            id="center-column"
            className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 flex flex-col gap-3 h-[580px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-100">HTML template</span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-all flex items-center gap-1.5">
                  <FaCode className="text-[11px]" />
                  <span>Beautify</span>
                </button>
                <button
                  onClick={() => setHtmlContent(initialHtml)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-all flex items-center gap-1.5"
                >
                  <FaRotateLeft className="text-[11px]" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div className="relative flex-1 rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/70 border-b border-slate-800">
              <div className="text-xs font-medium text-slate-300 flex items-center gap-2">
                <FaCode className="text-slate-500" />
                <span>HTML template</span>
              </div>
              <div className="flex items-center gap-2">
                {htmlSaved && <span className="text-[10px] text-emerald-400">Saved</span>}
                <button
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition"
                  onClick={handleSaveHtml}
                >
                  Save
                </button>
              </div>
            </div>
              <div className="absolute left-0 top-0 bottom-0 w-10 bg-slate-900/50 border-r border-slate-800 flex flex-col items-center pt-3 text-[10px] text-slate-600 font-mono space-y-3">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <span key={idx}>{idx + 1}</span>
                ))}
              </div>
              <textarea
                id="html-editor"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="w-full h-full bg-transparent text-slate-100 font-mono text-[11px] leading-relaxed pl-14 pr-4 py-3 resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
          </div>

          <div
            id="right-column"
            className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 flex flex-col gap-3 h-[580px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-100">Live preview</span>
              <button
                onClick={openPreviewTab}
                className="px-3 py-2 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
                title="Open preview in new tab"
              >
                <div className="flex items-center gap-2">
                  <FaArrowUpRightFromSquare />
                  <span>Open in new tab</span>
                </div>
              </button>
            </div>

            <div id="preview-frame" className="relative flex-1 rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
              <iframe
                title="Landing preview"
                srcDoc={wrappedDoc}
                className="w-full h-full border-0"
                sandbox="allow-same-origin allow-popups allow-forms allow-scripts"
              />
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              This preview renders your current HTML content.
            </p>
          </div>
        </main>
      </div>

      {/* Custom Domain Modal (Elite) */}
      {domainModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800/80 bg-slate-900/90 backdrop-blur p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Custom Domain</div>
                <div className="text-[11px] text-slate-400">
                  Serve your landing page at your own domain (white-labeled). {isElite ? '' : 'Elite required.'}
                </div>
              </div>
              <button
                className="px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 hover:bg-slate-800 transition text-xs"
                onClick={() => setDomainModalOpen(false)}
              >
                Close
              </button>
            </div>

            {!isElite ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                <div className="text-sm font-semibold text-slate-100 mb-1">Upgrade to Job Seeker Elite</div>
                <div className="text-xs text-slate-400 mb-4">
                  Custom domains are available on Elite so you can fully white-label your landing page.
                </div>
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition"
                >
                  View plans
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-xs font-semibold text-slate-200 mb-2">Add a domain</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="yourname.com or profile.yourname.com"
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <button
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition disabled:opacity-60"
                      onClick={requestDomain}
                      disabled={domainActionLoading === 'request'}
                    >
                      {domainActionLoading === 'request' ? 'Requesting…' : 'Request'}
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    After requesting, we’ll show a TXT record to prove ownership. Also make sure your domain points to Vercel so HTTPS works.
                  </div>
                </div>

                {domainInstructions?.name && domainInstructions?.value && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="text-xs font-semibold text-slate-200 mb-2">DNS verification (TXT)</div>
                    <div className="grid gap-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Name</span>
                        <span className="text-slate-200 font-mono break-all">{domainInstructions.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Value</span>
                        <span className="text-slate-200 font-mono break-all">{domainInstructions.value}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2">
                      Add this record, wait for propagation (often 1–10 minutes), then click Verify on the domain below.
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-slate-200">Connected domains</div>
                    <button
                      className="px-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 hover:bg-slate-800 transition text-xs disabled:opacity-60"
                      onClick={() => landingPageId && loadDomains(landingPageId)}
                      disabled={domainsLoading}
                    >
                      {domainsLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                  {domainsLoading ? (
                    <div className="text-xs text-slate-500">Loading…</div>
                  ) : domains.length ? (
                    <div className="space-y-2">
                      {domains.map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-100 font-mono break-all">{d.domain}</div>
                            <div className="text-[10px] text-slate-500">
                              Status: <span className="text-slate-300">{d.status}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition disabled:opacity-60"
                              onClick={() => verifyDomain(String(d.domain))}
                              disabled={domainActionLoading === `verify:${d.domain}`}
                            >
                              {domainActionLoading === `verify:${d.domain}` ? 'Verifying…' : 'Verify'}
                            </button>
                            <button
                              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium transition disabled:opacity-60"
                              onClick={() => removeDomain(String(d.id))}
                              disabled={domainActionLoading === `remove:${d.id}`}
                            >
                              {domainActionLoading === `remove:${d.id}` ? 'Removing…' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No domains yet.</div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 text-center">
                  Once active, your landing page will be available at <span className="text-slate-300 font-mono">https://your-domain/</span>.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
