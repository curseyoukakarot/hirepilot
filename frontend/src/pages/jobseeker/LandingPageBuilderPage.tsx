import React, { useMemo, useState } from 'react';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaCode,
  FaLink,
  FaRotateLeft,
  FaWandMagicSparkles,
} from 'react-icons/fa6';
import { Link } from 'react-router-dom';

type Tone = 'Confident' | 'Warm' | 'Direct' | 'Story-driven';
type SectionKey = 'about' | 'experience' | 'caseStudies' | 'testimonials' | 'contact';

const initialHtml = `<section class="hero">
  <h1>Brandon Omoregie</h1>
  <p>Revenue leader helping B2B SaaS teams scale from $1M → $20M ARR.</p>
  <p>Head of Sales · GTM Strategy · Remote</p>
</section>

<section class="about">
  <h2>About</h2>
  <p>Short paragraph introducing your background, focus, and what you're looking for.</p>
</section>

<section class="experience">
  <h2>Selected Experience</h2>
  <ul>
    <li>Head of Sales – Nimbus Data (2021–Present)</li>
    <li>VP of Sales – CloudSync Technologies (2018–2021)</li>
  </ul>
</section>

<section class="contact">
  <h2>Contact</h2>
  <p>Email: you@example.com · LinkedIn: /in/your-handle</p>
</section>`;

const generatedHtml = `<section class="hero">
  <h1>Brandon Omoregie</h1>
  <p>Revenue leader helping B2B SaaS teams scale from $1M → $20M ARR.</p>
  <p>Head of Sales · GTM Strategy · Remote</p>
</section>

<section class="about">
  <h2>About</h2>
  <p>I'm a results-driven revenue leader with 10+ years of experience building and scaling high-performing sales teams. My expertise lies in developing GTM strategies, optimizing sales processes, and driving sustainable growth for B2B SaaS companies.</p>
</section>

<section class="experience">
  <h2>Selected Experience</h2>
  <ul>
    <li>Head of Sales – Nimbus Data (2021–Present)</li>
    <li>VP of Sales – CloudSync Technologies (2018–2021)</li>
    <li>Director of Sales – DataFlow Solutions (2015–2018)</li>
  </ul>
</section>

<section class="contact">
  <h2>Contact</h2>
  <p>Email: brandon@example.com · LinkedIn: /in/brandon-omoregie</p>
</section>`;

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
  const [heroFocus, setHeroFocus] = useState(
    'Revenue leader helping B2B SaaS teams scale from $1M → $20M ARR.'
  );
  const [heroSubtext, setHeroSubtext] = useState(
    "Short 1–2 sentence summary of who you are and what you do."
  );
  const [role, setRole] = useState('Head of Sales');
  const [tones, setTones] = useState<Tone[]>([]);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    about: true,
    experience: true,
    caseStudies: false,
    testimonials: false,
    contact: true,
  });
  const [htmlContent, setHtmlContent] = useState(initialHtml);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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

  const handleGenerate = () => setHtmlContent(generatedHtml);

  const handleInsertHero = () => {
    setHeroFocus('Revenue leader helping B2B SaaS teams scale from $1M → $20M ARR');
    setHeroSubtext(
      "I'm Brandon Omoregie, a revenue leader who's helped 12+ B2B SaaS companies scale from $1M to $20M+ ARR. I specialize in building high-performing sales teams, optimizing GTM strategies, and creating repeatable growth systems."
    );
  };

  const handleInsertCase = () => setHtmlContent((prev) => `${prev}\n\n${caseStudySnippet}`);

  const toneActive = (tone: Tone) => tones.includes(tone);
  const sectionActive = (key: SectionKey) => sections[key];

  const previewClasses = useMemo(
    () =>
      theme === 'dark'
        ? {
            wrapper: 'bg-slate-950',
            h1: 'text-slate-50',
            h2: 'text-slate-100',
            pPrimary: 'text-slate-300',
            p: 'text-slate-400',
          }
        : {
            wrapper: 'bg-slate-50',
            h1: 'text-slate-900',
            h2: 'text-slate-900',
            pPrimary: 'text-slate-700',
            p: 'text-slate-700',
          },
    [theme]
  );

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
                <span className="text-xs text-slate-300 font-mono">jobs.thehirepilot.com/p/your-page</span>
              </div>
              <span className="text-[10px] font-medium text-amber-400 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                Status: Draft
              </span>
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
                    className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <FaWandMagicSparkles />
                    <span>Generate base layout with REX</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              id="rex-suggestions-card"
              className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 space-y-3"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-100 mb-1">REX content ideas</h3>
                <p className="text-[11px] text-slate-500">Use these as starting points for your hero copy and case studies.</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-300">Hero example</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    "I'm Brandon Omoregie, a revenue leader who's helped 12+ B2B SaaS companies scale from $1M to $20M+ ARR.
                    I specialize in building high-performing sales teams, optimizing GTM strategies, and creating repeatable
                    growth systems."
                  </p>
                  <button
                    className="insert-hero-btn text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    onClick={handleInsertHero}
                  >
                    <FaArrowRight className="text-[9px]" />
                    <span>Insert into hero fields</span>
                  </button>
                </div>

                <div className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-300">Case study structure</span>
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1 mb-3 pl-4 list-disc">
                    <li>Challenge</li>
                    <li>Strategy</li>
                    <li>Execution</li>
                    <li>Outcome (with metrics)</li>
                  </ul>
                  <button
                    className="insert-case-btn text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    onClick={handleInsertCase}
                  >
                    <FaArrowRight className="text-[9px]" />
                    <span>Insert sample case study into HTML</span>
                  </button>
                </div>
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
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950/50 border border-slate-800">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`theme-toggle px-3 py-1 rounded text-xs font-medium transition-all ${
                      theme === t ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </div>

            <div
              id="preview-frame"
              className={`relative flex-1 rounded-2xl border border-slate-800 overflow-auto ${previewClasses.wrapper}`}
            >
              <div className="p-8 space-y-8">
                <section className="hero-preview text-center space-y-3">
                  <h1 className={`text-3xl font-bold ${previewClasses.h1}`}>Brandon Omoregie</h1>
                  <p className={`text-lg ${previewClasses.pPrimary} max-w-2xl mx-auto`}>{heroFocus}</p>
                  <p className={`text-sm ${previewClasses.p}`}>{role} · GTM Strategy · Remote</p>
                  <button className="mt-4 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
                    Contact
                  </button>
                </section>

                {sections.about && (
                  <section className="about-preview space-y-3">
                    <h2 className={`text-xl font-semibold border-b border-slate-800 pb-2 ${previewClasses.h2}`}>
                      About
                    </h2>
                    <p className={`text-sm leading-relaxed ${previewClasses.p}`}>
                      {heroSubtext}
                    </p>
                  </section>
                )}

                {sections.experience && (
                  <section className="experience-preview space-y-3">
                    <h2 className={`text-xl font-semibold border-b border-slate-800 pb-2 ${previewClasses.h2}`}>
                      Selected Experience
                    </h2>
                    <ul className="space-y-2">
                      <li className={`text-sm ${previewClasses.p}`}>Head of Sales – Nimbus Data (2021–Present)</li>
                      <li className={`text-sm ${previewClasses.p}`}>VP of Sales – CloudSync Technologies (2018–2021)</li>
                    </ul>
                  </section>
                )}

                {sections.caseStudies && (
                  <section className="case-preview space-y-3">
                    <h2 className={`text-xl font-semibold border-b border-slate-800 pb-2 ${previewClasses.h2}`}>
                      Case Study
                    </h2>
                    <p className={`text-sm ${previewClasses.p}`}>
                      Challenge · Strategy · Execution · Outcome (with metrics)
                    </p>
                  </section>
                )}

                {sections.testimonials && (
                  <section className="testimonial-preview space-y-3">
                    <h2 className={`text-xl font-semibold border-b border-slate-800 pb-2 ${previewClasses.h2}`}>
                      Testimonials
                    </h2>
                    <p className={`text-sm ${previewClasses.p}`}>What people say about your work.</p>
                  </section>
                )}

                {sections.contact && (
                  <section className="contact-preview space-y-3">
                    <h2 className={`text-xl font-semibold border-b border-slate-800 pb-2 ${previewClasses.h2}`}>
                      Contact
                    </h2>
                    <p className={`text-sm ${previewClasses.p}`}>
                      Email: you@example.com · LinkedIn: /in/your-handle
                    </p>
                  </section>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              This is a visual approximation. The final hosted page will use your generated HTML.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
