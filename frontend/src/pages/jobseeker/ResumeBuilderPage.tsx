import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowLeft,
  FaBrain,
  FaLink,
  FaPlus,
  FaPen,
  FaLightbulb,
  FaDownload,
  FaCopy,
} from 'react-icons/fa6';

export default function ResumeBuilderPage() {
  return (
    <div className="bg-[#020617] text-slate-100 font-sans antialiased">
      <div id="resume-builder-page" className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <header id="page-header" className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link
                to="/prep"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <FaArrowLeft />
                <span>Back to Prep</span>
              </Link>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-800/80">
              <span className="text-xs text-slate-400">Target:</span>
              <span className="text-xs font-medium text-slate-200">Head of Sales · B2B SaaS</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <FaBrain className="text-indigo-400 text-xs" />
              <span className="text-xs text-indigo-300">Prep Center / Resume Builder</span>
            </div>
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">Resume Builder</h1>
          <p className="text-slate-400 text-base">
            Generate a high-performing resume based on your target roles and experience.
          </p>
        </header>

        <div
          id="main-workspace"
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)] gap-6"
        >
          <div id="editor-panel" className="flex flex-col gap-6">
            {/* Target role */}
            <div
              id="target-role-section"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6"
            >
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white mb-1">Target role</h2>
                <p className="text-xs text-slate-400">Tell REX what you&apos;re aiming for so your resume is aligned.</p>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Primary title</label>
                  <input
                    type="text"
                    defaultValue="Head of Sales"
                    className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Focus</label>
                  <div className="flex flex-wrap gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-all">
                      Leadership
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800 transition-all">
                      IC
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800 transition-all">
                      Hybrid
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Industry</label>
                  <div className="flex flex-wrap gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-all">
                      B2B SaaS
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800 transition-all">
                      Healthtech
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800 transition-all">
                      Fintech
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800 transition-all">
                      Enterprise
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 mb-4">
                <FaLightbulb className="text-indigo-400 text-sm mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-300">
                    Tip: Be specific. &apos;Head of Sales for mid-market B2B SaaS&apos; is better than just &apos;Sales Leader&apos;.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-all flex items-center gap-2">
                  <FaBrain className="text-xs" />
                  Ask REX to refine target
                </button>
              </div>
            </div>

            {/* Experience */}
            <div
              id="experience-section"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6"
            >
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white mb-1">Experience</h2>
                <p className="text-xs text-slate-400">Select roles to highlight and let REX craft the bullets.</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-4 rounded-xl bg-slate-950/50 border border-indigo-500/30 hover:border-indigo-500/50 transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">Head of Sales</h3>
                      <p className="text-xs text-slate-400">Nimbus Data</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-7 h-7 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-all">
                        <FaPen className="text-xs text-slate-400" />
                      </button>
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                        Included
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">2021 – Present</span>
                    <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">View bullets</button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">VP of Sales</h3>
                      <p className="text-xs text-slate-400">CloudSync Technologies</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-7 h-7 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-all">
                        <FaPen className="text-xs text-slate-400" />
                      </button>
                      <span className="px-2.5 py-1 rounded-md bg-slate-800/50 border border-slate-700 text-slate-400 text-xs font-medium">
                        Excluded
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">2018 – 2021</span>
                    <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">View bullets</button>
                  </div>
                </div>
              </div>

              <button className="w-full py-2.5 rounded-lg border-2 border-dashed border-slate-700 text-slate-400 text-sm font-medium hover:border-slate-600 hover:text-slate-300 transition-all flex items-center justify-center gap-2">
                <FaPlus className="text-xs" />
                Add role manually
              </button>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-4">Active role editor</h3>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input
                      type="text"
                      defaultValue="Head of Sales"
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Company</label>
                    <input
                      type="text"
                      defaultValue="Nimbus Data"
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
                    <input
                      type="text"
                      placeholder="San Francisco, CA"
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Dates</label>
                    <input
                      type="text"
                      defaultValue="2021 – Present"
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Raw achievements / notes</label>
                  <textarea
                    rows={4}
                    placeholder="Paste your achievements, metrics, or notes here..."
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-2 mb-4">
                  <button className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-all flex items-center justify-center gap-2">
                    <FaBrain className="text-xs" />
                    Generate bullets with REX
                  </button>
                  <button className="px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-all">
                    Regenerate
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Increased ARR by 42% in 12 months by leading a 5-person outbound team and implementing data-driven
                      playbooks
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Reduced sales cycle from 90 to 45 days by implementing MEDDIC qualification framework across the entire
                      team
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Built and scaled outbound motion from 0 to $2.4M pipeline in 6 months through strategic SDR hiring and
                      enablement
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary & skills */}
            <div
              id="summary-skills-section"
              className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6"
            >
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white mb-1">Summary &amp; skills</h2>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-300 mb-2">Summary</label>
                <textarea
                  rows={4}
                  defaultValue="Results-driven sales leader with 8+ years building and scaling high-performing GTM teams in B2B SaaS. Proven track record of driving 40%+ ARR growth through strategic outbound motions and data-driven playbooks. Seeking Head of Sales role to leverage expertise in pipeline architecture and team development."
                  placeholder="2–3 lines summarizing who you are, your core value, and what you're looking for."
                  className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                />
                <button className="mt-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-all flex items-center gap-2">
                  <FaBrain className="text-xs" />
                  Ask REX to write summary
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'GTM Strategy',
                    'Pipeline Management',
                    'Outbound Playbooks',
                    'MEDDIC',
                    'Team Building',
                    'SaaS Sales',
                    'Enterprise Sales',
                    'Salesforce',
                  ].map((skill) => (
                    <button
                      key={skill}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-all"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div id="rex-tip-panel" className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <FaBrain className="text-indigo-400 text-sm" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-semibold text-white mb-1">REX tip</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                    Lead with outcomes, not responsibilities. Start bullets with verbs + metrics.
                  </p>
                  <button className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
                    See example bullets →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preview panel */}
          <div id="preview-panel" className="lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-medium text-slate-300">Preview: ATS Clean</span>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-900 transition-all flex items-center gap-2">
                    <FaDownload className="text-xs" />
                    Download
                  </button>
                  <button className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-900 transition-all flex items-center gap-2">
                    <FaCopy className="text-xs" />
                    Copy text
                  </button>
                </div>
              </div>

              <div
                id="resume-preview"
                className="mx-auto aspect-[8.5/11] w-full max-w-xl rounded-xl bg-slate-50 p-8 text-slate-900 shadow-2xl overflow-y-auto"
                style={{ maxHeight: '900px' }}
              >
                <div className="mb-6 pb-4 border-b-2 border-slate-300">
                  <h1 className="text-3xl font-bold text-slate-900 mb-1">Brandon Omoregie</h1>
                  <p className="text-sm text-slate-700 font-medium mb-2">Head of Sales · GTM Strategy · B2B SaaS</p>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>San Francisco, CA</span>
                    <span>·</span>
                    <span>brandon@email.com</span>
                    <span>·</span>
                    <span>linkedin.com/in/brandon</span>
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-2">SUMMARY</h2>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Results-driven sales leader with 8+ years building and scaling high-performing GTM teams in B2B SaaS.
                    Proven track record of driving 40%+ ARR growth through strategic outbound motions and data-driven
                    playbooks. Seeking Head of Sales role to leverage expertise in pipeline architecture and team
                    development.
                  </p>
                </div>

                <div className="mb-6">
                  <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-3">EXPERIENCE</h2>

                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-sm font-bold text-slate-900">Head of Sales</h3>
                      <span className="text-xs text-slate-600">2021 – Present</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mb-2">Nimbus Data</p>
                    <ul className="space-y-1.5 ml-4">
                      <li className="text-xs text-slate-700 leading-relaxed list-disc">
                        Increased ARR by 42% in 12 months by leading a 5-person outbound team and implementing data-driven
                        playbooks
                      </li>
                      <li className="text-xs text-slate-700 leading-relaxed list-disc">
                        Reduced sales cycle from 90 to 45 days by implementing MEDDIC qualification framework across the entire
                        team
                      </li>
                      <li className="text-xs text-slate-700 leading-relaxed list-disc">
                        Built and scaled outbound motion from 0 to $2.4M pipeline in 6 months through strategic SDR hiring
                        and enablement
                      </li>
                    </ul>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-sm font-bold text-slate-900">VP of Sales</h3>
                      <span className="text-xs text-slate-600">2018 – 2021</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mb-2">CloudSync Technologies</p>
                    <ul className="space-y-1.5 ml-4">
                      <li className="text-xs text-slate-700 leading-relaxed list-disc">
                        Scaled sales team from 3 to 15 reps while maintaining 85%+ quota attainment across the organization
                      </li>
                      <li className="text-xs text-slate-700 leading-relaxed list-disc">
                        Drove $8M to $24M ARR growth over 3 years through strategic enterprise account expansion
                      </li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-2">SKILLS</h2>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    GTM Strategy · Pipeline Management · Outbound Playbooks · MEDDIC · Team Building · SaaS Sales ·
                    Enterprise Sales · Salesforce
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
