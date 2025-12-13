import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCircleCheck, FaArrowRight } from 'react-icons/fa6';
import { supabase } from '../../lib/supabaseClient';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';

const BANNER_KEY = 'hp_onboarding_banner_dismissed';

export function OnboardingBanner() {
  const navigate = useNavigate();
  const { progress, loading } = useOnboardingProgress();
  const [show, setShow] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    (async () => {
      const dismissed = typeof window !== 'undefined' && localStorage.getItem(BANNER_KEY) === '1';
      if (dismissed) return;
      const { data } = await supabase.auth.getUser();
      const createdAt = data.user?.created_at;
      if (createdAt) {
        const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (days <= 14) setIsNewUser(true);
      }
      setShow(true);
    })();
  }, []);

  const completed = progress?.total_completed ?? 0;
  const total = progress?.total_steps ?? 7;
  const pct = useMemo(() => {
    if (!progress?.total_steps) return 0;
    return Math.round((completed / total) * 100);
  }, [completed, total, progress]);

  if (loading || !show) return null;
  if (!isNewUser && completed >= total) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-xl border border-white/10 bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-blue-500/10 p-4 shadow-lg shadow-indigo-500/10"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
            <FaCircleCheck className="text-indigo-100" />
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-indigo-100/70">Job Search Setup</div>
            <div className="text-white font-semibold">
              {completed} of {total} steps complete — earn up to 100 credits
            </div>
            <div className="text-xs text-indigo-100/80 flex items-center gap-2 mt-1">
              <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-1.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-blue-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span>{pct}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              localStorage.setItem(BANNER_KEY, '1');
              setShow(false);
            }}
            className="text-xs text-white/80 hover:text-white px-3 py-2 rounded-lg bg-white/10 border border-white/10"
          >
            Dismiss
          </button>
          <button
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 border border-indigo-400/40 text-sm font-medium"
          >
            Continue setup <FaArrowRight className="text-[11px]" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
