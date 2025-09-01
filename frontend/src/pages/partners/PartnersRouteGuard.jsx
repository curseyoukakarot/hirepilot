import React, { useEffect, useState } from 'react';
import { partnersSupabase } from '../../lib/partnersSupabase';
import { Navigate } from 'react-router-dom';

export default function PartnersRouteGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await partnersSupabase.auth.getSession();
      // Ensure affiliate profile exists (idempotent upsert)
      if (session?.access_token) {
        try {
          await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/register`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            credentials: 'include'
          });
        } catch (e) {
          // best-effort only
          console.warn('Affiliate auto-register failed', e);
        }
        // Block access if affiliate is disabled
        try {
          const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/overview`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            credentials: 'include'
          });
          if (!resp.ok) {
            setAuthed(false);
            setLoading(false);
            return;
          }
        } catch {}
      }
      setAuthed(!!session);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!authed) return <Navigate to="/partners/login" replace />;
  return children;
}


