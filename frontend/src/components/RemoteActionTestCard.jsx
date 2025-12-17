import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { toast } from './ui/use-toast';

function isSuperAdminRole(role) {
  const lc = String(role || '').toLowerCase();
  return lc === 'super_admin' || lc === 'superadmin';
}

export default function RemoteActionTestCard() {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [engineMode, setEngineMode] = useState('local_browser');
  const [brightdataEnabled, setBrightdataEnabled] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [action, setAction] = useState('connect_request');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState('');
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  const loadState = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const me = await apiGet('/api/user/me');
      const isAdmin = isSuperAdminRole(me?.role);
      setEligible(isAdmin);
      if (!isAdmin) {
        setLoading(false);
        return;
      }
      const engine = await apiGet('/api/linkedin/engine-mode');
      setEngineMode(engine?.mode || 'local_browser');
      setBrightdataEnabled(Boolean(engine?.brightdata_enabled));
      const latest = await apiGet('/api/linkedin/remote-action/test/latest');
      setLogs(Array.isArray(latest?.logs) ? latest.logs : []);
    } catch (e) {
      setError(e?.message || 'Failed to load remote action test state');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const disabledReason = useMemo(() => {
    if (!eligible) return 'Super admin only.';
    if (engineMode !== 'brightdata_cloud') return 'Switch engine to Bright Data Cloud to run remote tests.';
    if (!brightdataEnabled) return 'Bright Data Browser is not enabled in this environment.';
    return '';
  }, [eligible, engineMode, brightdataEnabled]);

  const run = async () => {
    setError('');
    setJobId('');
    if (disabledReason) {
      toast({ title: 'Cannot run test', description: disabledReason, variant: 'destructive' });
      return;
    }
    if (!linkedinUrl.trim()) {
      toast({ title: 'Missing URL', description: 'Paste a LinkedIn profile URL.', variant: 'destructive' });
      return;
    }
    if (action === 'send_message' && !message.trim()) {
      toast({ title: 'Missing message', description: 'Message is required for send_message.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost('/api/linkedin/remote-action/test', {
        linkedinUrl: linkedinUrl.trim(),
        action,
        message: message.trim() || undefined
      });
      setJobId(res?.jobId || '');
      toast({ title: 'Queued', description: `Remote action test queued${res?.jobId ? ` (job ${res.jobId})` : ''}.` });
      const latest = await apiGet('/api/linkedin/remote-action/test/latest');
      setLogs(Array.isArray(latest?.logs) ? latest.logs : []);
    } catch (e) {
      setError(e?.message || 'Failed to queue test');
      toast({ title: 'Failed', description: e?.message || 'Failed to queue test', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-sm text-gray-600">Loading remote action test…</div>
      </div>
    );
  }

  if (!eligible) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Test Bright Data Browser Action</h3>
          <p className="text-sm text-gray-600 mt-1">Queue a single controlled LinkedIn remote action (admin only).</p>
        </div>
        <button
          type="button"
          onClick={loadState}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {disabledReason && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {disabledReason}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn profile URL</label>
          <input
            type="text"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full border rounded-lg px-3 py-2">
              <option value="connect_request">connect_request</option>
              <option value="send_message">send_message</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={run}
              disabled={submitting}
              className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Queuing…' : 'Run Test'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Required only for send_message"
            className="w-full border rounded-lg px-3 py-2 min-h-[90px]"
          />
        </div>

        {jobId && (
          <div className="text-sm text-gray-700">
            <span className="font-medium">Queued job:</span> {jobId}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Latest test logs</h4>
        {logs.length === 0 ? (
          <div className="text-sm text-gray-600">No logs yet.</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="divide-y">
              {logs.slice(0, 10).map((l) => (
                <div key={l.id} className="px-3 py-2 text-sm flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{l.action} • {l.status}</div>
                    <div className="text-gray-600 truncate">{l.linkedin_url}</div>
                    {l.error ? <div className="text-red-700 truncate">{l.error}</div> : null}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

