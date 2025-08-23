import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      const response = await fetch(`${BACKEND_URL}/api/sourcing/campaigns/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch campaign');
      
      const data = await response.json();
      setCampaign(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignAction = async (action) => {
    try {
      setActionLoading(action);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      let endpoint;
      switch (action) {
        case 'schedule':
          endpoint = `${BACKEND_URL}/api/sourcing/campaigns/${id}/schedule`;
          break;
        case 'pause':
          endpoint = `${BACKEND_URL}/api/sourcing/campaigns/${id}/pause`;
          break;
        case 'resume':
          endpoint = `${BACKEND_URL}/api/sourcing/campaigns/${id}/resume`;
          break;
        default:
          throw new Error('Unknown action');
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error(`Failed to ${action} campaign`);
      
      // Refresh campaign data
      await fetchCampaign();
    } catch (err) {
      setError(err.message);
      console.error(`Error ${action} campaign:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { color: 'bg-gray-500', text: 'Draft' },
      scheduled: { color: 'bg-blue-500', text: 'Scheduled' },
      running: { color: 'bg-green-500', text: 'Running' },
      paused: { color: 'bg-yellow-500', text: 'Paused' },
      completed: { color: 'bg-purple-500', text: 'Completed' }
    };
    
    const config = statusConfig[status] || { color: 'bg-gray-500', text: status };
    
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Campaign Not Found</h2>
          <p className="text-gray-400 mb-6">{error || 'The requested campaign could not be found.'}</p>
          <button
            onClick={() => navigate('/super-admin/sourcing')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/super-admin/sourcing')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
              <div className="flex items-center space-x-4 mt-2">
                {getStatusBadge(campaign.status)}
                <span className="text-gray-400 text-sm">
                  Created {formatDate(campaign.created_at)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex space-x-3">
            {campaign.status === 'draft' && (
              <button
                onClick={() => handleCampaignAction('schedule')}
                disabled={actionLoading === 'schedule'}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {actionLoading === 'schedule' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>🚀 Launch Campaign</span>
              </button>
            )}
            
            {campaign.status === 'running' && (
              <button
                onClick={() => handleCampaignAction('pause')}
                disabled={actionLoading === 'pause'}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {actionLoading === 'pause' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>⏸️ Pause</span>
              </button>
            )}
            
            {campaign.status === 'paused' && (
              <button
                onClick={() => handleCampaignAction('resume')}
                disabled={actionLoading === 'resume'}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {actionLoading === 'resume' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>▶️ Resume</span>
              </button>
            )}
            
            <button
              onClick={() => navigate(`/super-admin/sourcing/campaigns/${id}/replies`)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              📧 View Replies
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Metrics */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Performance Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {campaign.stats?.total_leads || 0}
                  </div>
                  <div className="text-sm text-gray-400">Total Leads</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {campaign.stats?.emails_sent || 0}
                  </div>
                  <div className="text-sm text-gray-400">Emails Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-400">
                    {campaign.stats?.replies_received || 0}
                  </div>
                  <div className="text-sm text-gray-400">Replies</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">
                    {campaign.stats?.positive_replies || 0}
                  </div>
                  <div className="text-sm text-gray-400">Positive</div>
                </div>
              </div>
              
              {/* Reply Rate */}
              {campaign.stats?.emails_sent > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Reply Rate</span>
                    <span className="text-lg font-semibold text-white">
                      {((campaign.stats.replies_received / campaign.stats.emails_sent) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Email Sequence Preview */}
            {campaign.sourcing_sequences && campaign.sourcing_sequences.length > 0 && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Email Sequence</h2>
                <div className="space-y-4">
                  {Object.entries(campaign.sourcing_sequences[0].steps_json).map(([step, content], index) => {
                    if (step === 'spacingBusinessDays') return null;
                    
                    return (
                      <div key={step} className="border border-gray-600 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                            Step {index + 1}
                          </span>
                          {index > 0 && (
                            <span className="text-gray-400 text-sm">
                              +{campaign.sourcing_sequences[0].steps_json.spacingBusinessDays * index} business days
                            </span>
                          )}
                        </div>
                        <div className="mb-2">
                          <div className="text-sm text-gray-400 mb-1">Subject:</div>
                          <div className="text-white font-medium">{content.subject}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Body:</div>
                          <div className="text-gray-300 text-sm leading-relaxed">
                            {content.body.substring(0, 200)}
                            {content.body.length > 200 && '...'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Campaign Details */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Campaign Details</h2>
              <div className="space-y-3">
                {campaign.audience_tag && (
                  <div>
                    <div className="text-sm text-gray-400">Audience Tag</div>
                    <div className="text-white">{campaign.audience_tag}</div>
                  </div>
                )}
                
                {campaign.email_senders && (
                  <div>
                    <div className="text-sm text-gray-400">Email Sender</div>
                    <div className="text-white">
                      {campaign.email_senders.from_name}
                      <div className="text-gray-400 text-sm">
                        {campaign.email_senders.from_email}
                      </div>
                      {campaign.email_senders.domain_verified && (
                        <span className="inline-block bg-green-600 text-white text-xs px-2 py-1 rounded-full mt-1">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm text-gray-400">Created</div>
                  <div className="text-white">{formatDate(campaign.created_at)}</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/super-admin/sourcing/campaigns/${id}/leads`)}
                  className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition-colors"
                >
                  <div className="text-white font-medium">View Leads</div>
                  <div className="text-gray-400 text-sm">
                    {campaign.stats?.total_leads || 0} leads in campaign
                  </div>
                </button>
                
                <button
                  onClick={() => navigate(`/super-admin/sourcing/campaigns/${id}/replies`)}
                  className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition-colors"
                >
                  <div className="text-white font-medium">Manage Replies</div>
                  <div className="text-gray-400 text-sm">
                    {campaign.stats?.replies_received || 0} replies received
                  </div>
                </button>
                
                <button
                  onClick={() => navigate(`/super-admin/sourcing/campaigns/${id}/analytics`)}
                  className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition-colors"
                >
                  <div className="text-white font-medium">Analytics</div>
                  <div className="text-gray-400 text-sm">Detailed performance metrics</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
