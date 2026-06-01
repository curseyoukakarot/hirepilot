import React, { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '../../../lib/api';

type ApiKey = {
  id: string;
  name: string | null;
  masked_key: string;
  environment: string | null;
  scopes: string[];
  is_active: boolean;
  created_at: string | null;
  last_used_at: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value).slice(0, 10);
  }
}

export default function IgniteApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet('/api/ignite/api-keys');
      setKeys(Array.isArray(response?.keys) ? response.keys : []);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load API keys.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKeys();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setNewKey(null);
    setCopied(false);
    try {
      const response = await apiPost('/api/ignite/api-keys', { name: name.trim() || null });
      const fullKey = String(response?.api_key || '');
      if (!fullKey) throw new Error('No key returned.');
      setNewKey(fullKey);
      setName('');
      await loadKeys();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to create API key.'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    if (!window.confirm(`Revoke this API key${key.name ? ` (“${key.name}”)` : ''}? Any integration using it will stop working immediately.`)) {
      return;
    }
    setError(null);
    try {
      await apiDelete(`/api/ignite/api-keys/${key.id}`);
      await loadKeys();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to revoke API key.'));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a secret key to connect tools and AI agents to{' '}
          <span className="font-medium">clients.ignitegtm.com</span>. Send it as an{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800">x-api-key</code> header to upload
          events and read proposals via the API.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Create a new key</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Label (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zapier, n8n agent, Make.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={`fa-solid ${creating ? 'fa-spinner fa-spin' : 'fa-plus'} mr-2`} />
            {creating ? 'Generating...' : 'Generate Key'}
          </button>
        </div>

        {newKey && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Copy this key now — you won't be able to see it again
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-sm text-gray-900 ring-1 ring-amber-200">
                {newKey}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} mr-2`} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Your keys</h2>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500">Loading keys...</div>
        ) : keys.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-500">
            No API keys yet. Generate one above to start uploading events via the API.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{key.name || 'Untitled key'}</span>
                    {key.environment && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-600">
                        {key.environment === 'production' ? 'live' : 'test'}
                      </span>
                    )}
                  </div>
                  <code className="mt-1 block font-mono text-xs text-gray-500">{key.masked_key}</code>
                  <p className="mt-1 text-xs text-gray-400">
                    Created {formatDate(key.created_at)} · Last used {formatDate(key.last_used_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(key)}
                  className="self-start rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-red-600 hover:border-red-300 hover:bg-red-50 sm:self-center"
                >
                  <i className="fa-solid fa-trash-can mr-2" />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Quick start</h2>
        <p className="mt-1 text-sm text-gray-600">Upload an event with a single request:</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
{`curl -X POST https://api.thehirepilot.com/api/ignite/events \\
  -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Q3 Partner Summit",
    "kind": "external",
    "start_date": "2026-09-12",
    "city": "Austin, TX",
    "venue": "Fairmont Austin",
    "headcount": 250,
    "primary_contact": "Jane Doe",
    "target_margin_pct": 25
  }'`}
        </pre>
        <p className="mt-3 text-xs text-gray-500">
          See the full guide for every event datapoint and the convert-to-proposal flow.
        </p>
      </section>
    </div>
  );
}
