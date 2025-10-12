import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function CandidatePreviewCard({ data, onChange }) {
  const handle = (key, val) => onChange({ ...data, [key]: val });
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Name</label>
          <input className="w-full border rounded px-3 py-2" value={data.name || ''} onChange={e => handle('name', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Title</label>
          <input className="w-full border rounded px-3 py-2" value={data.title || ''} onChange={e => handle('title', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Email</label>
          <input className="w-full border rounded px-3 py-2" value={data.email || ''} onChange={e => handle('email', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Phone</label>
          <input className="w-full border rounded px-3 py-2" value={data.phone || ''} onChange={e => handle('phone', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">LinkedIn</label>
          <input className="w-full border rounded px-3 py-2" value={data.linkedin || ''} onChange={e => handle('linkedin', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Skills / Tech (comma separated)</label>
          <input className="w-full border rounded px-3 py-2" value={(data.skills || data.tech || []).join(', ')} onChange={e => {
            const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            onChange({ ...data, skills: arr, tech: arr });
          }} />
        </div>
      </div>
      {Array.isArray(data.experiences) && data.experiences.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">Experience</div>
          <ul className="list-disc ml-5 text-sm text-gray-700">
            {data.experiences.slice(0, 5).map((e, idx) => (
              <li key={idx}>{[e.title, e.company].filter(Boolean).join(' @ ')}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ResumeWizard({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]); // [{ file, status, parsed, ingesting, fileUrl, candidateId }]
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  // NOP build bump + runtime visibility of backend url used for uploads/parse/ingest
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info('ResumeWizard build', {
      date: '2025-10-12T04:50Z',
      backend: import.meta.env.VITE_BACKEND_URL
    });
  }, []);

  const canProceed = useMemo(() => {
    if (step === 1) return files.length > 0;
    if (step === 2) return items.every(x => x.parsed);
    if (step === 3) return items.length > 0;
    return true;
  }, [step, files, items]);

  if (!open) return null;

  const onPick = (e) => {
    const fl = Array.from(e.target.files || []);
    if (fl.length) setFiles(fl);
  };

  const uploadToStorage = async (file, userId) => {
    const form = new FormData();
    form.append('file', file, file.name);
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes?.session?.access_token;
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form
    });
    if (!resp.ok) throw new Error('upload_failed');
    const js = await resp.json();
    return js.publicUrl || null;
  };

  const parseAll = async () => {
    setBusy(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const userId = sessionRes?.session?.user?.id;
      const token = sessionRes?.session?.access_token;
      // Best-effort ensure bucket exists (ignore errors)
      try { await supabase.storage.getBucket('uploads'); } catch {}
      const out = [];
      for (const file of files) {
        // Upload file first to storage (public URL for linking in drawer)
        let fileUrl = null;
        try { if (userId) fileUrl = await uploadToStorage(file, userId); } catch {}
        const text = await file.text();
        const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/parse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text })
        });
        const json = await resp.json();
        out.push({ file, status: 'parsed', parsed: json.parsed, fileUrl });
      }
      setItems(out);
      setStep(3);
    } catch (e) {
      console.error('parseAll error', e);
    } finally {
      setBusy(false);
    }
  };

  const updateItem = (idx, patch) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const ingestAll = async () => {
    setBusy(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        updateItem(i, { ingesting: true });
        const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/candidates/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ parsed: it.parsed, fileUrl: it.fileUrl })
        });
        const json = await resp.json();
        updateItem(i, { ingesting: false, candidateId: json.candidateId, status: 'ingested' });
      }
      setStep(4);
    } catch (e) {
      console.error('ingestAll error', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={() => !busy && onClose && onClose()} />
      <div className="relative bg-white w-full max-w-5xl rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-semibold">Resume Wizard</div>
          <button className="text-gray-500 hover:text-gray-700" onClick={() => !busy && onClose && onClose()}>Close</button>
        </div>

        <div className="mb-6 flex items-center gap-3 text-sm">
          <div className={`px-2 py-1 rounded ${step>=1?'bg-blue-600 text-white':'bg-gray-200'}`}>Upload</div>
          <div className="text-gray-400">→</div>
          <div className={`px-2 py-1 rounded ${step>=2?'bg-blue-600 text-white':'bg-gray-200'}`}>Parsing</div>
          <div className="text-gray-400">→</div>
          <div className={`px-2 py-1 rounded ${step>=3?'bg-blue-600 text-white':'bg-gray-200'}`}>Preview & Map</div>
          <div className="text-gray-400">→</div>
          <div className={`px-2 py-1 rounded ${step>=4?'bg-blue-600 text-white':'bg-gray-200'}`}>Complete</div>
        </div>

        {step === 1 && (
          <div>
            <div className="border-2 border-dashed rounded-lg p-8 text-center bg-gray-50">
              <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" multiple onChange={onPick} className="hidden" />
              <div className="text-gray-600 mb-3">Drag and drop resumes here or</div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={() => inputRef.current?.click()}>Choose Files</button>
              {!!files.length && (
                <div className="mt-4 text-sm text-gray-700">{files.length} file(s) selected</div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button disabled={!canProceed || busy} onClick={() => { setStep(2); parseAll(); }} className={`px-5 py-2 rounded ${canProceed && !busy ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{busy ? 'Parsing…' : 'Start Parsing'}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[55vh] overflow-auto pr-1">
              {items.map((it, idx) => (
                <CandidatePreviewCard key={idx} data={it.parsed} onChange={(v) => updateItem(idx, { parsed: v })} />
              ))}
            </div>
            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-gray-500">Ready to create {items.length} candidate(s). You can edit fields before ingest.</div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded bg-gray-100">Back</button>
                <button disabled={!canProceed || busy} onClick={ingestAll} className={`px-5 py-2 rounded ${canProceed && !busy ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{busy ? 'Creating…' : 'Create Candidates'}</button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-10">
            <div className="text-2xl font-semibold mb-2">All done!</div>
            <div className="text-gray-600 mb-6">Successfully created {items.filter(i=>i.candidateId).length} candidate(s).</div>
            <div className="flex justify-center gap-3">
              <button className="px-4 py-2 rounded bg-gray-100" onClick={() => { setStep(1); setFiles([]); setItems([]); }}>Process More</button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => onClose && onClose()}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


