import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type PlanInfo = {
  plan: string | null;
  remaining_credits: number | null;
  monthly_credits: number | null;
  plan_updated_at: string | null;
};

type PlanContextValue = {
  loading: boolean;
  plan: string | null;
  isFree: boolean;
  remainingCredits: number | null;
  monthlyCredits: number | null;
  refresh: () => Promise<void>;
};

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<PlanInfo>({ plan: null, remaining_credits: null, monthly_credits: null, plan_updated_at: null });

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setInfo({ plan: null, remaining_credits: null, monthly_credits: null, plan_updated_at: null });
        return;
      }
      const backend = (import.meta as any)?.env?.VITE_BACKEND_URL || '';
      const res = await fetch(`${backend}/api/user/plan`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setInfo({
        plan: data?.plan || null,
        remaining_credits: typeof data?.remaining_credits === 'number' ? data.remaining_credits : null,
        monthly_credits: typeof data?.monthly_credits === 'number' ? data.monthly_credits : null,
        plan_updated_at: data?.plan_updated_at || null,
      });
    } catch (e) {
      // Non-blocking; leave defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const value = useMemo<PlanContextValue>(() => ({
    loading,
    plan: info.plan,
    isFree: (info.plan || 'free') === 'free',
    remainingCredits: info.remaining_credits,
    monthlyCredits: info.monthly_credits,
    refresh: fetchPlan,
  }), [loading, info, fetchPlan]);

  return (
    <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}


