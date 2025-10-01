import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { usePlan } from '../context/PlanContext';

export default function AuthQuerySync() {
  const queryClient = useQueryClient();
  const { refresh } = usePlan();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      const evt = String(event || '').toUpperCase();
      // Invalidate cached user/plan/credits/settings queries on auth state changes
      queryClient.invalidateQueries({
        predicate: (q) => {
          try {
            const key = JSON.stringify(q.queryKey || []).toLowerCase();
            return key.includes('user')
              || key.includes('plan')
              || key.includes('credit')
              || key.includes('me')
              || key.includes('settings');
          } catch {
            return false;
          }
        }
      });

      // Ensure PlanContext is refreshed promptly
      if (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED' || evt === 'SIGNED_OUT') {
        // Give a tiny delay to allow session cookie sync to complete
        setTimeout(() => { refresh().catch(() => {}); }, 50);
      }
    });
    return () => { try { sub.subscription?.unsubscribe?.(); } catch {} };
  }, [queryClient, refresh]);

  return null;
}


