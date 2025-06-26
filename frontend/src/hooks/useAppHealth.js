import { useState, useEffect, useCallback } from 'react';

export default function useAppHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${base}/api/health/overview`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Health fetch error', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  return { data, loading, refresh: fetchHealth };
} 