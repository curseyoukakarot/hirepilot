import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

const PHANTOM_TYPES = [
  { value: 'search_export', label: 'Search Export' },
  { value: 'profile_scraper', label: 'Profile Scraper' },
  { value: 'connect', label: 'Connect' },
];

const INPUT_MODES = [
  { value: 'profile', label: 'LinkedIn Profile URL' },
  { value: 'search', label: 'Sales Nav Search URL' },
];

export default function PhantomTestMode() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [proxies, setProxies] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [phantomType, setPhantomType] = useState(PHANTOM_TYPES[0].value);
  const [inputMode, setInputMode] = useState(INPUT_MODES[0].value);
  const [targetUrl, setTargetUrl] = useState('');
  const [proxyOverride, setProxyOverride] = useState('');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: accountsData } = await supabase.from('linkedin_accounts').select('*');
      setAccounts(accountsData || []);
      const { data: proxiesData } = await supabase.from('phantombuster_proxies').select('*');
      setProxies(proxiesData || []);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setOutput(null);
    setError('');
    try {
      const response = await fetch('/api/phantom/test-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin': 'true', // TODO: Replace with real admin auth
        },
        body: JSON.stringify({
          accountId: selectedAccount,
          phantomType,
          inputMode,
          targetUrl,
          proxyOverride,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setOutput(null);
        setError(data.error || 'Test run failed');
        toast.error(data.error || 'Test run failed');
      } else {
        setOutput(data);
        setError('');
        toast.success('Test run complete');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Test run failed';
      setError(errorMessage);
      setOutput(null);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">Phantom Test Mode</h1>
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">LinkedIn Account</label>
            <select className="w-full border rounded px-2 py-1" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} required>
              <option value="">Select account</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phantom Type</label>
            <select className="w-full border rounded px-2 py-1" value={phantomType} onChange={e => setPhantomType(e.target.value)} required>
              {PHANTOM_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Input Mode</label>
            <div className="flex gap-4">
              {INPUT_MODES.map(opt => (
                <label key={opt.value} className="flex items-center gap-1">
                  <input type="radio" name="inputMode" value={opt.value} checked={inputMode === opt.value} onChange={() => setInputMode(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Target URL</label>
            <input className="w-full border rounded px-2 py-1" type="url" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} required placeholder="https://www.linkedin.com/in/... or search URL" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Proxy Override (optional)</label>
            <select className="w-full border rounded px-2 py-1" value={proxyOverride} onChange={e => setProxyOverride(e.target.value)}>
              <option value="">Default (account's proxy)</option>
              {proxies.map(proxy => (
                <option key={proxy.proxy_id || proxy.id} value={proxy.proxy_id || proxy.id}>{proxy.proxy_location || proxy.location || proxy.label || proxy.proxy_id || proxy.id}</option>
              ))}
            </select>
          </div>
          {error && (
            <div className="text-red-600 text-sm mb-2">{error}</div>
          )}
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow w-full" disabled={loading}>{loading ? 'Launching...' : 'Launch Test'}</button>
        </form>
        {output && (
          <div className="mt-6 bg-slate-100 rounded p-4">
            <h2 className="font-bold mb-2 text-blue-700">Test Output</h2>
            <pre className="text-xs overflow-x-auto text-slate-800">{JSON.stringify(output, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
} 