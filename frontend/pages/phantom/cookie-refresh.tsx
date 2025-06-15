import React, { useState, useEffect } from 'react';

interface LinkedInAccount {
  id: string;
  email: string;
  lastUpdated: string;
  proxy: string;
  cooldown: boolean;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const mockAdminEmail = 'admin@hirepilot.co';

export default function CookieRefresh() {
  const [accounts, setAccounts] = useState([] as LinkedInAccount[]);
  const [selected, setSelected] = useState(null as LinkedInAccount | null);
  const [liat, setLiat] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [sourceBrowser, setSourceBrowser] = useState('Chrome');
  const [showCookie, setShowCookie] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch accounts on mount
  useEffect(() => {
    async function fetchAccounts() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${BACKEND_URL}/api/admin/linkedin-accounts`, {
          headers: { 'x-admin': 'true' },
        });
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data);
        setSelected(data[0] || null);
      } catch (e) {
        setError('Could not load accounts. Using mock data.');
        // fallback to mock
        const mockAccounts = [
          { id: 'acc1', email: 'user1@company.com', lastUpdated: '2024-06-01T12:00:00Z', proxy: 'US Proxy 1', cooldown: false },
          { id: 'acc2', email: 'user2@company.com', lastUpdated: '2024-06-01T10:00:00Z', proxy: 'US Proxy 2', cooldown: true },
        ];
        setAccounts(mockAccounts);
        setSelected(mockAccounts[0]);
      }
      setLoading(false);
    }
    fetchAccounts();
  }, []);

  const handleAccountChange = (e: { target: { value: string } }) => {
    const acc = accounts.find(a => a.id === e.target.value) || accounts[0];
    setSelected(acc);
    setLiat('');
    setUserAgent('');
    setError('');
    setSuccess('');
    setResetCooldown(false);
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selected) {
      setError('No account selected.');
      return;
    }
    if (!liat || !userAgent) {
      setError('Both li_at cookie and user agent are required.');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/update-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin': 'true',
        },
        body: JSON.stringify({
          accountId: selected.id,
          liat,
          userAgent,
          sourceBrowser,
          updatedBy: mockAdminEmail,
          resetCooldown,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to update session');
      } else {
        setSuccess('Session updated successfully!');
      }
    } catch (e) {
      setError('Failed to update session.');
    }
  };

  const handleExtensionRefresh = async () => {
    if (!selected) {
      setError('No account selected.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/refresh-session-extension`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin': 'true',
        },
        body: JSON.stringify({ accountId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to refresh session via extension');
      } else {
        setSuccess('Session updated via extension!');
      }
    } catch (e) {
      setError('Failed to refresh session via extension.');
    }
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">Refresh LinkedIn Session</h1>
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select LinkedIn Account</label>
          <select className="w-full border rounded px-3 py-2" value={selected?.id || ''} onChange={handleAccountChange} disabled={loading}>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.email}</option>
            ))}
          </select>
          {selected && (
            <div className="text-xs text-slate-500 mt-1">
              Last updated: {selected.lastUpdated ? new Date(selected.lastUpdated).toLocaleString() : '-'}<br/>
              Proxy: {selected.proxy || '-'}
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">li_at Cookie</label>
            <div className="relative">
              {/* Note: Masking for textarea is not perfect in all browsers. For full masking, use an input type=password. */}
              {showCookie ? (
                <textarea
                  className="w-full border rounded px-3 py-2 pr-10 font-mono text-xs"
                  value={liat}
                  onChange={e => setLiat(e.target.value)}
                  placeholder="Paste li_at cookie here"
                  rows={2}
                />
              ) : (
                <input
                  className="w-full border rounded px-3 py-2 pr-10 font-mono text-xs"
                  value={liat}
                  onChange={e => setLiat(e.target.value)}
                  placeholder="Paste li_at cookie here"
                  type="password"
                />
              )}
              <button type="button" className="absolute top-2 right-2 text-xs text-blue-600 underline" onClick={() => setShowCookie(v => !v)}>
                {showCookie ? 'Hide' : 'Show'}
              </button>
            </div>
            {!showCookie && <div className="text-xs text-slate-400 mt-1">Cookie is masked for safety.</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User Agent</label>
            <input
              className="w-full border rounded px-3 py-2 font-mono text-xs"
              value={userAgent}
              onChange={e => setUserAgent(e.target.value)}
              placeholder="Paste user agent here"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source Browser</label>
            <select className="w-full border rounded px-3 py-2" value={sourceBrowser} onChange={e => setSourceBrowser(e.target.value)}>
              <option>Chrome</option>
              <option>Safari</option>
              <option>Edge</option>
              <option>Firefox</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Updated By</label>
            <input className="w-full border rounded px-3 py-2 bg-slate-100" value={mockAdminEmail} disabled />
          </div>
          {selected?.cooldown && (
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="resetCooldown" checked={resetCooldown} onChange={e => setResetCooldown(e.target.checked)} />
              <label htmlFor="resetCooldown" className="text-sm text-slate-700">Reset cooldown and resume automation after saving</label>
            </div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow" disabled={loading}>Update Session</button>
        </form>
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Or refresh via Chrome Extension</span>
            <button className="text-xs text-blue-600 underline" onClick={() => setShowModal(true)} disabled={loading}>Show Instructions</button>
          </div>
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full relative">
                <button className="absolute top-2 right-2 text-slate-400 hover:text-slate-600" onClick={() => setShowModal(false)}>&times;</button>
                <h2 className="text-lg font-bold mb-2">Refresh via PhantomBuster Extension</h2>
                <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1 mb-4">
                  <li>Open the PhantomBuster Chrome extension in your browser.</li>
                  <li>Click "Capture LinkedIn Session" and follow the prompts.</li>
                  <li>Return here and click the button below to confirm.</li>
                </ol>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow mt-2" onClick={handleExtensionRefresh} disabled={loading}>Yes, I captured my session just now</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 