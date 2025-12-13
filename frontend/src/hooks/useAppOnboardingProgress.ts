import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

export type AppStepKey =
  | 'app_campaign_created'
  | 'app_persona_created'
  | 'app_leads_added'
  | 'app_message_generated'
  | 'app_email_connected'
  | 'app_onboarding_complete';

export type AppOnboardingProgress = {
  steps: {
    step_key: AppStepKey;
    completed_at: string | null;
    metadata: any;
    credits: number;
  }[];
  requiredSteps: AppStepKey[];
  totalCompletedRequired: number;
  totalSteps: number;
  totalCreditsAwarded: number;
  lastStep: AppStepKey;
  lastAward: number;
};

const STEP_LABELS: Record<AppStepKey, string> = {
  app_campaign_created: 'Create your first campaign',
  app_persona_created: 'Define your target persona',
  app_leads_added: 'Add leads to your campaign',
  app_message_generated: 'Generate a message with REX',
  app_email_connected: 'Connect your email',
  app_onboarding_complete: 'Complete setup',
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = data.session?.access_token;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function useAppOnboardingProgress(opts: { autoToast?: boolean } = {}) {
  const { autoToast = false } = opts;
  const [progress, setProgress] = useState<AppOnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevCompleted = useRef<Set<AppStepKey>>(new Set());

  const fetchProgress = useCallback(async () => {
    try {
      setError(null);
      const base = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${base}/api/app/onboarding/progress`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(`progress_failed_${res.status}`);
      const data: AppOnboardingProgress = await res.json();
      setProgress(data);

      if (autoToast) {
        const nowCompleted = new Set(
          (data.steps || [])
            .filter((s) => !!s.completed_at && s.step_key !== 'app_onboarding_complete')
            .map((s) => s.step_key)
        );
        const newlyCompleted: AppStepKey[] = [];
        nowCompleted.forEach((k) => {
          if (!prevCompleted.current.has(k)) newlyCompleted.push(k as AppStepKey);
        });
        if (newlyCompleted.length) {
          newlyCompleted.forEach((k) => {
            const step = data.steps.find((s) => s.step_key === k);
            const credits = step?.credits || 0;
            toast.success(`You earned +${credits} credits for ${STEP_LABELS[k] || 'a step'}`);
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
    if (!progress?.steps) return new Set<AppStepKey>();
    return new Set(
      progress.steps.filter((s) => !!s.completed_at).map((s) => s.step_key)
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
