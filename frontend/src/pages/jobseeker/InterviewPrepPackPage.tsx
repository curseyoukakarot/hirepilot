import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')
    ? 'https://api.thehirepilot.com'
    : 'http://localhost:8080');

type PrepPackPayload = {
  prepPack: {
    id: string;
    overall_score: {
      out_of_10?: number;
      dimensions?: Record<string, number>;
      evidence_quotes?: string[];
    };
    strengths: any[];
    focus_areas: any[];
    best_answers: any[];
    practice_plan: any[];
  };
  session: {
    role_title: string;
    company: string | null;
    level: string | null;
  };
};

export default function InterviewPrepPackPage() {
  const { id } = useParams();
  const [data, setData] = useState<PrepPackPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/prep/${encodeURIComponent(id)}`, {
        credentials: 'include',
      }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json().catch(() => null);
      if (payload) setData(payload as PrepPackPayload);
    };
    void load();
  }, [id]);

  if (!data) {
    return <div className="min-h-screen bg-[#0b0f14] text-gray-300 p-8">Loading prep pack...</div>;
  }

  const score = Number(data.prepPack.overall_score?.out_of_10 || 0);
  const dimensions = data.prepPack.overall_score?.dimensions || {};
  const evidenceQuotes = Array.isArray(data.prepPack.overall_score?.evidence_quotes)
    ? data.prepPack.overall_score.evidence_quotes
    : [];

  return (
    <div className="min-h-screen bg-[#0b0f14] text-gray-200 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h1 className="text-2xl font-semibold text-white">Interview Prep Pack</h1>
          <p className="text-sm text-gray-400 mt-1">
            {data.session.role_title}
            {data.session.company ? ` • ${data.session.company}` : ''}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Overall Score</h2>
            <div className="text-5xl font-bold text-blue-400">{score.toFixed(1)}<span className="text-lg text-gray-500">/10</span></div>
            <div className="mt-4 space-y-1 text-sm text-gray-300">
              {Object.entries(dimensions).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">{key}</span>
                  <span>{Number(value).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {evidenceQuotes.length ? (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Evidence Quotes</div>
                <div className="space-y-1 text-xs text-gray-300">
                  {evidenceQuotes.slice(0, 2).map((quote, idx) => (
                    <div key={`${quote}-${idx}`}>&ldquo;{quote}&rdquo;</div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Strengths</h2>
            <ul className="space-y-2 text-sm text-gray-300">
              {data.prepPack.strengths.map((item: any, index: number) => (
                <li key={`${item.title}-${index}`}>• {item.title || String(item)}</li>
              ))}
            </ul>
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mt-6 mb-3">Focus Areas</h2>
            <ul className="space-y-2 text-sm text-gray-300">
              {data.prepPack.focus_areas.map((item: any, index: number) => (
                <li key={`${item.title}-${index}`}>• {item.title || String(item)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Best Answers</h2>
          <div className="space-y-4">
            {data.prepPack.best_answers.map((item: any, index: number) => (
              <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-sm text-gray-300">{item.improved || item.answer}</p>
                <button
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300"
                  onClick={() => navigator.clipboard.writeText(String(item.improved || item.answer || ''))}
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Practice Plan</h2>
          <div className="space-y-2 text-sm text-gray-300">
            {data.prepPack.practice_plan.map((task: any, index: number) => (
              <div key={index}>Day {task.day || index + 1}: {task.task || String(task)}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
