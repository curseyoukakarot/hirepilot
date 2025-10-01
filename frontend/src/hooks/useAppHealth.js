import { useState, useEffect, useCallback } from 'react';

export default function useAppHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${base}/api/health/overview`);
      const json = await res.json();
      setData(json);
      // fetch auth health in parallel (non-blocking)
      try {
        const ah = await fetch(`${base}/api/health/auth`).then(r => r.json());
        setAuth(ah);
      } catch {}
    } catch (e) {
      console.error('Health fetch error', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  return { data, auth, loading, refresh: fetchHealth };
} 