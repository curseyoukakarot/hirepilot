import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

export interface SubmitCandidatePayload {
  candidateIdOrName: string;
  email: string;
  phone: string;
  linkedin: string;
  title: string;
  salary: string;
  location: string;
  experience: string;
  impact: string;
  motivation: string;
  accolades: string;
  resume: string;
}

interface SubmitCandidateModalProps {
  open: boolean;
  jobId: string;
  onClose: () => void;
}

const isUuidLike = (v: string) => /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(v.trim());

export default function SubmitCandidateModal({ open, jobId, onClose }: SubmitCandidateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingId, setLoadingId] = useState(false);
  const [form, setForm] = useState<SubmitCandidatePayload>({
    candidateIdOrName: '',
    email: '',
    phone: '',
    linkedin: '',
    title: '',
    salary: '',
    location: '',
    experience: '',
    impact: '',
    motivation: '',
    accolades: '',
    resume: ''
  });

  useEffect(() => {
    if (!open) {
      setForm({
        candidateIdOrName: '', email: '', phone: '', linkedin: '', title: '', salary: '', location: '',
        experience: '', impact: '', motivation: '', accolades: '', resume: ''
      });
      setSubmitting(false);
      setLoadingId(false);
    }
  }, [open]);

  const BACKEND_URL = useMemo(() => (import.meta as any).env?.VITE_BACKEND_URL as string, []);

  async function tryAutofillById(id: string) {
    try {
      setLoadingId(true);
      // First, try backend for ownership-safe fetch
      const { data: { session } } = await supabase.auth.getSession();
      const headers: any = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      let record: any | null = null;
      try {
        const resp = await fetch(`${BACKEND_URL}/api/candidates/${encodeURIComponent(id)}`, { headers, credentials: 'include' });
        if (resp.ok) record = await resp.json();
      } catch {}
      if (!record) {
        const { data } = await supabase.from('candidates').select('*').eq('id', id).maybeSingle();
        record = data || null;
      }
      if (record) {
        setForm((prev) => ({
          ...prev,
          email: record.email || prev.email,
          phone: record.phone || prev.phone || '',
          linkedin: record.linkedin_url || prev.linkedin || '',
          title: record.title || record.current_title || prev.title || '',
          location: record.location || prev.location || '',
          resume: record.resume_url || prev.resume || '',
        }));
        toast.success('Candidate details loaded');
      } else {
        toast.error('Candidate not found');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load candidate');
    } finally {
      setLoadingId(false);
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async () => {
    try {
      if (!form.email && !form.candidateIdOrName) { toast.error('Email or Candidate ID/Name is required'); return; }
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const resp = await fetch(`${BACKEND_URL}/api/submitCandidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ jobId, ...form })
      });
      const js = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(js?.error || 'Submission failed');
      toast.success('Submitted to job owner');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <div className="text-xl font-semibold">Submit Candidate</div>
          <div className="text-sm text-gray-500">Add a new candidate to this job pipeline</div>
        </div>
        <div className="p-5">
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="text-sm font-medium">Candidate Name or ID</label>
            <div className="mt-1 flex gap-2">
              <input name="candidateIdOrName" value={form.candidateIdOrName} onChange={onChange} placeholder="Search candidate or enter ID..." className="flex-1 px-3 py-2 border rounded-lg" />
              <button
                type="button"
                className="px-3 py-2 border rounded-lg text-sm"
                onClick={() => form.candidateIdOrName && isUuidLike(form.candidateIdOrName) ? tryAutofillById(form.candidateIdOrName.trim()) : toast('Enter a Candidate ID to lookup')}
                disabled={loadingId}
              >{loadingId ? 'Loading…' : 'Lookup'}</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <input name="email" placeholder="candidate@email.com" value={form.email} onChange={onChange} className="px-3 py-2 border rounded-lg" />
            <input name="phone" placeholder="(555) 123-4567" value={form.phone} onChange={onChange} className="px-3 py-2 border rounded-lg" />
            <input name="linkedin" placeholder="https://linkedin.com/in/username" value={form.linkedin} onChange={onChange} className="px-3 py-2 border rounded-lg" />
            <input name="title" placeholder="Senior Backend Engineer" value={form.title} onChange={onChange} className="px-3 py-2 border rounded-lg" />
            <input name="salary" placeholder="$120,000 or $100/hr" value={form.salary} onChange={onChange} className="px-3 py-2 border rounded-lg" />
            <input name="location" placeholder="San Francisco, CA" value={form.location} onChange={onChange} className="px-3 py-2 border rounded-lg" />
            <input name="experience" placeholder="8" value={form.experience} onChange={onChange} className="px-3 py-2 border rounded-lg" />
          </div>

          <div className="mt-4 space-y-3">
            <textarea name="impact" placeholder="What was their biggest contribution in past roles?" value={form.impact} onChange={onChange} className="w-full px-3 py-2 border rounded-lg min-h-[80px]" />
            <textarea name="motivation" placeholder="What’s motivating this candidate to pursue this role?" value={form.motivation} onChange={onChange} className="w-full px-3 py-2 border rounded-lg min-h-[80px]" />
            <textarea name="accolades" placeholder="Awards, publications, recognitions, or other noteworthy wins." value={form.accolades} onChange={onChange} className="w-full px-3 py-2 border rounded-lg min-h-[80px]" />
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium">Resume</label>
            <input name="resume" placeholder="Paste a resume link (Dropbox, Google Drive, etc.)" value={form.resume} onChange={onChange} className="w-full mt-1 px-3 py-2 border rounded-lg" />
          </div>

          <div className="flex justify-end mt-6 gap-2">
            <button className="px-4 py-2 border rounded-lg" onClick={onClose} disabled={submitting}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50" onClick={onSubmit} disabled={submitting}>
              <span className="mr-1">🚀</span> {submitting ? 'Submitting…' : 'Submit to Hiring Manager'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


