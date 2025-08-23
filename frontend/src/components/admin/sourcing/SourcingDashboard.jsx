import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import CampaignsPage from './CampaignsPage';
import CampaignDetailPage from './CampaignDetailPage';
import RepliesPage from './RepliesPage';

export default function SourcingDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalReplies: 0,
    positiveReplies: 0
  });

  useEffect(() => {
    // Fetch overall stats for the dashboard
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // This would be a summary endpoint
      // For now, we'll use placeholder data
      setStats({
        totalCampaigns: 12,
        activeCampaigns: 5,
        totalReplies: 47,
        positiveReplies: 23
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const isCurrentPath = (path) => {
    return location.pathname.includes(path);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900 min-h-screen">
      {/* Navigation Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-bold text-white">Sourcing Agent</h1>
            <nav className="flex space-x-4">
              <button
                onClick={() => navigate('/super-admin/sourcing')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/super-admin/sourcing' || location.pathname.includes('/campaigns')
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                Campaigns
              </button>
              <button
                onClick={() => navigate('/super-admin/sourcing/analytics')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrentPath('/analytics')
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => navigate('/super-admin/sourcing/settings')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrentPath('/settings')
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                Settings
              </button>
            </nav>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">{stats.totalCampaigns}</div>
              <div className="text-gray-400">Total Campaigns</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">{stats.activeCampaigns}</div>
              <div className="text-gray-400">Active</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400">{stats.totalReplies}</div>
              <div className="text-gray-400">Total Replies</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">{stats.positiveReplies}</div>
              <div className="text-gray-400">Positive</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="/campaigns/:id/replies" element={<RepliesPage />} />
          <Route path="/analytics" element={<AnalyticsPlaceholder />} />
          <Route path="/settings" element={<SettingsPlaceholder />} />
        </Routes>
      </div>
    </div>
  );
}

// Placeholder components for future implementation
function AnalyticsPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="text-gray-500 text-6xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-white mb-2">Analytics Dashboard</h2>
        <p className="text-gray-400">Advanced analytics and reporting coming soon</p>
      </div>
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="text-gray-500 text-6xl mb-4">⚙️</div>
        <h2 className="text-xl font-semibold text-white mb-2">Sourcing Settings</h2>
        <p className="text-gray-400">Configuration options coming soon</p>
      </div>
    </div>
  );
}
