import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

export default function RepliesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [replies, setReplies] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedReply, setSelectedReply] = useState(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    fetchCampaignData();
  }, [id, filter]);

  const fetchCampaignData = async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      // Fetch campaign details
      const campaignResponse = await fetch(`${BACKEND_URL}/api/sourcing/campaigns/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!campaignResponse.ok) throw new Error('Failed to fetch campaign');
      const campaignData = await campaignResponse.json();
      setCampaign(campaignData);
      
      // Fetch leads for this campaign
      const leadsResponse = await fetch(`${BACKEND_URL}/api/sourcing/campaigns/${id}/leads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!leadsResponse.ok) throw new Error('Failed to fetch leads');
      const leadsData = await leadsResponse.json();
      setLeads(leadsData.leads || []);
      
      // Fetch replies (we'll need to add this endpoint)
      const repliesResponse = await fetch(`${BACKEND_URL}/api/sourcing/campaigns/${id}/replies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (repliesResponse.ok) {
        const repliesData = await repliesResponse.json();
        setReplies(repliesData.replies || []);
      }
      
    } catch (err) {
      setError(err.message);
      console.error('Error fetching campaign data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReplyAction = async (replyId, action, leadId) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      let endpoint;
      let method = 'POST';
      let body = {};
      
      switch (action) {
        case 'draft_with_rex':
          // This would integrate with REX to draft a response
          console.log('Draft with REX for reply:', replyId);
          // For now, just show a placeholder
          alert('REX integration coming soon! This will open REX to draft a personalized response.');
          return;
          
        case 'book_demo':
          endpoint = `${BACKEND_URL}/api/sourcing/replies/${replyId}/book-demo`;
          body = { lead_id: leadId };
          break;
          
        case 'disqualify':
          endpoint = `${BACKEND_URL}/api/sourcing/replies/${replyId}/disqualify`;
          body = { lead_id: leadId };
          break;
          
        default:
          throw new Error('Unknown action');
      }
      
      const response = await fetch(endpoint, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) throw new Error(`Failed to ${action}`);
      
      // Refresh data
      await fetchCampaignData();
      
    } catch (err) {
      setError(err.message);
      console.error(`Error ${action}:`, err);
    }
  };

  const getClassificationBadge = (classification) => {
    const classificationConfig = {
      positive: { color: 'bg-green-500', text: '🟢 Positive', textColor: 'text-green-100' },
      neutral: { color: 'bg-yellow-500', text: '🟡 Neutral', textColor: 'text-yellow-100' },
      negative: { color: 'bg-red-500', text: '🔴 Negative', textColor: 'text-red-100' },
      oos: { color: 'bg-gray-500', text: '🟤 Out of Scope', textColor: 'text-gray-100' },
      auto: { color: 'bg-blue-500', text: '🤖 Auto Reply', textColor: 'text-blue-100' }
    };
    
    const config = classificationConfig[classification] || { 
      color: 'bg-gray-500', 
      text: classification, 
      textColor: 'text-gray-100' 
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color} ${config.textColor}`}>
        {config.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupRepliesByLead = () => {
    const grouped = {};
    
    replies.forEach(reply => {
      if (!grouped[reply.lead_id]) {
        const lead = leads.find(l => l.id === reply.lead_id);
        grouped[reply.lead_id] = {
          lead: lead || { name: 'Unknown Lead', email: reply.email_from },
          replies: []
        };
      }
      grouped[reply.lead_id].replies.push(reply);
    });
    
    // Sort replies within each lead by date
    Object.values(grouped).forEach(group => {
      group.replies.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
    });
    
    return grouped;
  };

  const filteredReplies = () => {
    if (filter === 'all') return groupRepliesByLead();
    
    const filtered = {};
    const grouped = groupRepliesByLead();
    
    Object.entries(grouped).forEach(([leadId, group]) => {
      const matchingReplies = group.replies.filter(reply => 
        filter === 'all' || reply.classified_as === filter
      );
      
      if (matchingReplies.length > 0) {
        filtered[leadId] = {
          ...group,
          replies: matchingReplies
        };
      }
    });
    
    return filtered;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading replies...</p>
        </div>
      </div>
    );
  }

  const groupedReplies = filteredReplies();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/super-admin/sourcing/campaigns/${id}`)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Campaign
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Campaign Replies</h1>
              <p className="text-gray-400 mt-1">
                {campaign?.title} • {Object.keys(groupedReplies).length} leads with replies
              </p>
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="mt-4 flex space-x-2">
          {['all', 'positive', 'neutral', 'negative', 'oos', 'auto'].map((classification) => (
            <button
              key={classification}
              onClick={() => setFilter(classification)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === classification
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {classification === 'all' ? 'All Replies' : 
               classification === 'oos' ? 'Out of Scope' :
               classification.charAt(0).toUpperCase() + classification.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error loading replies</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {Object.keys(groupedReplies).length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-6xl mb-4">💬</div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">No replies found</h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? "No replies have been received for this campaign yet"
                : `No ${filter} replies found`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedReplies).map(([leadId, group]) => (
              <div key={leadId} className="bg-gray-800 rounded-lg border border-gray-700">
                {/* Lead Header */}
                <div className="p-4 border-b border-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {group.lead.name || 'Unknown Lead'}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {group.lead.title && `${group.lead.title} at `}
                        {group.lead.company || group.lead.email}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {group.replies.length} reply{group.replies.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Latest Reply</div>
                      <div className="text-white">
                        {formatDate(group.replies[0].received_at)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Replies Thread */}
                <div className="p-4 space-y-4">
                  {group.replies.map((reply, index) => (
                    <div key={reply.id} className="border border-gray-600 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-3">
                          {getClassificationBadge(reply.classified_as)}
                          <span className="text-gray-400 text-sm">
                            {formatDate(reply.received_at)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleReplyAction(reply.id, 'draft_with_rex', leadId)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            🤖 Draft with REX
                          </button>
                          {reply.classified_as === 'positive' && (
                            <button
                              onClick={() => handleReplyAction(reply.id, 'book_demo', leadId)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                            >
                              📅 Book Demo
                            </button>
                          )}
                          <button
                            onClick={() => handleReplyAction(reply.id, 'disqualify', leadId)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            ❌ Disqualify
                          </button>
                        </div>
                      </div>
                      
                      {reply.subject && (
                        <div className="mb-2">
                          <div className="text-sm text-gray-400 mb-1">Subject:</div>
                          <div className="text-white font-medium">{reply.subject}</div>
                        </div>
                      )}
                      
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Message:</div>
                        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {reply.body}
                        </div>
                      </div>
                      
                      {reply.next_action && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="text-sm text-gray-400">Suggested Action:</div>
                          <div className="text-yellow-400 font-medium capitalize">
                            {reply.next_action.replace('_', ' ')}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
