import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaBolt, FaArrowRight, FaCircleCheck, FaClock, FaGift, FaShieldCat } from 'react-icons/fa6';
import { useOnboardingProgress, OnboardingStepKey } from '../../hooks/useOnboardingProgress';

type StepContent = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  external?: boolean;
  accent: string;
};

const STEP_CONTENT: StepContent[] = [
  {
    key: 'resume_generated',
    title: 'Generate Resume',
    description: 'Upload your resume or LinkedIn PDF and let REX rewrite it.',
    actionLabel: 'Open Resume Wizard',
    href: '/prep/resume/wizard',
    accent: 'from-violet-500/20 to-blue-500/10',
  },
  {
    key: 'target_role_set',
    title: 'Define Target Role',
    description: 'Lock in title, industry, and focus so REX can tailor outputs.',
    actionLabel: 'Set target role',
    href: '/prep/resume/builder',
    accent: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    key: 'rex_chat_activated',
    title: 'Activate REX Chat',
    description: 'Send your first question to REX and unlock real-time coaching.',
    actionLabel: 'Start chatting',
    href: '/prep/rex-chat',
    accent: 'from-emerald-500/20 to-teal-500/10',
  },
  {
    key: 'outreach_angles_created',
    title: 'Generate Outreach Angles',
    description: 'Have REX craft outreach angles and messaging for your search.',
    actionLabel: 'Generate angles',
    href: '/prep/rex-chat?prefill=Help me generate outreach angles for my target role.',
    accent: 'from-amber-500/20 to-orange-500/10',
  },
  {
    key: 'landing_page_published',
    title: 'Publish Landing Page',
    description: 'Ship your personal landing page and share it with recruiters.',
    actionLabel: 'Open landing builder',
    href: '/prep/landing-page',
    accent: 'from-pink-500/20 to-rose-500/10',
  },
  {
    key: 'email_connected',
    title: 'Connect Email Account',
    description: 'Connect your inbox so REX can personalize follow-ups.',
    actionLabel: 'Connect email',
    href: '/settings/integrations',
    accent: 'from-sky-500/20 to-indigo-500/10',
  },
  {
    key: 'chrome_extension_installed',
    title: 'Install Chrome Extension',
    description: 'Get inline REX prompts on LinkedIn and job boards.',
    actionLabel: 'Install extension',
    href: 'https://chrome.google.com/webstore/detail/hirepilot/placeholder',
    external: true,
    accent: 'from-slate-500/20 to-slate-700/10',
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { progress, completedKeys, loading, refresh } = useOnboardingProgress({ autoToast: true });

  const completionPct = useMemo(() => {
    if (!progress) return 0;
    if (!progress.total_steps) return 0;
    return Math.round((progress.total_completed / progress.total_steps) * 100);
  }, [progress]);

  const nextStep = useMemo(() => {
    return STEP_CONTENT.find((step) => !completedKeys.has(step.key));
  }, [completedKeys]);

  const handleAction = (step: StepContent) => {
    if (step.external) {
      window.open(step.href, '_blank', 'noopener');
      return;
    }
    navigate(step.href);
  };

  return (
    <div className="min-h-screen bg-[#0b1220] text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header className="rounded-2xl border border-white/5 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-blue-500/5 p-6 sm:p-8 shadow-2xl shadow-indigo-500/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70 mb-2">Job search setup</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">Onboarding Checklist</h1>
              <p className="text-zinc-300 mt-2 max-w-2xl">
                Unlock up to 100 credits by completing these seven steps. REX guides you the whole way.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30">
                <FaGift className="text-indigo-200" />
              </div>
              <div>
                <div className="text-sm text-zinc-300">Credits earned</div>
                <div className="text-2xl font-semibold text-white">
                  {progress?.total_credits_awarded ?? 0} / 100
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
              <span>{progress?.total_completed ?? 0} of {progress?.total_steps ?? STEP_CONTENT.length} complete</span>
              <span>{completionPct}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500 transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white/5 border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STEP_CONTENT.map((step, idx) => {
              const completed = completedKeys.has(step.key);
              return (
                <motion.div
                  key={step.key}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-2xl border border-white/5 bg-gradient-to-br ${step.accent} p-5 shadow-lg shadow-black/20`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {completed ? (
                        <FaCircleCheck className="text-emerald-400" />
                      ) : (
                        <FaClock className="text-amber-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm uppercase tracking-wide text-white/70">Step {idx + 1}</span>
                        <span className="text-xs bg-white/10 text-white px-2 py-1 rounded-full border border-white/10">
                          +{progress?.steps.find((s) => s.key === step.key)?.credits ?? 0} credits
                        </span>
                        {completed && (
                          <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                            Completed
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mt-1">{step.title}</h3>
                      <p className="text-sm text-zinc-200/80 mt-1">{step.description}</p>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={() => handleAction(step)}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                            completed
                              ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                              : 'bg-indigo-500 text-white hover:bg-indigo-400 border border-indigo-400/40 shadow-lg shadow-indigo-500/20'
                          }`}
                        >
                          {completed ? 'View step' : step.actionLabel}
                          <FaArrowRight className="text-xs" />
                        </button>
                        {!completed && (
                          <span className="text-xs text-indigo-100/80 flex items-center gap-1">
                            <FaBolt className="text-indigo-200" /> Earn +{progress?.steps.find((s) => s.key === step.key)?.credits ?? 0}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-2xl border border-white/5 bg-white/5 p-5 flex items-center justify-between"
        >
          <div>
            <div className="text-sm text-zinc-200/80">Next up</div>
            <div className="text-lg font-semibold text-white">
              {nextStep ? nextStep.title : 'All steps completed 🎉'}
            </div>
            <p className="text-sm text-zinc-300/80">
              {nextStep ? nextStep.description : 'You unlocked all onboarding credits.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (nextStep) handleAction(nextStep);
              }}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 transition shadow-lg shadow-indigo-500/20 text-sm font-medium"
              disabled={!nextStep}
            >
              {nextStep ? 'Continue setup' : 'Refresh'}
            </button>
            <button
              onClick={refresh}
              className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 border border-white/10 text-sm"
            >
              Refresh
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
