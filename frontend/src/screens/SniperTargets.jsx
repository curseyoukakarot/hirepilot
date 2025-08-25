import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function SniperTargets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/sniper/targets');
      setTargets(data || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load targets');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleOpener = async (t) => {
    setSavingId(t.id);
    try {
      await apiPost(`/api/sniper/targets/${t.id}/opener`, {
        send_opener: !t.send_opener,
        opener_subject: t.opener_subject || null,
        opener_body: t.opener_body || null
      });
      toast.success(!t.send_opener ? 'Opener enabled' : 'Opener disabled');
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to update opener');
    }
    setSavingId(null);
  };

  const updateCap = async (t, cap) => {
    setSavingId(t.id);
    try {
      const daily_cap = Math.max(5, Math.min(50, parseInt(cap || t.daily_cap, 10)));
      await apiPost(`/api/sniper/targets/${t.id}/opener-cap`, { daily_cap });
      toast.success('Daily cap updated');
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to update cap');
    }
    setSavingId(null);
  };

  const sendBatchNow = async (t) => {
    setSavingId(t.id);
    try {
      await apiPost(`/api/sniper/targets/${t.id}/capture-now`);
      toast.success('Capture queued; opener will follow if enabled');
    } catch (e) {
      toast.error(e.message || 'Failed to trigger capture');
    }
    setSavingId(null);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Sniper Targets</h1>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Post / Keyword</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Send opener</th>
                <th className="text-left px-4 py-2">Daily opener cap</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {targets.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 capitalize">{t.type}</td>
                  <td className="px-4 py-2 truncate max-w-xs">
                    {t.type === 'keyword' ? (t.keyword_match || '') : (t.post_url || '')}
                  </td>
                  <td className="px-4 py-2">{t.status}</td>
                  <td className="px-4 py-2">
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={!!t.send_opener} onChange={() => toggleOpener(t)} disabled={savingId === t.id} />
                      <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all relative peer-checked:bg-green-500"></div>
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={50}
                        defaultValue={t.daily_cap || 15}
                        className="w-20 border rounded px-2 py-1"
                        onBlur={(e) => updateCap(t, e.target.value)}
                        disabled={savingId === t.id}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className="px-3 py-1 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                      onClick={() => sendBatchNow(t)}
                      disabled={savingId === t.id}
                    >
                      Send batch now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {targets.length === 0 && (
            <div className="p-4 text-gray-500">No targets yet. Start one from REX or via API.</div>
          )}
        </div>
      )}
    </div>
  );
}


