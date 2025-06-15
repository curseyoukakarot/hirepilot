import React, { useEffect, useState } from 'react';

interface Phantom {
  phantom_id: string;
  status: string;
  last_run: string | null;
  cookie_age: number | null;
  proxy: { id: string; region: string } | null;
  cooldown: string | null;
  next_run: string | null;
  phantom_status: string;
}

// Placeholder for fetching monitor data (replace with real API call)
async function fetchMonitorData(): Promise<Phantom[]> {
  // TODO: Replace with real API call to backend
  return [
    {
      phantom_id: '1',
      status: 'idle',
      last_run: '2024-06-01T12:00:00Z',
      cookie_age: 5,
      proxy: { id: 'proxy1', region: 'US' },
      cooldown: null,
      next_run: '2024-06-02T09:00:00Z',
      phantom_status: 'idle',
    },
    {
      phantom_id: '2',
      status: 'error',
      last_run: '2024-06-01T10:00:00Z',
      cookie_age: 31,
      proxy: { id: 'proxy2', region: 'US' },
      cooldown: '2024-06-03T10:00:00Z',
      next_run: '2024-06-02T10:00:00Z',
      phantom_status: 'cooldown',
    },
  ];
}

// Placeholder for cooldown override (replace with real API call)
async function handleOverrideCooldownAPI(phantomId: string) {
  // TODO: Replace with real API call to backend
  return true;
}

export default function PhantomMonitor() {
  const [phantoms, setPhantoms] = useState<Phantom[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState('');

  useEffect(() => {
    fetchMonitorData().then((data: Phantom[]) => {
      setPhantoms(data);
      // Show alert if any phantom is in error/cooldown
      const alertPhantom = data.find(p => p.status === 'error' || p.phantom_status === 'cooldown' || p.cooldown);
      if (alertPhantom) {
        setAlert('⚠️ One or more phantoms are in error or cooldown!');
      } else {
        setAlert('');
      }
      setLoading(false);
    });
  }, []);

  const handleOverrideCooldown = async (phantomId: string) => {
    await handleOverrideCooldownAPI(phantomId);
    // Refresh data
    setLoading(true);
    const data = await fetchMonitorData();
    setPhantoms(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">Phantom Monitor (Admin)</h1>
      {alert && (
        <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded shadow animate-pulse">
          {alert}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl shadow bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Phantom ID</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Last Run</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Cookie Age (days)</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Proxy</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Cooldown</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Next Run</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : phantoms.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No phantoms found.</td></tr>
            ) : phantoms.map((p: Phantom) => (
              <tr key={p.phantom_id} className={p.status === 'error' || p.cooldown ? 'bg-red-50' : ''}>
                <td className="px-4 py-2 font-mono text-xs">{p.phantom_id}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${p.status === 'idle' ? 'bg-green-100 text-green-700' : p.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{p.status}</span>
                </td>
                <td className="px-4 py-2 text-xs">{p.last_run ? new Date(p.last_run).toLocaleString() : '-'}</td>
                <td className="px-4 py-2 text-xs text-center">{p.cookie_age ?? '-'}</td>
                <td className="px-4 py-2 text-xs">{p.proxy ? `${p.proxy.id} (${p.proxy.region})` : '-'}</td>
                <td className="px-4 py-2 text-xs text-center">{p.cooldown ? new Date(p.cooldown).toLocaleString() : '-'}</td>
                <td className="px-4 py-2 text-xs">{p.next_run ? new Date(p.next_run).toLocaleString() : '-'}</td>
                <td className="px-4 py-2">
                  {p.cooldown && (
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded shadow transition"
                      onClick={() => handleOverrideCooldown(p.phantom_id)}
                    >
                      Override Cooldown
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Optional: Graph view for error/cooldown trends (placeholder) */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-2 text-slate-700">Trends (Coming Soon)</h2>
        <div className="h-32 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-slate-400">
          Graph view will visualize error/cooldown trends here.
        </div>
      </div>
    </div>
  );
} 