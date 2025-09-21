import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function OpportunityDetail() {
  const { id } = useParams();
  const [opp, setOpp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = resp.ok ? await resp.json() : null;
      setOpp(js);
      setNotes(js?.notes || '');
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

  if (loading) return <div className="p-6">Loading…</div>;
  if (!opp) return <div className="p-6">Not found</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{opp.title}</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Client: {opp.client_id?.slice(0,8)}</span>
              <span>Owner: {opp.owner_id?.slice(0,8)}</span>
            </div>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">{opp.stage || 'Open'}</span>
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
            <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">Linked Job Reqs</h3><button className="text-sm text-blue-600">Attach REQ</button></div>
            <div className="text-sm text-gray-600">{(opp.req_ids||[]).length ? (opp.req_ids||[]).join(', ') : 'No linked REQs'}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-3">Activity Log</h3>
            <div className="text-sm text-gray-600">Coming soon…</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">Assigned Team</h3><button className="text-sm text-blue-600">Add</button></div>
            <div className="text-sm text-gray-600">Owner: {opp.owner_id?.slice(0,8)}</div>
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


