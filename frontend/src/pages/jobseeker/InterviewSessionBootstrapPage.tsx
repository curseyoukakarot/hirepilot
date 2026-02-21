import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { INTERVIEW_SEED_QUESTION } from '../../constants/interview';
import { supabase } from '../../lib/supabaseClient';

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')
    ? 'https://api.thehirepilot.com'
    : 'http://localhost:8080');

export default function InterviewSessionBootstrapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const hasBootedRef = useRef(false);

  const storageKey = 'interview_helper_bootstrap_key';
  const getIdempotencyKey = (prepPackId: string) => {
    const now = Date.now();
    const raw = sessionStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { key: string; createdAt: number; prepPackId: string };
        if (
          parsed?.key &&
          typeof parsed.createdAt === 'number' &&
          now - parsed.createdAt < 2 * 60 * 1000 &&
          String(parsed.prepPackId || '') === prepPackId
        ) {
          return parsed.key;
        }
      } catch {
        // no-op
      }
    }
    const key =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        key,
        createdAt: now,
        prepPackId,
      })
    );
    return key;
  };

  useEffect(() => {
    if (hasBootedRef.current) return;
    hasBootedRef.current = true;
    const boot = async () => {
      setIsCreating(true);
      const params = new URLSearchParams(location.search);
      const prepPackId = params.get('prepPackId') || '';
      await supabase.auth.getSession().catch(() => null);
      const idempotencyKey = getIdempotencyKey(prepPackId);
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        credentials: 'include',
        body: JSON.stringify({
          role_title: 'Senior Product Manager',
          company: 'Spotify',
          level: 'senior',
          mode: 'supportive',
          prep_pack_id: prepPackId || null,
        }),
      }).catch(() => null);
      if (!response?.ok) {
        setIsCreating(false);
        navigate('/interview-helper', { replace: true });
        return;
      }
      const payload = await response.json().catch(() => null);
      const sessionId = String(payload?.sessionId || '');
      if (!sessionId) {
        setIsCreating(false);
        navigate('/interview-helper', { replace: true });
        return;
      }

      await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions/${encodeURIComponent(sessionId)}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          turn_index: 1,
          speaker: 'rex',
          question_text: INTERVIEW_SEED_QUESTION,
        }),
      }).catch(() => undefined);

      sessionStorage.removeItem(storageKey);
      navigate(`/interview-helper/session/${sessionId}${location.search || ''}`, { replace: true });
    };
    void boot();
  }, [location.search, navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-[#0b0f14] text-gray-300">
      {isCreating ? 'Starting session...' : 'Preparing session...'}
    </div>
  );
}
