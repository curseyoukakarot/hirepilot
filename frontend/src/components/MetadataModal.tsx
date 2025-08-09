import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type MetadataModalProps = {
  isOpen: boolean;
  onClose: () => void;
  entity: 'lead' | 'candidate';
  leadId?: string;
  candidateId?: string;
};

type Metadata = {
  user_id?: string;
  lead_id?: string | null;
  candidate_id?: string | null;
  candidate_job_ids?: string[];
  job_ids?: string[]; // alias of candidate_job_ids for clarity
  pipeline_ids?: string[];
  recent_campaign_ids?: string[];
};

const Row: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      // eslint-disable-next-line no-alert
      window.alert('Copied');
    } catch {}
  };
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600 mr-3">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-gray-800 break-all max-w-[320px]">{value || '—'}</span>
        {value ? (
          <button onClick={copy} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Copy</button>
        ) : null}
      </div>
    </div>
  );
};

export default function MetadataModal({ isOpen, onClose, entity, leadId, candidateId }: MetadataModalProps) {
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<Metadata>({});
  const [error, setError] = useState<string | null>(null);

  const jsonText = useMemo(() => JSON.stringify(meta, null, 2), [meta]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    (async () => {
      setLoading(true);
      try {
        const metaOut: Metadata = {
          lead_id: leadId || null,
          candidate_id: candidateId || null,
          candidate_job_ids: [],
          job_ids: [],
          pipeline_ids: [],
          recent_campaign_ids: [],
        };

        // Current user id
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) metaOut.user_id = userData.user.id;

        // If we only have lead, resolve candidate via lead_id
        if (entity === 'lead' && leadId && !candidateId) {
          const { data, error } = await supabase
            .from('candidates')
            .select('id')
            .eq('lead_id', leadId)
            .limit(1)
            .maybeSingle();
          if (!error && data?.id) metaOut.candidate_id = data.id;
        }

        // If we only have candidate, resolve lead via candidate
        if (entity === 'candidate' && candidateId && !leadId) {
          const { data, error } = await supabase
            .from('candidates')
            .select('lead_id')
            .eq('id', candidateId)
            .limit(1)
            .maybeSingle();
          if (!error && data) metaOut.lead_id = data.lead_id || null;
        }

        const resolvedCandidateId = metaOut.candidate_id || candidateId || null;

        // candidate_jobs → job_id
        if (resolvedCandidateId) {
          const { data: cjRows } = await supabase
            .from('candidate_jobs')
            .select('id, job_id')
            .eq('candidate_id', resolvedCandidateId);
          const jobIds = (cjRows || []).map((r) => r.job_id).filter(Boolean);
          const cjIds = (cjRows || []).map((r) => r.id).filter(Boolean);
          metaOut.job_ids = jobIds;
          metaOut.candidate_job_ids = cjIds;

          if (jobIds.length > 0) {
            const { data: jobs } = await supabase
              .from('job_requisitions')
              .select('id, pipeline_id')
              .in('id', jobIds);
            const pipelineIds = (jobs || []).map((j) => j.pipeline_id).filter(Boolean);
            metaOut.pipeline_ids = pipelineIds as string[];
          }
        }

        // Recent campaigns for the user (last 5)
        if (metaOut.user_id) {
          const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id')
            .eq('user_id', metaOut.user_id)
            .order('created_at', { ascending: false })
            .limit(5);
          metaOut.recent_campaign_ids = (campaigns || []).map((c) => c.id);
        }

        setMeta(metaOut);
      } catch (e: any) {
        setError(e?.message || 'Failed to load metadata');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, entity, leadId, candidateId]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      // eslint-disable-next-line no-alert
      window.alert('JSON copied');
    } catch {}
  };

  const copyCurlMoveCandidate = async () => {
    const cid = meta.candidate_id || '<candidate_id>';
    const jobId = meta.job_ids?.[0] || '<job_id>';
    const backend = import.meta.env.VITE_BACKEND_URL || 'https://api.thehirepilot.com';
    const curl = `curl -X POST "${backend}/api/zapier/move-candidate" \
-H 'Content-Type: application/json' \
-H 'x-api-key: <YOUR_API_KEY>' \
-d '{"candidate_id":"${cid}","job_id":"${jobId}","stage_title":"Interviewing"}'`;
    try {
      await navigator.clipboard.writeText(curl);
      // eslint-disable-next-line no-alert
      window.alert('cURL copied');
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Developer Metadata</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="space-y-2">
            <Row label="User ID" value={meta.user_id || null} />
            <Row label="Lead ID" value={meta.lead_id || null} />
            <Row label="Candidate ID" value={meta.candidate_id || null} />
            {/* Compact group for arrays; show first + count */}
            <Row label="Job Requisition ID" value={meta.job_ids?.[0] || null} />
            {meta.job_ids && meta.job_ids.length > 1 ? (
              <div className="text-xs text-gray-500 pl-2">+{meta.job_ids.length - 1} more jobs</div>
            ) : null}
            <Row label="Pipeline ID" value={meta.pipeline_ids?.[0] || null} />
            {meta.pipeline_ids && meta.pipeline_ids.length > 1 ? (
              <div className="text-xs text-gray-500 pl-2">+{meta.pipeline_ids.length - 1} more pipelines</div>
            ) : null}
            <Row label="Recent Campaign ID" value={meta.recent_campaign_ids?.[0] || null} />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button onClick={copyJson} className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">Copy JSON</button>
          <button onClick={copyCurlMoveCandidate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm">Copy cURL (move-candidate)</button>
        </div>
      </div>
    </div>
  );
}

