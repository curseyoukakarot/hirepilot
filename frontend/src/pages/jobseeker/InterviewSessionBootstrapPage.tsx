import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { INTERVIEW_SEED_QUESTION } from '../../constants/interview';

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')
    ? 'https://api.thehirepilot.com'
    : 'http://localhost:8080');

export default function InterviewSessionBootstrapPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const boot = async () => {
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role_title: 'Senior Product Manager',
          company: 'Spotify',
          level: 'senior',
          mode: 'supportive',
        }),
      }).catch(() => null);
      if (!response?.ok) {
        navigate('/interview-helper', { replace: true });
        return;
      }
      const payload = await response.json().catch(() => null);
      const sessionId = String(payload?.sessionId || '');
      if (!sessionId) {
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

      navigate(`/interview-helper/session/${sessionId}${location.search || ''}`, { replace: true });
    };
    void boot();
  }, [location.search, navigate]);

  return <div className="h-screen flex items-center justify-center bg-[#0b0f14] text-gray-300">Starting session...</div>;
}
