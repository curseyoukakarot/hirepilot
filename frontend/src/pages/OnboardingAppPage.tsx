import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight, FaBolt, FaCircleCheck, FaClock, FaGift } from 'react-icons/fa6';
import { useAppOnboardingProgress, AppStepKey } from '../hooks/useAppOnboardingProgress';

type StepContent = {
  key: AppStepKey;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  accent: string;
  hiddenForFree?: boolean;
};

const STEPS: StepContent[] = [
  {
    key: 'app_campaign_created',
    title: 'Create your first campaign',
    description: 'Campaigns are the engine of HirePilot. This is where sourcing and outreach begin.',
    actionLabel: 'Create campaign',
    href: '/campaigns',
    accent: 'from-violet-500/20 to-blue-500/10',
  },
  {
    key: 'app_persona_created',
    title: 'Define your target persona',
    description: 'Tell HirePilot who you want to reach so sourcing and messaging stay focused.',
    actionLabel: 'Create persona',
    href: '/personas',
    accent: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    key: 'app_leads_added',
    title: 'Add leads',
    description: 'Import or add leads to your campaign so you can begin outreach.',
    actionLabel: 'Add leads',
    href: '/leads',
    accent: 'from-amber-500/20 to-orange-500/10',
  },
  {
    key: 'app_message_generated',
    title: 'Generate your message',
    description: 'Use REX to write a message that speaks to your prospect’s problems and goals.',
    actionLabel: 'Generate message',
    href: '/campaigns',
    accent: 'from-emerald-500/20 to-teal-500/10',
  },
  {
    key: 'app_email_connected',
    title: 'Connect your email',
    description: 'Connect Gmail, Outlook, or SendGrid to send messages directly from HirePilot.',
    actionLabel: 'Connect email',
    href: '/settings/integrations',
    accent: 'from-pink-500/20 to-rose-500/10',
  },
];

export default function OnboardingAppPage() {
  const navigate = useNavigate();
  const { progress, completedKeys, loading, refresh } = useAppOnboardingProgress({ autoToast: true });

  const isPersonaRequired = useMemo(() => {
    // If requiredSteps contains persona, keep it; otherwise hide
    return progress?.requiredSteps?.includes('app_persona_created');
  }, [progress]);

  const stepsToRender = useMemo(() => {
    if (isPersonaRequired === false) {
      return STEPS.filter((s) => s.key !== 'app_persona_created');
    }
    return STEPS;
  }, [isPersonaRequired]);

  const completionPct = useMemo(() => {
    if (!progress?.totalSteps) return 0;
    const pct = Math.round((progress.totalCompletedRequired / progress.totalSteps) * 100);
    return Math.min(100, Math.max(0, pct));
  }, [progress]);

  const nextStep = useMemo(() => {
    return stepsToRender.find((step) => !completedKeys.has(step.key));
  }, [stepsToRender, completedKeys]);

  const earned = progress?.totalCreditsAwarded || 0;

  const handleAction = (step: StepContent) => {
    navigate(step.href);
  };

  return (
    <div className="min-h-screen bg-[#0b1220] text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header className="rounded-2xl border border-white/5 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-blue-500/5 p-6 sm:p-8 shadow-2xl shadow-indigo-500/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70 mb-2">HirePilot Activation</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">Get Activated</h1>
              <p className="text-zinc-300 mt-2 max-w-2xl">
                Complete these steps to unlock +100 credits and run your first real outbound action.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30">
                <FaGift className="text-indigo-200" />
              </div>
              <div>
                <div className="text-sm text-zinc-300">Credits earned</div>
                <div className="text-2xl font-semibold text-white">
                  {earned} / 100
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
              <span>{progress?.totalCompletedRequired ?? 0} of {progress?.totalSteps ?? stepsToRender.length} complete</span>
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
            {stepsToRender.map((step, idx) => {
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
                          +20 credits
                        </span>
                        {completed && (
                          <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                            Completed
                          </span>
                        )}
                        {!isPersonaRequired && step.key === 'app_persona_created' && (
                          <span className="text-xs text-blue-100 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
                            Skipped for free plan
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
                            <FaBolt className="text-indigo-200" /> Earn +20
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
              {nextStep ? nextStep.description : 'You unlocked the full +100 credits.'}
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
