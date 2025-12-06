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
      // Feature flag: prefer unified /api/user/me for canonical role + plan
      const useUserMe = (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const flag = (import.meta as any)?.env?.VITE_USE_USER_ME;
          return String(flag || 'false').toLowerCase() === 'true';
        } catch {
          return false;
        }
      })();
      // Preload role from auth metadata immediately to avoid gating flicker
      try {
        const { data: authUser } = await supabase.auth.getUser();
        const meta = authUser?.user?.user_metadata as any;
        const appMeta = (authUser?.user as any)?.app_metadata as any;
        // Prefer app_metadata.role over user_metadata to avoid guest overriding admin
        const preloadRole = appMeta?.role || meta?.role || meta?.account_type || null;
        if (preloadRole && !info.role) {
          setInfo(prev => ({ ...prev, role: preloadRole }));
        }
      } catch {}
      const backend = (import.meta as any)?.env?.VITE_BACKEND_URL || '';
      if (useUserMe) {
        try {
          const meRes = await fetch(`${backend}/api/user/me`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            credentials: 'include'
          });
          if (!meRes.ok) throw new Error(await meRes.text());
          const me = await meRes.json();
          setInfo({
            plan: me?.plan || null,
            remaining_credits: (typeof me?.remaining_credits === 'number') ? me.remaining_credits : null,
            monthly_credits: (typeof me?.monthly_credits === 'number') ? me.monthly_credits : null,
            plan_updated_at: null,
            role: me?.role || info.role || null,
          });
          return;
        } catch {
          // fall through to legacy path
        }
      }
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
          // Prefer app metadata first
          role = appMeta?.role || meta?.role || meta?.account_type || null;
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
      const hasPaidLevelCredits = (() => {
        const creditCandidates = [
          typeof remainingCredits === 'number' ? remainingCredits : null,
          typeof monthlyCredits === 'number' ? monthlyCredits : null,
          typeof data?.remaining_credits === 'number' ? data.remaining_credits : null,
          typeof data?.monthly_credits === 'number' ? data.monthly_credits : null
        ].filter((v): v is number => typeof v === 'number');
        const maxCredits = creditCandidates.length ? Math.max(...creditCandidates) : 0;
        return maxCredits >= 300; // ≥ member baseline (350) ⇒ paid teammate
      })();
      // Elevate admin-like roles to a non-free plan label to avoid free gating banners
      const isAdminRole = ['super_admin','admin','team_admin','team_admins'].includes(roleLc);
      // Treat guest as free for gating purposes unless a paid plan is explicitly set
      let resolvedPlan = planServer || ((roleLc==='free' || roleLc==='guest' || (remainingCredits===50)) ? 'free' : null);
      if (isAdminRole && (!resolvedPlan || resolvedPlan === 'free')) {
        resolvedPlan = 'admin';
      }
      if (!isAdminRole && roleLc === 'member' && hasPaidLevelCredits && (!resolvedPlan || resolvedPlan === 'free')) {
        resolvedPlan = 'member';
      }

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

  // Refetch on auth changes to keep role/plan perfectly in sync
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      // Lightweight debounce to avoid double fetches on rapid state changes
      const t = setTimeout(() => { fetchPlan(); }, 50);
      (globalThis as any).__hp_plan_refetch_timer = t;
    });
    return () => {
      try {
        const stored = (globalThis as any).__hp_plan_refetch_timer;
        if (stored) clearTimeout(stored);
      } catch {}
      try { sub.subscription?.unsubscribe?.(); } catch {}
    };
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


