import React from 'react';
import useAppHealth from '../hooks/useAppHealth';

export default function AppHealthCard() {
  const { data, loading, refresh } = useAppHealth();

  const items = [
    { key: 'supabase', label: 'Supabase DB' },
    { key: 'edge', label: 'Edge Functions' },
    { key: 'phantom', label: 'PhantomBuster Queue' },
    { key: 'slack', label: 'Slack Integration' }
  ];

  const color = (status) => {
    switch (status) {
      case 'ok': return 'bg-green-500 text-green-500';
      case 'degraded': return 'bg-yellow-500 text-yellow-500';
      case 'down': return 'bg-red-500 text-red-500';
      default: return 'bg-gray-400 text-gray-400';
    }
  };

  return (
    <div id="app-health-monitor" className="bg-gray-800 p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-100">App Health Monitor</h2>
        <button onClick={refresh} disabled={loading} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
          <i className="fa-solid fa-sync mr-1"></i> Refresh
        </button>
      </div>
      <div className="space-y-3">
        {items.map(({ key, label }) => {
          const status = data?.[key]?.status;
          return (
            <div key={key} className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${color(status).split(' ')[0]}`}></div>
                <span className={`${color(status).split(' ')[1]} text-xs`}>{label}</span>
              </div>
              <span className={`${color(status).split(' ')[1]} text-xs`}>{loading ? 'Checking…' : (status || 'unknown')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
} 