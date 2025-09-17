import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    fetchCampaigns();
  }, [filter]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      let url = `${BACKEND_URL}/api/sourcing/campaigns`;
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      draft: 'bg-gray-500',
      scheduled: 'bg-blue-500',
      running: 'bg-green-500',
      paused: 'bg-yellow-500',
      completed: 'bg-purple-500'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${statusColors[status] || 'bg-gray-500'}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Sourcing Campaigns</h1>
            <p className="text-gray-400 mt-1">Manage AI-powered sourcing campaigns and email sequences</p>
          </div>
          <button
            onClick={() => navigate('/super-admin/sourcing/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + New Campaign
          </button>
        </div>
        
        {/* Filters */}
        <div className="mt-4 flex space-x-2">
          {['all', 'draft', 'scheduled', 'running', 'paused', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error loading campaigns</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-6xl mb-4">📧</div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">No campaigns found</h3>
            <p className="text-gray-500 mb-6">
              {filter === 'all' 
                ? "Get started by creating your first sourcing campaign"
                : `No campaigns with status "${filter}"`
              }
            </p>
            <button
              onClick={() => navigate('/super-admin/sourcing/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Create First Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                onClick={() => navigate(`/super-admin/sourcing/campaigns/${campaign.id}`)}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1 line-clamp-2">
                        {campaign.title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        Created {formatDate(campaign.created_at)}
                      </p>
                    </div>
                    {getStatusBadge(campaign.status)}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {campaign.stats?.total_leads || 0}
                      </div>
                      <div className="text-xs text-gray-500">Leads</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {campaign.stats?.emails_sent || 0}
                      </div>
                      <div className="text-xs text-gray-500">Sent</div>
                    </div>
                  </div>

                  {/* Sender Info */}
                  {campaign.email_senders && (
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 mb-1">Sender</div>
                      <div className="text-sm text-gray-300">
                        {campaign.email_senders.from_name} 
                        <span className="text-gray-500 ml-1">
                          &lt;{campaign.email_senders.from_email}&gt;
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Audience Tag */}
                  {campaign.audience_tag && (
                    <div className="mb-4">
                      <span className="inline-block bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">
                        {campaign.audience_tag}
                      </span>
                    </div>
                  )}

                  {/* Reply Stats */}
                  {campaign.stats?.replies_received > 0 && (
                    <div className="border-t border-gray-700 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Replies</span>
                        <span className="text-white font-medium">
                          {campaign.stats.replies_received}
                        </span>
                      </div>
                      {campaign.stats.positive_replies > 0 && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-gray-400">Positive</span>
                          <span className="text-green-400 font-medium">
                            {campaign.stats.positive_replies}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-gray-700 px-6 py-3">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/super-admin/sourcing/campaigns/${campaign.id}/replies`);
                      }}
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                    >
                      View Replies
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/super-admin/sourcing/campaigns/${campaign.id}`);
                      }}
                      className="text-gray-400 hover:text-white text-sm transition-colors"
                    >
                      Manage →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
