import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type PlanInfo = {
  plan: string | null;
  remaining_credits: number | null;
  monthly_credits: number | null;
  plan_updated_at: string | null;
  role: string | null;
};

type PlanContextValue = {
  loading: boolean;
  plan: string | null;
  isFree: boolean;
  remainingCredits: number | null;
  monthlyCredits: number | null;
  role: string | null;
  refresh: () => Promise<void>;
};

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<PlanInfo>({ plan: null, remaining_credits: null, monthly_credits: null, plan_updated_at: null, role: null });

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setInfo({ plan: null, remaining_credits: null, monthly_credits: null, plan_updated_at: null, role: null });
        return;
      }
      // Preload role from auth metadata immediately to avoid gating flicker
      try {
        const { data: authUser } = await supabase.auth.getUser();
        const meta = authUser?.user?.user_metadata as any;
        const appMeta = (authUser?.user as any)?.app_metadata as any;
        const preloadRole = meta?.role || meta?.account_type || appMeta?.role || null;
        if (preloadRole && !info.role) {
          setInfo(prev => ({ ...prev, role: preloadRole }));
        }
      } catch {}
      const backend = (import.meta as any)?.env?.VITE_BACKEND_URL || '';
      const res = await fetch(`${backend}/api/user/plan`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Fetch role from users table; fall back to auth metadata if needed
      let role: string | null = null;
      try {
        const { data: userRow, error: roleErr } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!roleErr && userRow) role = (userRow as any)?.role || null;
      } catch {}
      if (!role) {
        try {
          const { data: authUser } = await supabase.auth.getUser();
          const meta = authUser?.user?.user_metadata as any;
          const appMeta = (authUser?.user as any)?.app_metadata as any;
          role = meta?.role || meta?.account_type || appMeta?.role || null;
        } catch {}
      }
      // Fallbacks: if plan is missing, infer from role and credits
      const planServer = data?.plan || null;
      const creditsRes = await fetch(`${backend}/api/credits/status`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        credentials: 'include'
      }).catch(()=>null);
      let creditsJson: any = null;
      if (creditsRes && creditsRes.ok) creditsJson = await creditsRes.json();

      const remainingCredits = typeof creditsJson?.remaining_credits === 'number'
        ? creditsJson.remaining_credits
        : (typeof data?.remaining_credits === 'number' ? data.remaining_credits : null);

      const monthlyCredits = typeof creditsJson?.total_credits === 'number'
        ? creditsJson.total_credits
        : (typeof data?.monthly_credits === 'number' ? data.monthly_credits : null);

      const roleLc = String(role || '').toLowerCase();
      // Treat guest as free for gating purposes unless a paid plan is explicitly set
      const resolvedPlan = planServer || ((roleLc==='free' || roleLc==='guest' || (remainingCredits===50)) ? 'free' : null);

      setInfo({
        plan: resolvedPlan,
        remaining_credits: remainingCredits,
        monthly_credits: monthlyCredits,
        plan_updated_at: data?.plan_updated_at || null,
        role,
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
    // Super admins should never be treated as free
    isFree: (() => {
      const normalizedRole = (info.role || '').toLowerCase().replace(/\s|-/g, '_');
      const isSuperAdmin = ['super_admin', 'superadmin'].includes(normalizedRole);
      const planLc = String(info.plan || '').toLowerCase();
      return (planLc === 'free' || normalizedRole === 'free' || normalizedRole === 'guest') && !isSuperAdmin;
    })(),
    remainingCredits: info.remaining_credits,
    monthlyCredits: info.monthly_credits,
    role: info.role,
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


