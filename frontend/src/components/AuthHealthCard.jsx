import React from 'react';
import useAppHealth from '../hooks/useAppHealth';

export default function AuthHealthCard() {
  const { auth, loading, refresh } = useAppHealth();

  const color = (status) => {
    switch (status) {
      case 'ok': return 'bg-green-500 text-green-500';
      case 'degraded': return 'bg-yellow-500 text-yellow-500';
      case 'down': return 'bg-red-500 text-red-500';
      default: return 'bg-gray-400 text-gray-400';
    }
  };

  const keys = ['session_cookie','passcode','otp','csrf','rate_limit','sendgrid','redis','supabase_auth'];

  return (
    <div id="auth-health" className="bg-gray-800 p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-100">Auth Health</h2>
        <button onClick={refresh} disabled={loading} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
          <i className="fa-solid fa-sync mr-1"></i> Refresh
        </button>
      </div>
      <div className="space-y-2">
        {keys.map((k) => {
          const st = auth?.items?.[k]?.status;
          return (
            <div key={k} className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${color(st).split(' ')[0]}`}></div>
                <span className={`${color(st).split(' ')[1]} text-xs`}>{k.replace(/_/g,' ')}</span>
              </div>
              <span className={`${color(st).split(' ')[1]} text-xs`}>{loading ? '—' : (st || 'unknown')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
