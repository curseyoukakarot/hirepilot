import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

export type OnboardingStepKey =
  | 'resume_generated'
  | 'target_role_set'
  | 'rex_chat_activated'
  | 'outreach_angles_created'
  | 'landing_page_published'
  | 'email_connected'
  | 'chrome_extension_installed';

export type OnboardingStep = {
  key: OnboardingStepKey;
  credits: number;
  completed_at: string | null;
  metadata?: any;
};

export type OnboardingProgress = {
  steps: OnboardingStep[];
  total_completed: number;
  total_steps: number;
  total_credits_awarded: number;
};

const STEP_LABELS: Record<OnboardingStepKey, string> = {
  resume_generated: 'Generate Resume',
  target_role_set: 'Define Target Role',
  rex_chat_activated: 'Activate REX Chat',
  outreach_angles_created: 'Generate Outreach Angles',
  landing_page_published: 'Publish Landing Page',
  email_connected: 'Connect Email Account',
  chrome_extension_installed: 'Install Chrome Extension',
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = data.session?.access_token;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function useOnboardingProgress(opts: { autoToast?: boolean } = {}) {
  const { autoToast = false } = opts;
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevCompleted = useRef<Set<OnboardingStepKey>>(new Set());

  const fetchProgress = useCallback(async () => {
    try {
      setError(null);
      const base = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${base}/api/jobs/onboarding/progress`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(`progress_failed_${res.status}`);
      const data: OnboardingProgress = await res.json();
      setProgress(data);

      if (autoToast) {
        const nowCompleted = new Set(
          (data.steps || [])
            .filter((s) => !!s.completed_at)
            .map((s) => s.key)
        );
        const newlyCompleted: OnboardingStepKey[] = [];
        nowCompleted.forEach((k) => {
          if (!prevCompleted.current.has(k)) newlyCompleted.push(k as OnboardingStepKey);
        });
        if (newlyCompleted.length) {
          newlyCompleted.forEach((k) => {
            const step = data.steps.find((s) => s.key === k);
            const credits = step?.credits || 0;
            toast.success(`Bonus credits unlocked: +${credits} for ${STEP_LABELS[k] || 'step'}`);
          });
        }
        prevCompleted.current = nowCompleted;
      }
    } catch (e: any) {
      setError(e?.message || 'progress_failed');
    } finally {
      setLoading(false);
    }
  }, [autoToast]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const completedKeys = useMemo(() => {
    if (!progress?.steps) return new Set<OnboardingStepKey>();
    return new Set(
      progress.steps.filter((s) => !!s.completed_at).map((s) => s.key)
    );
  }, [progress]);

  return {
    progress,
    loading,
    error,
    completedKeys,
    refresh: fetchProgress,
    labels: STEP_LABELS,
  };
}
