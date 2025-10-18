import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { api } from '../../../lib/api';

type Campaign = {
  id: string;
  title: string;
  audience_tag?: string | null;
  status: string;
  created_at: string;
  created_by?: string;
  default_sender_id?: string;
};

type CampaignStats = {
  total_leads: number;
  emails_sent: number;
  replies_received: number;
  positive_replies: number;
};

export default function CampaignsPage() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const campaigns = await api('/api/sourcing/campaigns');
      setRows(campaigns);

      // Load stats for each campaign
      const statsPromises = campaigns.map(async (campaign: Campaign) => {
        try {
          const campaignStats = await api(`/api/sourcing/campaigns/${campaign.id}/stats`);
          return { id: campaign.id, stats: campaignStats };
        } catch (err) {
          console.warn(`Failed to load stats for campaign ${campaign.id}:`, err);
        }
        return { id: campaign.id, stats: null };
      });

      const statsResults = await Promise.all(statsPromises);
      const statsMap: Record<string, CampaignStats> = {};
      
      statsResults.forEach(({ id, stats }) => {
        if (stats) {
          statsMap[id] = stats;
        }
      });

      setStats(statsMap);
    } catch (err) {
      console.error('Error loading campaigns:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  // Filter campaigns based on status
  const filteredCampaigns = rows.filter(campaign => {
    if (filter === 'all') return true;
    return campaign.status === filter;
  });

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-600 text-gray-200';
      case 'scheduled': return 'bg-blue-600 text-blue-100';
      case 'running': return 'bg-green-600 text-green-100';
      case 'paused': return 'bg-yellow-600 text-yellow-100';
      case 'completed': return 'bg-purple-600 text-purple-100';
      default: return 'bg-gray-600 text-gray-200';
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl text-white font-bold">Sourcing Campaigns</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-slate-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { window.location.href = '/agent/advanced/console'; }}
            className="inline-flex items-center px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
            title="Back to Agent Mode"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div>
          <h1 className="text-2xl text-white font-bold">Sourcing Campaigns</h1>
          <p className="text-gray-400 mt-1">
            Manage AI-powered sourcing campaigns and track performance
          </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Agent Mode quick toggle */}
          <AgentModeSwitch />
          <button
            onClick={loadCampaigns}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Refresh
          </button>
          <Link
            to="/rex-chat"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + New Campaign (REX)
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex space-x-2">
          {['all', 'draft', 'scheduled', 'running', 'paused', 'completed'].map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === filterType
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filterType === 'all' ? 'All' : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              {filterType !== 'all' && (
                <span className="ml-1 text-xs opacity-75">
                  ({rows.filter(c => c.status === filterType).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Error loading campaigns</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Campaigns Grid */}
      <div className="grid gap-4">
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-6xl mb-4">📊</div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">
              {filter === 'all' ? 'No campaigns yet' : `No ${filter} campaigns`}
            </h3>
            <p className="text-gray-500 mb-4">
              {filter === 'all' 
                ? "Start your first sourcing campaign by chatting with REX."
                : `No campaigns with status "${filter}" found.`
              }
            </p>
            {filter === 'all' && (
              <Link
                to="/rex-chat"
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                🤖 Chat with REX to Start
              </Link>
            )}
          </div>
        ) : (
          filteredCampaigns.map(campaign => {
            const campaignStats = stats[campaign.id];
            
            return (
              <Link
                key={campaign.id}
                to={`/super-admin/sourcing/campaigns/${campaign.id}`}
                className="rounded-xl border border-slate-700 bg-slate-800/70 p-6 hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg group-hover:text-blue-300 transition-colors">
                      {campaign.title}
                    </h3>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </span>
                      {campaign.audience_tag && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                          {campaign.audience_tag}
                        </span>
                      )}
                      <span className="text-gray-400 text-sm">
                        {formatRelativeTime(campaign.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-gray-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Stats */}
                {campaignStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700/50">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white">
                        {campaignStats.total_leads || 0}
                      </div>
                      <div className="text-xs text-gray-400">Leads</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-400">
                        {campaignStats.emails_sent || 0}
                      </div>
                      <div className="text-xs text-gray-400">Sent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-yellow-400">
                        {campaignStats.replies_received || 0}
                      </div>
                      <div className="text-xs text-gray-400">Replies</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-400">
                        {campaignStats.positive_replies || 0}
                      </div>
                      <div className="text-xs text-gray-400">Positive</div>
                    </div>
                  </div>
                )}

                {/* Loading stats */}
                {!campaignStats && (
                  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700/50">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="text-center">
                        <div className="h-4 bg-slate-700 rounded w-8 mx-auto mb-1 animate-pulse"></div>
                        <div className="h-3 bg-slate-700 rounded w-12 mx-auto animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {filteredCampaigns.length > 0 && (
        <div className="mt-8 bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{filteredCampaigns.length}</div>
              <div className="text-sm text-gray-400">
                {filter === 'all' ? 'Total Campaigns' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Campaigns`}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {Object.values(stats).reduce((sum, s) => sum + (s?.total_leads || 0), 0)}
              </div>
              <div className="text-sm text-gray-400">Total Leads</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {Object.values(stats).reduce((sum, s) => sum + (s?.emails_sent || 0), 0)}
              </div>
              <div className="text-sm text-gray-400">Emails Sent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                {Object.values(stats).reduce((sum, s) => sum + (s?.replies_received || 0), 0)}
              </div>
              <div className="text-sm text-gray-400">Replies</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {Object.values(stats).reduce((sum, s) => sum + (s?.positive_replies || 0), 0)}
              </div>
              <div className="text-sm text-gray-400">Positive</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentModeSwitch() {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/agent-mode');
        setEnabled(!!data.agent_mode_enabled);
      } catch (e) {}
    })();
  }, []);
  return (
    <button
      onClick={async () => {
        const next = !enabled;
        setEnabled(next);
        try {
          await api('/api/agent-mode', { method: 'POST', body: JSON.stringify({ enabled: next }) });
        } catch (e) {
          setEnabled(!next);
        }
      }}
      className={`px-3 py-2 rounded-lg text-white ${enabled ? 'bg-green-600' : 'bg-gray-600'}`}
      title="Agent Mode"
    >
      {enabled ? 'Agent: On' : 'Agent: Off'}
    </button>
  );
}
