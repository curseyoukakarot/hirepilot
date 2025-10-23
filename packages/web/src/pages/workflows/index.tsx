import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type LibraryItem = {
  id: string;
  title: string;
  description: string;
  trigger?: string;
  actions?: { endpoint: string }[];
};

type UserWorkflow = {
  id: string;
  name: string;
  status?: string;
  is_active?: boolean;
  last_tested_at?: string | null;
};

export default function WorkflowsIndexPage() {
  const [tab, setTab] = useState<'library' | 'mine'>('library');
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [mine, setMine] = useState<UserWorkflow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [libRes, myRes] = await Promise.all([
          fetch('/api/workflows'),
          fetch('/api/workflows/user'),
        ]);
        if (!active) return;
        const lib = libRes.ok ? await libRes.json() : { items: [] };
        const mineData = myRes.ok ? await myRes.json() : { items: [] };
        setLibrary(lib.items || []);
        setMine(mineData.items || []);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchAll();
    return () => { active = false; };
  }, []);

  const testWorkflow = async (wf: { trigger?: string; actions?: any[]; id?: string }) => {
    const res = await fetch('/api/workflows/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_endpoint: wf.trigger || '/api/events/candidate_hired', action_endpoint: wf.actions?.[0]?.endpoint || '/api/actions/slack_notification' }),
    });
    if (res.ok) alert('Test OK'); else alert('Test failed');
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const res = await fetch('/api/workflows/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active }),
    });
    if (res.ok) {
      setMine((prev) => prev.map((m) => (m.id === id ? { ...m, is_active } : m)));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Workflows</h1>
        <Link href="/sandbox" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Open Sandbox</Link>
      </div>

      <div className="flex gap-2 border-b border-slate-200 mb-6">
        <button onClick={() => setTab('library')} className={`px-4 py-2 ${tab==='library' ? 'border-b-2 border-indigo-600 font-semibold' : 'text-slate-500'}`}>Library</button>
        <button onClick={() => setTab('mine')} className={`px-4 py-2 ${tab==='mine' ? 'border-b-2 border-indigo-600 font-semibold' : 'text-slate-500'}`}>My Workflows</button>
      </div>

      {tab === 'library' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(loading && library.length===0) && Array.from({length:6}).map((_,i)=>(
            <div key={i} className="rounded-xl border border-slate-200 p-5 bg-white animate-pulse h-40" />
          ))}
          {library.map((wf) => (
            <div key={wf.id} className="rounded-xl border border-slate-200 p-5 bg-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{wf.title}</h3>
                <span className="text-xs px-2 py-1 rounded bg-slate-100">Library</span>
              </div>
              <p className="text-sm text-slate-600 mb-3">{wf.description}</p>
              <div className="text-xs text-slate-500 space-y-1 mb-3">
                {wf.trigger && <div><strong>Trigger:</strong> {wf.trigger}</div>}
                {wf.actions && <div><strong>Actions:</strong> {(wf.actions||[]).map(a=>a.endpoint).join(', ')}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => alert(JSON.stringify(wf, null, 2))} className="px-3 py-2 text-sm rounded bg-slate-100">Preview JSON</button>
                <Link href={`/sandbox?workflowId=${wf.id}`} className="px-3 py-2 text-sm rounded bg-indigo-600 text-white">Customize in Sandbox</Link>
                <button onClick={() => testWorkflow(wf)} className="px-3 py-2 text-sm rounded bg-blue-600 text-white">Test API</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'mine' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Tested</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-2 ${m.status==='ok' ? 'text-green-600' : 'text-slate-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${m.status==='ok' ? 'bg-green-400 animate-pulse' : 'bg-slate-300'}`}></span>
                      {m.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{m.last_tested_at ? new Date(m.last_tested_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={!!m.is_active} onChange={(e) => toggleActive(m.id, e.currentTarget.checked)} />
                      <span className={`w-10 h-6 flex items-center bg-slate-200 rounded-full p-1 ${m.is_active ? 'bg-green-500' : ''}`}>
                        <span className={`bg-white w-4 h-4 rounded-full transform transition ${m.is_active ? 'translate-x-4' : ''}`}></span>
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/sandbox?workflowId=${m.id}`} className="px-3 py-1.5 text-sm rounded bg-slate-100">Edit</Link>
                      <button onClick={() => testWorkflow({})} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">Test API</button>
                    </div>
                  </td>
                </tr>
              ))}
              {mine.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No workflows yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


