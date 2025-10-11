import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function OpportunityDetail() {
  const { id } = useParams();
  const [opp, setOpp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [activity, setActivity] = useState<any[]>([]);
  const [newActivity, setNewActivity] = useState('');
  const [newActType, setNewActType] = useState<'call'|'email'|'meeting'|'note'|'task'|'update'>('note');
  const [collabs, setCollabs] = useState<any[]>([]);
  const [newCollab, setNewCollab] = useState('');
  const [newReqId, setNewReqId] = useState('');
  const [availableReqs, setAvailableReqs] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = resp.ok ? await resp.json() : null;
      setOpp(js);
      setNotes(js?.notes || '');
      // load activity via unified deals activity
      try {
        const actRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/deals/activity?entityType=opportunity&entityId=${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const js = actRes.ok ? await actRes.json() : { rows: [] };
        setActivity(js.rows || []);
      } catch {}
      try {
        const cRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}/collaborators`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setCollabs(cRes.ok ? await cRes.json() : []);
      } catch {}
      try {
        const rRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}/available-reqs`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setAvailableReqs(rRes.ok ? await rRes.json() : []);
      } catch {}
      try {
        const uRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}/available-users`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setAvailableUsers(uRes.ok ? await uRes.json() : []);
      } catch {}
      setLoading(false);
    };
    run();
  }, [id]);

  const saveNotes = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ notes })
    });
  };

  const addActivity = async () => {
    if (!newActivity.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const payload = {
      links: [{ entityType: 'opportunity', entityId: String(id) }],
      type: newActType,
      title: undefined,
      body: newActivity.trim(),
      occurredAt: new Date().toISOString()
    };
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/deals/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      // refresh
      const actRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/deals/activity?entityType=opportunity&entityId=${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = actRes.ok ? await actRes.json() : { rows: [] };
      setActivity(js.rows || []);
      setNewActivity('');
    }
  };

  const addCollaborator = async () => {
    if (!newCollab.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email: newCollab.trim() })
    });
    if (resp.ok) {
      const row = await resp.json();
      setCollabs((c:any[]) => [row, ...c]);
      setNewCollab('');
    }
  };

  const attachReq = async () => {
    const idStr = newReqId.trim();
    if (!idStr) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const reqIds = Array.from(new Set([...(opp?.req_ids || []), idStr]));
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ req_ids: reqIds })
    });
    if (resp.ok) {
      setOpp((o:any) => ({ ...o, req_ids: reqIds }));
      setNewReqId('');
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!opp) return <div className="p-6">Not found</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{opp.title}</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Client: {opp.client?.name || opp.client?.domain || opp.client_id?.slice(0,8)}</span>
              <span>Owner: {opp.owner?.name || opp.owner?.email || opp.owner_id?.slice(0,8)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">{opp.stage || 'Open'}</span>
            <select className="border rounded px-2 py-1 text-sm" value={opp.stage || 'Pipeline'} onChange={async e=>{
              const newStage = e.target.value;
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}`, { method:'PATCH', headers: { 'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ stage: newStage }) });
              setOpp((o:any)=>({ ...o, stage: newStage }));
            }}>
              {['Pipeline','Best Case','Commit','Close Won','Closed Lost'].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Stage</div><div className="text-sm font-semibold">{opp.stage || '—'}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Value</div><div className="text-sm font-semibold">{(Number(opp.value)||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Created</div><div className="text-sm font-semibold">{opp.created_at ? new Date(opp.created_at).toLocaleDateString() : '—'}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Billing</div><div className="text-sm font-semibold">{opp.billing_type || '—'}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">Description</h3></div>
            <textarea className="w-full p-3 border rounded-lg resize-none" rows={4} value={notes} onChange={e=>setNotes(e.target.value)} />
            <div className="mt-3 text-right"><button className="px-3 py-1.5 bg-gray-900 text-white rounded" onClick={saveNotes}>Save</button></div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Linked Job Reqs</h3>
              <div className="flex items-center gap-2">
                <select className="border rounded px-2 py-1 text-sm" value={newReqId} onChange={e=>setNewReqId(e.target.value)}>
                  <option value="">Select job req…</option>
                  {availableReqs.map((r:any)=> (<option key={r.id} value={r.id}>{r.title}</option>))}
                </select>
                <button className="text-sm text-blue-600" onClick={attachReq}>Attach REQ</button>
              </div>
            </div>
            <div className="text-sm text-gray-600">{(opp.req_ids||[]).length ? (opp.req_ids||[]).join(', ') : 'No linked REQs'}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-3">Activity Log</h3>
            <div className="space-y-3 mb-3">
              {activity.map((a:any)=> (
                <div key={a.id} className="bg-gray-50 rounded p-2 text-sm text-gray-800">
                  <div className="font-medium text-gray-900 capitalize">{a.type || 'note'}</div>
                  <div>{a.body || a.title || ''}</div>
                  <div className="text-xs text-gray-400">{a.occurred_at ? new Date(a.occurred_at).toLocaleString() : ''}</div>
                </div>
              ))}
              {activity.length===0 && <div className="text-sm text-gray-500">No activity yet</div>}
            </div>
            <div className="flex gap-2 items-center">
              <select className="border rounded px-2 py-2 text-sm" value={newActType} onChange={e=>setNewActType(e.target.value as any)}>
                {['call','email','meeting','note','task','update'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Add activity details…" value={newActivity} onChange={e=>setNewActivity(e.target.value)} />
              <button className="px-3 py-2 bg-gray-900 text-white rounded" onClick={addActivity}>Log</button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Assigned Team</h3>
              <div className="flex items-center gap-2">
                <select className="border rounded px-2 py-1 text-sm" value={newCollab} onChange={e=>setNewCollab(e.target.value)}>
                  <option value="">Select teammate…</option>
                  {availableUsers.map((u:any)=> (<option key={u.id} value={u.email}>{u.name}</option>))}
                </select>
                <button className="text-sm text-blue-600" onClick={addCollaborator}>Add</button>
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-2">Owner: {opp.owner?.name || opp.owner?.email || opp.owner_id?.slice(0,8)}</div>
            <div className="space-y-1 text-sm">
              {collabs.map((c:any)=> (<div key={c.id} className="text-gray-800">{c.email} <span className="text-gray-400">({c.role||'collaborator'})</span></div>))}
              {collabs.length===0 && <div className="text-gray-500">No collaborators yet</div>}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-3">Internal Notes</h3>
            <div className="text-sm text-gray-600">Add comments & tag teammates (TBD).</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-3">REX Insights</h3>
            <div className="text-sm text-gray-600">Guidance coming from REX.</div>
          </div>
        </div>
      </div>
    </div>
  );
}


