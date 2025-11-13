import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const backend = import.meta.env.VITE_BACKEND_URL || '';

export default function EmailAttributionController() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const pollRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${backend}/api/admin/email-attribution/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setStatus(json);
      setRunning(!!json?.running);
    } catch (e) {
      setError('Failed to fetch status');
    }
  };

  const fetchLogs = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${backend}/api/admin/email-attribution/logs?limit=100&since_mins=1440`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setLogs(json?.logs || []);
    } catch (e) {
      setError('Failed to fetch logs');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchStatus();
      await fetchLogs();
      setLoading(false);
    })();
    // Poll every 5s
    pollRef.current = setInterval(async () => {
      await fetchStatus();
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const runPass = async () => {
    if (running) return;
    setError('');
    setRunning(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${backend}/api/admin/email-attribution/run-pass`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchStatus();
    } catch (e) {
      setError('Failed to start timed pass');
    } finally {
      setRunning(false);
    }
  };

  const runBackfill = async () => {
    if (running) return;
    setError('');
    setRunning(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${backend}/api/admin/email-attribution/run-backfill`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchStatus();
    } catch (e) {
      setError('Failed to start backfill');
    } finally {
      setRunning(false);
    }
  };

  const openLog = async (id) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${backend}/api/admin/email-attribution/event/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setSelectedLog(json);
    } catch (e) {
      setError('Failed to load event details');
    }
  };

  const remaining = status?.remainingUnattributed ?? null;
  const lastPass = status?.lastPass || null;
  const health = useMemo(() => {
    return {
      running: !!status?.running,
      mode: status?.mode || null,
      startedAt: status?.startedAt ? new Date(status.startedAt).toLocaleString() : null,
      finishedAt: status?.finishedAt ? new Date(status.finishedAt).toLocaleString() : null,
      lastError: status?.lastError || null,
    };
  }, [status]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-8 bg-gray-800/40 w-64 rounded mb-4" />
        <div className="animate-pulse h-5 bg-gray-800/40 w-96 rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Attribution Controller</h1>
          <p className="text-gray-500">Super Admin only — control and monitor email event attribution.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runPass}
            disabled={running}
            className={`px-4 py-2 rounded-lg text-white ${running ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} transition`}
          >
            Run Timed Pass
          </button>
          <button
            onClick={runBackfill}
            disabled={running}
            className={`px-4 py-2 rounded-lg text-white ${running ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'} transition`}
          >
            Run Full Backfill
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded bg-red-900/20 text-red-300 border border-red-800/40">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-gray-700 bg-gray-800">
          <div className="text-sm text-gray-400">Remaining Unattributed</div>
          <div className="text-3xl font-bold text-gray-100">{remaining ?? '—'}</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-700 bg-gray-800">
          <div className="text-sm text-gray-400">Worker Health</div>
          <div className="mt-1 text-sm text-gray-200">
            <div>Status: <span className={`font-semibold ${health.running ? 'text-green-400' : 'text-gray-300'}`}>{health.running ? 'Running' : 'Idle'}</span></div>
            <div>Mode: <span className="font-mono text-gray-300">{health.mode || '—'}</span></div>
            <div>Started: <span className="font-mono text-gray-300">{health.startedAt || '—'}</span></div>
            <div>Finished: <span className="font-mono text-gray-300">{health.finishedAt || '—'}</span></div>
            {health.lastError && <div className="text-red-400">Error: {health.lastError}</div>}
          </div>
        </div>
        <div className="p-4 rounded-lg border border-gray-700 bg-gray-800">
          <div className="text-sm text-gray-400">Last Pass</div>
          {lastPass ? (
            <div className="mt-1 text-sm text-gray-200">
              <div>Scanned: <span className="font-semibold text-gray-100">{lastPass.scanned}</span></div>
              <div>Updated: <span className="font-semibold text-gray-100">{lastPass.updated}</span></div>
              <div>Duration: <span className="font-mono text-gray-300">{Math.round(lastPass.ms / 1000)}s</span></div>
              <div>At: <span className="font-mono text-gray-300">{new Date(lastPass.at).toLocaleString()}</span></div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-gray-500">No recent pass data</div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-lg border border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-100">Recent Attribution Logs</h2>
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Campaign</th>
                <th className="py-2 pr-4">Lead</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => {
                const meta = row?.metadata || {};
                const email = meta?.email || meta?.to_email || meta?.recipient || '';
                return (
                  <tr key={row.id} className="border-b border-gray-700 hover:bg-gray-700/60">
                    <td className="py-2 pr-4 font-mono text-gray-300">{new Date(row.updated_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{row.event_type}</td>
                    <td className="py-2 pr-4">{email || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-300">{row.user_id || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-300">{row.campaign_id || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-300">{row.lead_id || '—'}</td>
                    <td className="py-2 pr-4">{row.provider || '—'}</td>
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => openLog(row.id)}
                        className="px-2 py-1 rounded bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/40"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr><td className="py-8 text-center text-gray-500" colSpan={8}>No recent updates</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg w-full max-w-3xl shadow-lg border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="font-semibold text-gray-100">Event Details</div>
              <button className="text-gray-300 hover:text-gray-200" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
              <div>
                <div className="text-sm text-gray-400 mb-1">Event</div>
                <pre className="text-xs bg-gray-800 p-3 rounded overflow-auto text-gray-200">{JSON.stringify(selectedLog.event, null, 2)}</pre>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Related Message</div>
                <pre className="text-xs bg-gray-800 p-3 rounded overflow-auto text-gray-200">{JSON.stringify(selectedLog.message, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


