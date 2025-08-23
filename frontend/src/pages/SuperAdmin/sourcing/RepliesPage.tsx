import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';

type Reply = {
  id: string;
  campaign_id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  subject?: string;
  body?: string;
  email_from?: string;
  email_to?: string;
  received_at: string;
  classified_as?: string;
  next_action?: string;
  lead?: {
    id: string;
    name?: string;
    email?: string;
    title?: string;
    company?: string;
  };
};

export default function RepliesPage() {
  const { id } = useParams<{ id: string }>();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadReplies = async () => {
    try {
      setLoading(true);
      setError(null);
      const repliesData = await api(`/api/sourcing/campaigns/${id}/replies`);
      setReplies(repliesData);
    } catch (err) {
      console.error('Error loading replies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load replies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadReplies();
    }
  }, [id]);

  const handleAction = async (reply: Reply, actionId: string) => {
    try {
      setActionLoading(`${reply.id}-${actionId}`);
      
      await api('/api/agent-interactions', {
        method: 'POST',
        body: JSON.stringify({
          user_id: 'current-user', // TODO: Replace with actual user ID
          source: 'inapp',
          thread_key: `sourcing:${reply.campaign_id}:${reply.lead_id}`,
          action_type: 'button',
          action_id: actionId,
          data: { 
            reply_id: reply.id,
            lead_email: reply.lead?.email,
            classification: reply.classified_as
          }
        })
      });

      // Handle specific actions
      if (actionId === 'book_meeting') {
        // Call the book demo endpoint if it exists
        try {
          await api(`/api/sourcing/replies/${reply.id}/book-demo`, { method: 'POST' });
        } catch (bookingErr) {
          console.warn('Book demo endpoint not available:', bookingErr);
        }
      } else if (actionId === 'disqualify') {
        // Call the disqualify endpoint if it exists
        try {
          await api(`/api/sourcing/replies/${reply.id}/disqualify`, { method: 'POST' });
        } catch (disqualifyErr) {
          console.warn('Disqualify endpoint not available:', disqualifyErr);
        }
      }

      console.log(`✅ Action ${actionId} recorded for reply ${reply.id}`);
      
      // Reload replies to get updated data
      await loadReplies();
    } catch (err) {
      console.error(`Error handling action ${actionId}:`, err);
      setError(err instanceof Error ? err.message : `Failed to process ${actionId}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter replies based on classification
  const filteredReplies = replies.filter(reply => {
    if (filter === 'all') return true;
    return reply.classified_as === filter;
  });

  // Get classification color
  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'positive': return 'bg-green-600 text-green-100';
      case 'neutral': return 'bg-blue-600 text-blue-100';
      case 'negative': return 'bg-red-600 text-red-100';
      case 'oos': return 'bg-yellow-600 text-yellow-100';
      case 'auto': return 'bg-gray-600 text-gray-100';
      default: return 'bg-gray-600 text-gray-200';
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Truncate email body
  const truncateBody = (body?: string, maxLength: number = 500) => {
    if (!body) return '';
    if (body.length <= maxLength) return body;
    return body.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-700 rounded w-1/4"></div>
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen space-y-6">
      {/* Breadcrumb */}
      <Link 
        to={`/super-admin/sourcing/campaigns/${id}`} 
        className="text-blue-400 hover:underline inline-flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Campaign
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-bold">Campaign Replies</h1>
          <p className="text-gray-400 mt-1">
            Manage and respond to prospect replies
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadReplies}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Refresh
          </button>
          <Link
            to="/rex-chat"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            🤖 Chat with REX
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'positive', 'neutral', 'negative', 'oos', 'auto'].map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === filterType
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {filterType === 'all' ? 'All' : 
             filterType === 'oos' ? 'Out of Scope' :
             filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            {filterType !== 'all' && (
              <span className="ml-1 text-xs opacity-75">
                ({replies.filter(r => r.classified_as === filterType).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Replies List */}
      <div className="space-y-4">
        {filteredReplies.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-6xl mb-4">💬</div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">
              {filter === 'all' ? 'No replies yet' : `No ${filter} replies`}
            </h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? "Replies will appear here as prospects respond to your campaign."
                : `No replies classified as "${filter}" found.`
              }
            </p>
          </div>
        ) : (
          filteredReplies.map(reply => (
            <div key={reply.id} className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6 hover:border-slate-600 transition-colors">
              {/* Reply Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-white font-semibold">
                      {reply.subject || '(no subject)'}
                    </h3>
                    {reply.classified_as && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClassificationColor(reply.classified_as)}`}>
                        {reply.classified_as === 'oos' ? 'Out of Scope' : 
                         reply.classified_as.charAt(0).toUpperCase() + reply.classified_as.slice(1)}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>
                      <strong>From:</strong> {reply.email_from}
                      {reply.lead?.name && ` (${reply.lead.name})`}
                    </div>
                    {reply.lead?.title && reply.lead?.company && (
                      <div>
                        <strong>Contact:</strong> {reply.lead.title} at {reply.lead.company}
                      </div>
                    )}
                    <div>
                      <strong>Received:</strong> {formatRelativeTime(reply.received_at)}
                    </div>
                  </div>
                </div>
                
                <div className="text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Reply Body */}
              {reply.body && (
                <div className="mb-4 p-4 bg-slate-900 rounded-lg border border-slate-600">
                  <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {truncateBody(reply.body, 800)}
                  </div>
                  {reply.body.length > 800 && (
                    <button className="mt-2 text-blue-400 hover:underline text-sm">
                      Show full message
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleAction(reply, 'reply_draft')}
                  disabled={actionLoading === `${reply.id}-reply_draft`}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {actionLoading === `${reply.id}-reply_draft` ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      🤖 Draft with REX
                    </>
                  )}
                </button>

                {reply.classified_as === 'positive' && (
                  <button
                    onClick={() => handleAction(reply, 'book_meeting')}
                    disabled={actionLoading === `${reply.id}-book_meeting`}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading === `${reply.id}-book_meeting` ? 'Booking...' : '📅 Book Meeting'}
                  </button>
                )}

                <button
                  onClick={() => handleAction(reply, 'disqualify')}
                  disabled={actionLoading === `${reply.id}-disqualify`}
                  className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === `${reply.id}-disqualify` ? 'Processing...' : '❌ Disqualify'}
                </button>

                <Link
                  to={`mailto:${reply.email_from}?subject=Re: ${reply.subject || 'Your inquiry'}`}
                  className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-colors"
                >
                  📧 Reply Directly
                </Link>
              </div>

              {/* Next Action Suggestion */}
              {reply.next_action && (
                <div className="mt-3 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                  <div className="text-sm text-blue-200">
                    <strong>AI Suggestion:</strong> {reply.next_action}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {replies.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">Reply Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{replies.length}</div>
              <div className="text-sm text-gray-400">Total Replies</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {replies.filter(r => r.classified_as === 'positive').length}
              </div>
              <div className="text-sm text-gray-400">Positive</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {replies.filter(r => r.classified_as === 'neutral').length}
              </div>
              <div className="text-sm text-gray-400">Neutral</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">
                {replies.filter(r => r.classified_as === 'negative').length}
              </div>
              <div className="text-sm text-gray-400">Negative</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                {replies.filter(r => r.classified_as === 'oos').length}
              </div>
              <div className="text-sm text-gray-400">Out of Scope</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">
                {replies.filter(r => r.classified_as === 'auto').length}
              </div>
              <div className="text-sm text-gray-400">Auto-Reply</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
