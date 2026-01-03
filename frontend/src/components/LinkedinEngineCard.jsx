import React, { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { toast } from './ui/use-toast';

const ENGINE_OPTIONS = [
  {
    value: 'local_browser',
    title: 'Local Browser (Chrome Extension)',
    description: 'Run LinkedIn actions through your computer using the HirePilot Chrome extension.'
  },
  {
    value: 'brightdata_cloud',
    title: 'Cloud Engine',
    description: 'Use HirePilot’s cloud engine to send invites and messages on your behalf.'
  }
];

export default function LinkedinEngineCard() {
  const [mode, setMode] = useState('local_browser');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasCookie, setHasCookie] = useState(false);
  const [brightDataEnabled, setBrightDataEnabled] = useState(false);
  const [error, setError] = useState('');

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/api/linkedin/engine-mode');
      setMode(data?.mode || 'local_browser');
      setHasCookie(Boolean(data?.has_cookie));
      setBrightDataEnabled(Boolean(data?.brightdata_enabled));
    } catch (e) {
      setError(e?.message || 'Failed to load engine mode');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleSelect = async (value) => {
    if (value === mode) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiPost('/api/linkedin/engine-mode', { mode: value });
      setMode(res?.mode || value);
      setHasCookie(Boolean(res?.has_cookie));
      setBrightDataEnabled(Boolean(res?.brightdata_enabled));
      toast({ title: 'Updated', description: `LinkedIn engine set to ${value === 'brightdata_cloud' ? 'Cloud Engine' : 'Local Browser'}.` });
    } catch (e) {
      setError(e?.message || 'Failed to save engine mode');
      toast({ title: 'Unable to update engine', description: e?.message || 'Try again later.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const renderStatus = () => {
    if (mode === 'brightdata_cloud') {
      if (!brightDataEnabled) {
        return (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            Cloud Engine is disabled in this environment. Configure <code>AIRTOP_API_KEY</code> and enable <code>AIRTOP_PROVIDER_ENABLED</code> to use Cloud Engine.
          </div>
        );
      }
      if (!hasCookie) {
        return (
          <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Connect LinkedIn to run Cloud Engine automations (use the Sniper Control Center tab for embedded login).
          </div>
        );
      }
      return (
        <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          Cloud Engine active.
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-md bg-blue-100 border border-blue-200 px-3 py-2 text-sm text-blue-900">
        Local Browser mode selected. Scheduling and automated limits are available when you switch to Cloud Engine.
      </div>
    );
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500">Automation Engine</p>
          <h3 className="text-lg font-semibold text-gray-900">Who should run LinkedIn?</h3>
        </div>
        {loading ? (
          <span className="text-sm text-gray-500">Loading…</span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {mode === 'brightdata_cloud' ? 'Cloud Engine' : 'Local Browser'}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ENGINE_OPTIONS.map((option) => {
          const selected = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              disabled={loading || saving}
              className={`text-left border rounded-xl p-4 transition focus:outline-none ${
                selected
                  ? 'border-blue-600 shadow-sm ring-2 ring-blue-100 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{option.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                </div>
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-transparent'
                  }`}
                >
                  ●
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {renderStatus()}
    </div>
  );
}


