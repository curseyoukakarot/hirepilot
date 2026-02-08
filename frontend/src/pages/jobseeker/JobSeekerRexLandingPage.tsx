import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { JobSeekerPublicNav } from '../../components/jobseeker/JobSeekerPublicNav';
import PublicFooterJobs from '../../components/PublicFooterJobs';
import RexChatDemo from '../../components/jobseeker/RexChatDemo';

const badges = [
  'Hiring manager targeting',
  'Resume + document analysis',
  'Resume scoring + strategy',
  'Email outreach drafts',
];

const whatRexDoes = [
  'Find decision-makers by title, company, location',
  'Read resumes + uploads',
  'Score and improve positioning',
  'Generate outreach emails',
  'Guided by HirePilot methodology',
];

const targetingPrompts = [
  'Find Heads of Product at Series B SaaS companies in Austin.',
  'Find VPs of Sales at cybersecurity companies in Chicago.',
  'Find hiring managers for Product Manager roles in SF.',
];

const resumeBullets = [
  'Upload your resume and supporting docs',
  'REX identifies weak points (vague bullets, missing metrics, unclear positioning)',
  'Produces fixes + rewrites',
];

const methodBullets = [
  'Stop applying into ATS black holes',
  'Build a target list of real decision-makers',
  'Craft messaging with a strong reason to respond',
  'Follow-up strategically without sounding spammy',
];

const outreachBullets = [
  'Cold intro + warm follow-up sequences',
  'Tailored to your role, achievements, and the company',
  'Optimized for clarity + curiosity + credibility',
  'Ready to send via email (and LinkedIn if enabled)',
];

export default function JobSeekerRexLandingPage() {
  const navigate = useNavigate();

  const scrollToId = useCallback(
    (id: string) => {
      if (typeof window === 'undefined') return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate(`/#${id}`);
        setTimeout(() => {
          const target = document.getElementById(id);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    },
    [navigate]
  );

  return (
    <div className="bg-gradient-to-br from-[#0B0F1A] via-[#111827] to-[#0B0F1A] text-white font-sans min-h-screen">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fadeUp 0.7s ease-out both; }
      `}</style>
      <div className="sticky top-0 z-50">
        <JobSeekerPublicNav variant="dark" />
      </div>

      <main>
        <section id="hero" className="relative overflow-hidden animate-fade-up">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/25 via-transparent to-pink-900/25"></div>
          <div className="absolute -top-10 right-0 w-80 h-80 bg-purple-500/20 blur-3xl rounded-full"></div>
          <div className="absolute -bottom-20 left-10 w-96 h-96 bg-pink-500/20 blur-3xl rounded-full"></div>

          <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-16 text-center space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black">Your Job Search, In Plain English.</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-4xl mx-auto">
              REX finds hiring managers at scale, reads your resume + documents, scores your positioning, and drafts outreach
              emails that get replies — using HirePilot’s direct-connection methodology.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/50 transition-all"
                onClick={() => navigate('/prep/rex-chat')}
              >
                Try REX Chat
              </button>
              <button
                className="px-8 py-4 border border-white/20 rounded-xl text-slate-200 hover:bg-white/10 transition-colors"
                onClick={() => scrollToId('rex-demo')}
              >
                See It In Action
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="px-3 py-2 rounded-full bg-slate-900/70 border border-slate-800 text-xs text-slate-300"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="method" className="py-16 animate-fade-up">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold">From questions to conversations.</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {whatRexDoes.map((item) => (
                <div key={item} className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6">
                  <div className="flex items-start">
                    <i className="fa-solid fa-check text-green-400 mt-1 mr-3"></i>
                    <span className="text-slate-200">{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="targeting" className="py-16 animate-fade-up">
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Find decision-makers at scale — on demand.</h2>
              <p className="text-slate-300 mb-6">
                Stop guessing who matters. REX pulls a target list you can act on.
              </p>
              <div className="space-y-3">
                {targetingPrompts.map((prompt) => (
                  <div key={prompt} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-200">
                    “{prompt}”
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 p-6 space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Decision-makers found</span>
                <span className="text-white font-semibold">128</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: '68%' }}></div>
              </div>
              <p className="text-slate-400 text-xs">Target list refreshes based on your prompt and filters.</p>
            </div>
          </div>
        </section>

        <section id="resume-intel" className="py-16 animate-fade-up">
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-8 items-center">
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6">
              <h3 className="text-xl font-semibold mb-4">REX reads your resume like a recruiter.</h3>
              <ul className="space-y-3 text-slate-300">
                {resumeBullets.map((item) => (
                  <li key={item} className="flex items-start">
                    <i className="fa-solid fa-check text-green-400 mt-1 mr-3"></i>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-slate-400 mt-4">REX doesn’t just rewrite — it positions.</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Resume score</span>
                <span className="text-emerald-400 font-semibold">82 / 100</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" style={{ width: '82%' }}></div>
              </div>
              <div className="text-xs text-slate-400">
                Clear impact metrics + stronger positioning improve response rates.
              </div>
            </div>
          </div>
        </section>

        <section id="hirepilot-method" className="py-16 animate-fade-up">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold">Built on the direct-connection playbook.</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {methodBullets.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="outreach" className="py-16 animate-fade-up">
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Outreach that sounds human — and gets replies.</h2>
              <ul className="space-y-3 text-slate-300">
                {outreachBullets.map((item) => (
                  <li key={item} className="flex items-start">
                    <i className="fa-solid fa-check text-green-400 mt-1 mr-3"></i>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6">
              <div className="text-sm text-slate-400 mb-3">Outreach draft preview</div>
              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 text-sm text-slate-200">
                Hi [Name] — I noticed your team is hiring for [Role]. I’ve led revenue teams in B2B SaaS and recently scaled ARR
                from $2M to $15M. Would it be helpful if I shared a quick summary of how I’d approach this role?
              </div>
            </div>
          </div>
        </section>

        <section id="rex-demo" className="py-16 animate-fade-up">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold">See REX in action.</h2>
              <p className="text-slate-300 mt-3">
                A live-style preview of the REX chat interface — complete with context, assets, and outputs.
              </p>
            </div>
            <RexChatDemo />
          </div>
        </section>

        <section id="final-cta" className="py-16 animate-fade-up">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ask better questions. Get better opportunities.</h2>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  className="px-8 py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
                  onClick={() => navigate('/prep/rex-chat')}
                >
                  Try REX Chat
                </button>
                <button
                  className="px-8 py-3 bg-slate-900/80 text-white rounded-xl font-semibold border border-white/20 hover:bg-slate-900 transition-colors"
                  onClick={() => navigate('/signup')}
                >
                  Start Free
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooterJobs />
    </div>
  );
}
