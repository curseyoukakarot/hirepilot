import React, { useEffect, useState } from 'react';
import { partnersSupabase } from '../../lib/partnersSupabase';
import { Navigate } from 'react-router-dom';

export default function PartnersRouteGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await partnersSupabase.auth.getSession();
      setAuthed(!!session);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!authed) return <Navigate to="/partners/login" replace />;
  return children;
}


