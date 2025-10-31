import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../components/ui/use-toast';

function formatDate(d) {
  try {
    if (!d) return '—';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleString();
  } catch (_) {
    return String(d || '—');
  }
}

export default function RemoteSessionConnect({ accountId: accountIdProp, campaignId: campaignIdProp }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeTab, setActiveTab] = useState('extension'); // 'extension' | 'manual'
  const [sessionName, setSessionName] = useState('My Home LinkedIn');
  const [sessionDataBase64, setSessionDataBase64] = useState('');
  const [metadata, setMetadata] = useState({ browser: 'chrome', version: '', proxyId: '' });
  const [startForm, setStartForm] = useState({ sessionId: '', action: 'sourcing', source: 'linkedin', query: '', sampleSize: 50, campaignId: campaignIdProp || '' });
  const [queueing, setQueueing] = useState(false);
  const [queueResult, setQueueResult] = useState(null);
  const [watchSessionId, setWatchSessionId] = useState('');
  const [activity, setActivity] = useState([]);
  const pollTimer = useRef(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      // Backend should infer account by auth; query param kept for forward compat
      const data = await apiGet(`/api/remote-sessions`);
      setSessions(Array.isArray(data?.sessions) ? data.sessions : (Array.isArray(data) ? data : []));
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to load sessions', variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Activity polling
  useEffect(() => {
    if (!watchSessionId) return;
    const tick = async () => {
      try {
        const res = await apiGet(`/api/sniper/activity?sessionId=${encodeURIComponent(watchSessionId)}`);
        setActivity(Array.isArray(res?.activities) ? res.activities : (Array.isArray(res) ? res : []));
      } catch (_) {}
    };
    tick();
    pollTimer.current = setInterval(tick, 5000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [watchSessionId]);

  const handleOpenConnect = () => {
    setShowConnectModal(true);
    setActiveTab('extension');
    setSessionDataBase64('');
    setSessionName('My Home LinkedIn');
    setMetadata({ browser: 'chrome', version: '', proxyId: '' });
  };

  const handleSubmitConnect = async () => {
    setConnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const inferredAccount = (user.user_metadata && (user.user_metadata.account_id || user.user_metadata.accountId)) || accountIdProp || null;
      const payload = {
        accountId: inferredAccount,
        userId: user.id,
        sessionName: sessionName || 'LinkedIn Session',
        sessionData: (sessionDataBase64 || '').trim(),
        metadata: {
          browser: metadata.browser || 'chrome',
          version: metadata.version || '',
          proxyId: metadata.proxyId || undefined,
        },
      };
      if (!payload.sessionData) throw new Error('Please provide the base64 session blob');
      const res = await apiPost('/api/remote-sessions', payload);
      toast({ title: 'Connected', description: 'Remote session saved securely.' });
      setShowConnectModal(false);
      setSessionDataBase64('');
      setSessionName('My Home LinkedIn');
      await loadSessions();
      if (res?.sessionId) setStartForm(s => ({ ...s, sessionId: res.sessionId }));
    } catch (e) {
      toast({ title: 'Failed to connect', description: e.message || 'Unable to store session', variant: 'destructive' });
    }
    setConnecting(false);
  };

  const handleTest = async (sessionId) => {
    setTestingId(sessionId);
    try {
      await apiPost(`/api/remote-sessions/${encodeURIComponent(sessionId)}/test`, {});
      toast({ title: 'Test queued', description: 'Validation started. This may take a few seconds.' });
      await loadSessions();
    } catch (e) {
      toast({ title: 'Test failed', description: e.message || 'Unable to validate session', variant: 'destructive' });
    }
    setTestingId(null);
  };

  const canTrigger = useMemo(() => Boolean(startForm.sessionId && startForm.source && startForm.action && startForm.query && startForm.sampleSize), [startForm]);

  const handleTrigger = async () => {
    setQueueing(true);
    setQueueResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const inferredAccount = (user.user_metadata && (user.user_metadata.account_id || user.user_metadata.accountId)) || accountIdProp || null;
      const body = {
        accountId: inferredAccount,
        userId: user.id,
        campaignId: startForm.campaignId || undefined,
        sessionId: startForm.sessionId,
        source: startForm.source,
        action: startForm.action,
        query: startForm.query,
        sampleSize: Number(startForm.sampleSize) || 50,
      };
      const res = await apiPost('/api/sniper/trigger', body);
      setQueueResult(res || {});
      if (res?.queued) {
        toast({ title: 'Queued', description: 'Job queued successfully.' });
        setWatchSessionId(startForm.sessionId);
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to queue job', variant: 'destructive' });
    }
    setQueueing(false);
  };

  const handleDryRun = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const inferredAccount = (user.user_metadata && (user.user_metadata.account_id || user.user_metadata.accountId)) || accountIdProp || null;
      const preview = await apiPost('/api/sniper/test', {
        accountId: inferredAccount,
        userId: user.id,
        sessionId: startForm.sessionId || undefined,
        source: startForm.source,
        action: startForm.action,
        sampleSize: Number(startForm.sampleSize) || 50,
      });
      toast({ title: 'Dry run complete', description: `Expected daily total: ${preview?.expectedDailyTotal ?? 'N/A'}` });
    } catch (e) {
      toast({ title: 'Dry run failed', description: e.message || 'Failed to run test', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">LinkedIn Remote Sessions</h3>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={handleOpenConnect}>Connect Remote Session</button>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="p-4 bg-gray-50 border rounded">No sessions yet. Connect one to start sourcing.</div>
          ) : sessions.map((s) => (
            <div key={s.id || s.session_id} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{s.name || s.session_name || 'LinkedIn Session'}</div>
                <div className="text-sm text-gray-600">Last tested: {formatDate(s.last_tested_at)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStartForm(f => ({ ...f, sessionId: s.id || s.session_id }))}
                  className={`px-3 py-2 rounded border ${startForm.sessionId === (s.id || s.session_id) ? 'border-blue-600 text-blue-700' : 'border-gray-300 text-gray-700'} hover:bg-gray-50`}
                >Select</button>
                <button
                  onClick={() => handleTest(s.id || s.session_id)}
                  className="px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50"
                  disabled={testingId === (s.id || s.session_id)}
                >{testingId === (s.id || s.session_id) ? 'Testing…' : 'Test Session'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start Sourcing Form */}
      <div className="mt-6 border-t pt-6">
        <h4 className="text-md font-semibold text-gray-900 mb-3">Start Sourcing (REX)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Selected Session</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={startForm.sessionId}
              onChange={(e) => setStartForm(f => ({ ...f, sessionId: e.target.value }))}
            >
              <option value="">Choose a session…</option>
              {sessions.map(s => (
                <option key={s.id || s.session_id} value={s.id || s.session_id}>{s.name || s.session_name || 'Session'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Campaign (optional)</label>
            <input
              type="text"
              placeholder="camp_789"
              className="w-full border rounded px-3 py-2"
              value={startForm.campaignId}
              onChange={(e) => setStartForm(f => ({ ...f, campaignId: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Sales Navigator URL or Saved Search ID</label>
            <input
              type="text"
              placeholder="https://www.linkedin.com/sales/search/people?..."
              className="w-full border rounded px-3 py-2"
              value={startForm.query}
              onChange={(e) => setStartForm(f => ({ ...f, query: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Action</label>
              <select className="w-full border rounded px-3 py-2" value={startForm.action} onChange={(e) => setStartForm(f => ({ ...f, action: e.target.value }))}>
                <option value="sourcing">sourcing</option>
                <option value="view">view</option>
                <option value="invite">invite</option>
                <option value="message">message</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Sample Size</label>
              <input type="number" min={1} max={1000} className="w-full border rounded px-3 py-2" value={startForm.sampleSize} onChange={(e) => setStartForm(f => ({ ...f, sampleSize: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={handleTrigger}
            disabled={!canTrigger || queueing}
          >{queueing ? 'Queueing…' : 'Start Sourcing'}</button>
          <button className="px-4 py-2 border rounded" onClick={handleDryRun}>Test Run (Dry)</button>
          {queueResult?.activityLogId && (
            <span className="text-sm text-gray-600">Activity: {queueResult.activityLogId}</span>
          )}
        </div>
      </div>

      {/* Activity Widget */}
      <div className="mt-8 bg-gray-50 rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-semibold text-gray-800">Live Activity</h5>
          <select className="border rounded px-2 py-1 text-sm" value={watchSessionId} onChange={(e) => setWatchSessionId(e.target.value)}>
            <option value="">— Select session to watch —</option>
            {sessions.map(s => (
              <option key={s.id || s.session_id} value={s.id || s.session_id}>{s.name || s.session_name || 'Session'}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 text-sm">
          {(activity || []).slice(0, 10).map((a) => (
            <div key={a.id || `${a.created_at}-${a.status}-${a.action}`} className="flex items-center justify-between">
              <div className="text-gray-700">{a.action || a.event || 'job'} — {a.status || 'unknown'}</div>
              <div className="text-gray-500">{formatDate(a.updated_at || a.created_at)}</div>
            </div>
          ))}
          {(!activity || activity.length === 0) && (
            <div className="text-gray-500">No recent activity.</div>
          )}
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-xl shadow-lg relative">
            <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={() => setShowConnectModal(false)} aria-label="Close">✕</button>
            <h3 className="text-lg font-semibold mb-2">Connect LinkedIn Remote Session</h3>
            <p className="text-sm text-gray-600 mb-4">Use the Chrome extension to capture your session or paste a base64 session blob. We encrypt cookies at rest. Session data will never be shown in plaintext.</p>
            <div className="flex gap-2 mb-4">
              <button className={`px-3 py-1 rounded ${activeTab==='extension'?'bg-blue-600 text-white':'border'}`} onClick={()=>setActiveTab('extension')}>Extension</button>
              <button className={`px-3 py-1 rounded ${activeTab==='manual'?'bg-blue-600 text-white':'border'}`} onClick={()=>setActiveTab('manual')}>Manual Paste</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Session Name</label>
                <input className="w-full border rounded px-3 py-2" value={sessionName} onChange={(e)=>setSessionName(e.target.value)} placeholder="My Home LinkedIn" />
              </div>
              {activeTab === 'extension' ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  Install the HirePilot Chrome extension, click "Capture LinkedIn Session", then paste the generated base64 blob below.
                </div>
              ) : null}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Session Data (base64)</label>
                <textarea className="w-full border rounded px-3 py-2 h-28" value={sessionDataBase64} onChange={(e)=>setSessionDataBase64(e.target.value)} placeholder="Paste base64 blob from extension or exporter" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Browser</label>
                  <select className="w-full border rounded px-3 py-2" value={metadata.browser} onChange={(e)=>setMetadata(m=>({ ...m, browser: e.target.value }))}>
                    <option value="chrome">Chrome</option>
                    <option value="edge">Edge</option>
                    <option value="firefox">Firefox</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Version</label>
                  <input className="w-full border rounded px-3 py-2" value={metadata.version} onChange={(e)=>setMetadata(m=>({ ...m, version: e.target.value }))} placeholder="142.0" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Proxy ID (optional)</label>
                  <input className="w-full border rounded px-3 py-2" value={metadata.proxyId} onChange={(e)=>setMetadata(m=>({ ...m, proxyId: e.target.value }))} placeholder="p_123" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button className="px-4 py-2 border rounded" onClick={()=>setShowConnectModal(false)} disabled={connecting}>Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" onClick={handleSubmitConnect} disabled={connecting || !sessionDataBase64.trim()}>{connecting ? 'Connecting…' : 'Save Session'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


