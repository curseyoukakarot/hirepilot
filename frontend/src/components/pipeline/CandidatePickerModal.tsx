import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface PickerCandidate {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface CandidatePickerModalProps {
  open: boolean;
  jobId: string;
  onClose: () => void;
  onSelect: (candidate: PickerCandidate) => Promise<void> | void;
}

const getAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;

export default function CandidatePickerModal({ open, jobId, onClose, onSelect }: CandidatePickerModalProps) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<PickerCandidate[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      if (!open) return;
      setLoading(true);
      try {
        // Load all candidates and remove those already linked to this job
        const { data: allCandidates } = await supabase
          .from('candidates')
          .select('id, first_name, last_name, email, avatar_url');
        let list = allCandidates || [];
        if (jobId) {
          const { data: jobCandidates } = await supabase
            .from('candidate_jobs')
            .select('candidate_id')
            .eq('job_id', jobId);
          const used = new Set((jobCandidates || []).map((r) => r.candidate_id));
          list = list.filter((c) => !used.has(c.id));
        }
        setCandidates(list as PickerCandidate[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, jobId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [query, candidates]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Add Candidate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidates..."
            className="w-full px-3 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center text-gray-500 py-6">Loading candidates…</div>
            ) : filtered.length ? (
              filtered.map((c) => {
                const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Candidate';
                const avatar = c.avatar_url || getAvatarUrl(name);
                return (
                  <button
                    key={c.id}
                    onClick={async () => { await onSelect(c); onClose(); }}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg mb-2 text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="overflow-hidden">
                      <div className="font-medium text-gray-900 truncate">{name}</div>
                      <div className="text-sm text-gray-500 truncate">{c.email}</div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center text-gray-500 py-6">No candidates found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


