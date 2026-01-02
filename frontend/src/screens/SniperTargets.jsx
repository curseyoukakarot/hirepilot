import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function SniperTargets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [postUrl, setPostUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/sniper/targets');
      setTargets(data?.targets || data || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load targets');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async (t) => {
    setSavingId(t.id);
    try {
      await apiPost(`/api/sniper/targets/${t.id}/run`, { limit: 200 });
      toast.success('Prospecting queued');
    } catch (e) {
      toast.error(e.message || 'Failed to queue run');
    }
    setSavingId(null);
  };

  const pause = async (t) => {
    setSavingId(t.id);
    try {
      await apiPost(`/api/sniper/targets/${t.id}/pause`);
      toast.success('Paused');
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to pause');
    } finally {
      setSavingId(null);
    }
  };

  const resume = async (t) => {
    setSavingId(t.id);
    try {
      await apiPost(`/api/sniper/targets/${t.id}/resume`);
      toast.success('Resumed');
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to resume');
    } finally {
      setSavingId(null);
    }
  };

  const createTarget = async () => {
    const url = postUrl.trim();
    if (!url) return toast.error('Paste a LinkedIn post URL');
    setCreating(true);
    try {
      await apiPost('/api/sniper/targets', { post_url: url, auto_run: true });
      toast.success('Target created');
      setPostUrl('');
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to create target');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Sniper Targets</h1>
        <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="text-sm font-medium mb-2">Create target (LinkedIn post likers/commenters)</div>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="https://www.linkedin.com/posts/..."
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
          />
          <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={createTarget} disabled={creating}>
            {creating ? 'Creating…' : 'Create + Run'}
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Post URL</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {targets.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 capitalize">{t.type || 'linkedin_post_engagement'}</td>
                  <td className="px-4 py-2 truncate max-w-xs">
                    {t.post_url || ''}
                  </td>
                  <td className="px-4 py-2">{t.status}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                        onClick={() => runNow(t)}
                        disabled={savingId === t.id || t.status !== 'active'}
                      >
                        Run now
                      </button>
                      {t.status === 'active' ? (
                        <button className="px-3 py-1 text-white bg-slate-700 rounded hover:bg-slate-800 disabled:opacity-50" onClick={() => pause(t)} disabled={savingId === t.id}>
                          Pause
                        </button>
                      ) : (
                        <button className="px-3 py-1 text-white bg-emerald-700 rounded hover:bg-emerald-800 disabled:opacity-50" onClick={() => resume(t)} disabled={savingId === t.id}>
                          Resume
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {targets.length === 0 && (
            <div className="p-4 text-gray-500">No targets yet. Create one above.</div>
          )}
        </div>
      )}
    </div>
  );
}


