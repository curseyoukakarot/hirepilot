import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function SequenceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [seq, setSeq] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = (await window?.supabase?.auth?.getSession?.())?.data?.session?.access_token;
      const [seqRes, enrRes] = await Promise.all([
        fetch(`${API_BASE_URL}/sequences/${id}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: 'include' }),
        fetch(`${API_BASE_URL}/sequences/${id}/enrollments`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: 'include' })
      ]);
      if (seqRes.ok) setSeq(await seqRes.json());
      if (enrRes.ok) {
        const data = await enrRes.json();
        setEnrollments(data.enrollments || []);
        setMetrics(data.metrics || null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button className="text-sm text-gray-600 hover:text-gray-800" onClick={()=>navigate('/messages')}>← Back</button>
        <h1 className="text-2xl font-semibold">Sequence Detail</h1>
        <div />
      </div>
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : !seq ? (
        <div className="text-gray-500">Not found</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-semibold">{seq.sequence?.name || seq.name}</div>
                <div className="text-sm text-gray-600">{seq.sequence?.description || seq.description}</div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${seq.sequence?.is_archived || seq.is_archived ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'}`}>{(seq.sequence?.is_archived || seq.is_archived) ? 'Archived' : 'Active'}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-gray-700">
              <div>
                <div><span className="text-gray-500">Stop on reply:</span> {(seq.sequence?.stop_on_reply ?? seq.stop_on_reply) ? 'Yes' : 'No'}</div>
                <div><span className="text-gray-500">Window:</span> {(seq.sequence?.send_window_start || seq.send_window_start) || '—'} - {(seq.sequence?.send_window_end || seq.send_window_end) || '—'}</div>
              </div>
              <div>
                <div><span className="text-gray-500">Throttle/hr:</span> {(seq.sequence?.throttle_per_hour ?? seq.throttle_per_hour) || '—'}</div>
                <div><span className="text-gray-500">Steps:</span> {(seq.steps || []).length}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Enrolled</div>
              <div className="text-2xl font-semibold">{metrics?.enrolled ?? '—'}</div>
            </div>
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Sent</div>
              <div className="text-2xl font-semibold">{metrics?.sent ?? '—'}</div>
            </div>
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Replies</div>
              <div className="text-2xl font-semibold">{metrics?.replies ?? '—'}</div>
            </div>
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Bounced</div>
              <div className="text-2xl font-semibold">{metrics?.bounced ?? '—'}</div>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <div className="text-lg font-semibold mb-2">Enrollments</div>
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Step</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Sent</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Next ETA</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {enrollments.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No enrollments yet</td></tr>
                ) : enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 text-sm text-gray-700">{e.lead_name || e.lead_email || e.lead_id}</td>
                    <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">{e.status}</span></td>
                    <td className="px-4 py-2 text-sm">{e.current_step_order}</td>
                    <td className="px-4 py-2 text-sm">{e.last_sent_at ? new Date(e.last_sent_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-sm">{e.next_send_at ? new Date(e.next_send_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-sm text-right space-x-2">
                      {e.status === 'active' && (
                        <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={async()=>{
                          const token = (await window?.supabase?.auth?.getSession?.())?.data?.session?.access_token; 
                          await fetch(`${API_BASE_URL}/enrollments/${e.id}/pause`, { method:'POST', headers:{ ...(token?{Authorization:`Bearer ${token}`}:{}) }, credentials:'include' }); load();
                        }}>Pause</button>
                      )}
                      {e.status === 'paused' && (
                        <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={async()=>{
                          const token = (await window?.supabase?.auth?.getSession?.())?.data?.session?.access_token; 
                          await fetch(`${API_BASE_URL}/enrollments/${e.id}/resume`, { method:'POST', headers:{ ...(token?{Authorization:`Bearer ${token}`}:{}) }, credentials:'include' }); load();
                        }}>Resume</button>
                      )}
                      {['active','paused'].includes(e.status) && (
                        <button className="px-3 py-1 border rounded hover:bg-red-50 text-red-600 border-red-300" onClick={async()=>{
                          const token = (await window?.supabase?.auth?.getSession?.())?.data?.session?.access_token; 
                          await fetch(`${API_BASE_URL}/enrollments/${e.id}/cancel`, { method:'POST', headers:{ ...(token?{Authorization:`Bearer ${token}`}:{}) }, credentials:'include' }); load();
                        }}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


