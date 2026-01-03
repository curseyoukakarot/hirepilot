import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function SniperActivity() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [items, setItems] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState(new Set());
  const [connectNote, setConnectNote] = useState('');
  const [messageText, setMessageText] = useState('');

  async function loadJobs() {
    setLoadingJobs(true);
    try {
      const resp = await apiGet('/api/sniper/jobs?limit=50');
      // backend returns an array; tolerate legacy wrapped shapes too
      setJobs(Array.isArray(resp) ? resp : (resp?.jobs || []));
    } catch (e) {
      toast.error(e.message || 'Failed to load activity');
    } finally {
      setLoadingJobs(false);
    }
  }

  async function loadItems(jobId) {
    setLoadingItems(true);
    try {
      const resp = await apiGet(`/api/sniper/jobs/${jobId}/items?limit=2000`);
      // backend returns an array; tolerate legacy wrapped shapes too
      setItems(Array.isArray(resp) ? resp : (resp?.items || []));
      setSelectedUrls(new Set());
    } catch (e) {
      toast.error(e.message || 'Failed to load job items');
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    loadItems(selectedJobId);
  }, [selectedJobId]);

  const extractItems = useMemo(() => items.filter((i) => i.action_type === 'extract'), [items]);
  const connectItems = useMemo(() => items.filter((i) => i.action_type === 'connect'), [items]);
  const messageItems = useMemo(() => items.filter((i) => i.action_type === 'message'), [items]);

  const selectedList = useMemo(() => Array.from(selectedUrls), [selectedUrls]);

  const toggleUrl = (url) => {
    const next = new Set(selectedUrls);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    setSelectedUrls(next);
  };

  async function queueConnect() {
    if (selectedList.length === 0) return toast.error('Select at least 1 profile');
    try {
      const resp = await apiPost('/api/sniper/actions/connect', {
        profile_urls: selectedList,
        note: connectNote || null
      });
      toast.success('Queued connection requests');
      // Optionally switch to new job
      if (resp.job_id) {
        await loadJobs();
        setSelectedJobId(resp.job_id);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to queue connects');
    }
  }

  async function queueMessage() {
    if (selectedList.length === 0) return toast.error('Select at least 1 profile');
    if (!messageText.trim()) return toast.error('Message is required');
    try {
      const resp = await apiPost('/api/sniper/actions/message', {
        profile_urls: selectedList,
        message: messageText.trim()
      });
      toast.success('Queued messages');
      if (resp.job_id) {
        await loadJobs();
        setSelectedJobId(resp.job_id);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to queue messages');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Sniper Activity</h1>
        <button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={loadJobs} disabled={loadingJobs}>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="border rounded bg-white overflow-hidden">
          <div className="px-4 py-3 border-b font-medium">Jobs</div>
          {loadingJobs ? (
            <div className="p-4 text-gray-600">Loading…</div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJobId(j.id)}
                  className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${selectedJobId === j.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{j.job_type}</div>
                    <div className="text-xs px-2 py-1 rounded bg-gray-100">{j.status}</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(j.created_at).toLocaleString()}</div>
                </button>
              ))}
              {jobs.length === 0 && <div className="p-4 text-gray-600">No jobs yet.</div>}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 border rounded bg-white overflow-hidden">
          <div className="px-4 py-3 border-b font-medium flex items-center justify-between">
            <div>Job Items</div>
            <div className="text-xs text-gray-500">
              Extract: {extractItems.length} · Connect: {connectItems.length} · Message: {messageItems.length}
            </div>
          </div>

          {!selectedJobId ? (
            <div className="p-4 text-gray-600">Select a job to view details.</div>
          ) : loadingItems ? (
            <div className="p-4 text-gray-600">Loading items…</div>
          ) : (
            <>
              {extractItems.length > 0 && (
                <div className="p-4 border-b">
                  <div className="font-medium mb-2">Extracted profiles</div>
                  <div className="flex flex-col gap-2">
                    {extractItems.slice(0, 2000).map((it) => (
                      <label key={it.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedUrls.has(it.profile_url)}
                          onChange={() => toggleUrl(it.profile_url)}
                        />
                        <div className="min-w-0">
                          <a className="text-blue-600 underline truncate block" href={it.profile_url} target="_blank" rel="noreferrer">
                            {it.profile_url}
                          </a>
                          <div className="text-xs text-gray-500">
                            {it.status}
                            {it.result_json?.name ? ` · ${it.result_json.name}` : ''}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {extractItems.length > 0 && (
                <div className="p-4 border-b">
                  <div className="font-medium mb-2">Actions on selected ({selectedList.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Connect request (optional note)</div>
                      <textarea
                        className="w-full border rounded p-2 text-sm"
                        rows={4}
                        value={connectNote}
                        onChange={(e) => setConnectNote(e.target.value)}
                        placeholder="Add a short note (optional)"
                      />
                      <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={queueConnect} disabled={selectedList.length === 0}>
                        Queue Connect
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Message (1st-degree only)</div>
                      <textarea
                        className="w-full border rounded p-2 text-sm"
                        rows={4}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Write the message to send"
                      />
                      <button className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50" onClick={queueMessage} disabled={selectedList.length === 0 || !messageText.trim()}>
                        Queue Message
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {extractItems.length === 0 && (
                <div className="p-4 text-gray-600">
                  No extract items found for this job yet.
                </div>
              )}

              {(connectItems.length > 0 || messageItems.length > 0) && (
                <div className="p-4">
                  <div className="font-medium mb-2">Execution log</div>
                  <div className="overflow-auto border rounded">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">Type</th>
                          <th className="text-left px-3 py-2">Profile</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-left px-3 py-2">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...connectItems, ...messageItems].map((it) => (
                          <tr key={it.id} className="border-t">
                            <td className="px-3 py-2">{it.action_type}</td>
                            <td className="px-3 py-2">
                              <a className="text-blue-600 underline" href={it.profile_url} target="_blank" rel="noreferrer">
                                {it.profile_url}
                              </a>
                            </td>
                            <td className="px-3 py-2">{it.status}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{it.error_message || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


