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
      const sessionTitle = (
        params.get('sessionTitle') ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('interview_helper_session_title') : '') ||
        'Interview Practice Session'
      ).trim();
      const includeContext = params.get('includeContext') !== '0';
      const rexContext = (
        params.get('rexContext') ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('interview_helper_rex_context') : '') ||
        ''
      ).trim();
      const sessionResult = await supabase.auth.getSession().catch(() => null);
      const accessToken = sessionResult?.data?.session?.access_token || '';
      const idempotencyKey = getIdempotencyKey(prepPackId);
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          role_title: sessionTitle || 'Interview Practice Session',
          company: null,
          level: 'senior',
          mode: 'supportive',
          prep_pack_id: prepPackId || null,
          rex_context_instructions: includeContext ? rexContext || null : null,
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
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          turn_index: 1,
          speaker: 'rex',
          question_text: INTERVIEW_SEED_QUESTION,
        }),
      }).catch(() => undefined);

      sessionStorage.removeItem(storageKey);
      const debugSuffix = params.get('debug') === '1' ? '?debug=1' : '';
      navigate(`/interview-helper/session/${sessionId}${debugSuffix}`, { replace: true });
    };
    void boot();
  }, [location.search, navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-[#0b0f14] text-gray-300">
      {isCreating ? 'Starting session...' : 'Preparing session...'}
    </div>
  );
}
