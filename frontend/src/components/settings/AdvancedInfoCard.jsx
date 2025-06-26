import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdvancedInfoCard() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const base = import.meta.env.VITE_BACKEND_URL || (import.meta.env.MODE === 'development' ? 'http://localhost:8080' : '');
        const res = await fetch(`${base}/api/advanced-info`, {
          headers: userId ? { 'x-user-id': userId } : {}
        });
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        setInfo(json);
      } catch (e) {
        console.error('AdvancedInfoCard error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, []);

  const copy = (text) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (loading) return null;
  if (!info) return null;

  const { user_id, campaigns = [] } = info;
  const lastThree = campaigns.slice(0, 3);

  return (
    <div id="advanced-info-card" className="bg-white rounded-xl border border-gray-200 p-6 mt-10">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <i className="fa-solid fa-cog text-purple-600"></i>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Advanced Info</h2>
          <p className="text-sm text-gray-500">System-level metadata and recent activity</p>
        </div>
      </div>

      {/* User ID */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          User ID
          <i
            className="fa-solid fa-info-circle text-gray-400 ml-1 cursor-help"
            title="This is your unique system ID. You may need to provide it for REX, support, or integrations."
          ></i>
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={user_id}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => copy(user_id)}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <i className="fa-solid fa-copy"></i>
          </button>
        </div>
      </div>

      {/* Campaigns */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-4">Last 3 Campaigns</h3>
        <div className="space-y-3">
          {lastThree.map((c) => {
            const date = new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const statusColor = c.status === 'Sent' ? 'text-green-600' : c.status === 'Paused' ? 'text-yellow-600' : 'text-gray-600';
            return (
              <div key={c.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <i className="fa-solid fa-bullhorn text-blue-600 text-sm"></i>
                    <h4 className="font-semibold text-gray-900">{c.name}</h4>
                  </div>
                  <p className="text-sm text-gray-500">
                    {date} – Status: <span className={`${statusColor} font-medium`}>{c.status}</span>
                  </p>
                  <p className="text-xs text-gray-400 font-mono">Campaign ID: {c.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(c.id)}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                >
                  <i className="fa-solid fa-copy"></i>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 