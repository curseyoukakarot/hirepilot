import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import AgentModeSwitch from '../../components/admin/sourcing/AgentModeSwitch';

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

export default function CampaignsPanel() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      // Restrict to the logged-in user to avoid cross-account bleed
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      const resp = await api(`/api/sourcing/campaigns${userId ? `?created_by=${userId}` : ''}`);
      const list: Campaign[] = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any)?.campaigns)
          ? (resp as any).campaigns
          : [];
      setRows(list);

      const statsPromises = list.map(async (campaign: Campaign) => {
        try {
          const campaignStats = await api(`/api/sourcing/campaigns/${campaign.id}/stats`);
          return { id: campaign.id, stats: campaignStats };
        } catch (err) {
          return { id: campaign.id, stats: null } as any;
        }
      });
      const statsResults = await Promise.all(statsPromises);
      const statsMap: Record<string, CampaignStats> = {};
      statsResults.forEach(({ id, stats }) => { if (stats) statsMap[id] = stats; });
      setStats(statsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCampaigns(); }, []);

  const filteredCampaigns = rows.filter(campaign => filter === 'all' || campaign.status === filter);

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

  return (
    <div>
      {/* Filters + Refresh */}
      <div className="flex items-center justify-between mb-4">
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
        <div className="flex items-center space-x-3">
          <AgentModeSwitch />
          <button onClick={loadCampaigns} className="bg-gray-700 text-white px-3 py-1 rounded-lg text-sm">Refresh</button>
        </div>
      </div>

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
            <Link to="/rex-chat" className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
              🤖 Chat with REX to Start
            </Link>
          </div>
        ) : (
          filteredCampaigns.map(campaign => {
            const campaignStats = stats[campaign.id];
            return (
              <div
                key={campaign.id}
                role="button"
                onClick={()=>navigate(`/agent/campaign/${campaign.id}`)}
                className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800/70 p-6 hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg group-hover:text-blue-300 transition-colors">{campaign.title}</h3>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </span>
                      {campaign.audience_tag && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">{campaign.audience_tag}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-gray-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
                {campaignStats && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-sm text-gray-300">
                    <div>
                      <div className="text-xl font-bold text-white">{campaignStats.total_leads}</div>
                      <div className="text-xs text-gray-400">Total Leads</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-400">{campaignStats.emails_sent}</div>
                      <div className="text-xs text-gray-400">Emails Sent</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-400">{campaignStats.replies_received}</div>
                      <div className="text-xs text-gray-400">Replies</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-yellow-400">{campaignStats.positive_replies}</div>
                      <div className="text-xs text-gray-400">Positive</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


