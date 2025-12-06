import React, { useState, useEffect, useCallback } from 'react';
import LogActivityModal from './LogActivityModal';
import { supabase } from '../lib/supabaseClient';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function ActivityLogSection({ lead, onActivityAdded, entityType = 'lead' }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailEvents, setEmailEvents] = useState([]);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  // Helper to get auth headers - memoized to prevent recreating on every render
  const getAuthHeaders = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }, []);

  // Fetch activities for the lead - memoized to prevent unnecessary API calls
  const fetchActivities = useCallback(async () => {
    // Use unified activities endpoint
    const resolvedLeadId = entityType === 'lead' ? (lead?.id) : (lead?.lead_id);
    const candidateId = entityType === 'candidate' ? (lead?.id) : null;

    let url = null;
    if (resolvedLeadId) {
      url = `${API_BASE_URL}/activities?entity_type=lead&entity_id=${encodeURIComponent(resolvedLeadId)}`;
    } else if (candidateId) {
      url = `${API_BASE_URL}/activities?entity_type=candidate&entity_id=${encodeURIComponent(candidateId)}`;
    } else {
      setActivities([]);
      setLoading(false);
      setError('');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const headers = await getAuthHeaders();
      const response = await fetch(url, {
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Graceful fallback: treat as no activities available
          setActivities([]);
          setError('');
          return;
        }
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setActivities(data.activities || []);
      } else {
        setError(data.message || 'Failed to load activities');
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Unable to load activity history');
    } finally {
      setLoading(false);
    }
  }, [entityType, lead?.id, lead?.lead_id, getAuthHeaders]);

  const fetchEmailEvents = useCallback(async () => {
    if (!lead?.id) {
      setEmailEvents([]);
      setEmailLoading(false);
      return;
    }
    try {
      setEmailLoading(true);
      setEmailError('');
      const { data, error } = await supabase
        .from('email_events')
        .select('id,event_type,event_timestamp,provider,campaign_id,message_id')
        .eq('lead_id', lead.id)
        .order('event_timestamp', { ascending: false })
        .limit(10);
      if (error) throw error;
      setEmailEvents(data || []);
    } catch (err) {
      console.error('Error fetching email events:', err);
      setEmailError('Unable to load email events');
    } finally {
      setEmailLoading(false);
    }
  }, [lead?.id]);

  // Fetch activities when lead changes
  useEffect(() => {
    fetchActivities();
    fetchEmailEvents();
  }, [fetchActivities, fetchEmailEvents]);

  const handleActivityAdded = (newActivity) => {
    // Add the new activity to the top of the list
    setActivities(prev => [newActivity, ...prev]);
    setShowModal(false);
    
    // Notify parent component if callback provided
    if (onActivityAdded) {
      onActivityAdded(newActivity);
    }
    // After logging, refetch from server to ensure persistence across reloads
    fetchActivities();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      // Today: Show "Aug 7, 3:14 PM"
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 24 * 365) {
      // This year: Show "Aug 7, 3:14 PM"
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      // Previous years: Show "Aug 7, 2024, 3:14 PM"
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const handleDeleteActivity = useCallback(async (activityId) => {
    if (!confirm('Are you sure you want to delete this activity?')) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/lead-activities/${activityId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete activity: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Remove the activity from the list
        setActivities(prev => prev.filter(activity => activity.id !== activityId));
      } else {
        throw new Error(data.message || 'Failed to delete activity');
      }
    } catch (err) {
      console.error('Error deleting activity:', err);
      alert('Failed to delete activity. Please try again.');
    }
  }, [getAuthHeaders]);

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'Call':
        return '📞';
      case 'Meeting':
        return '🤝';
      case 'Outreach':
        return '📨';
      case 'Email':
        return '✉️';
      case 'LinkedIn':
        return '💼';
      case 'Note':
        return '📝';
      default:
        return '📋';
    }
  };

  const getActivityColor = (activityType) => {
    switch (activityType) {
      case 'Call':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'Meeting':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Outreach':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'Email':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'LinkedIn':
        return 'text-blue-700 bg-blue-50 border-blue-300';
      case 'Note':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getEmailEventIcon = (eventType) => {
    switch ((eventType || '').toLowerCase()) {
      case 'sent':
        return '📤';
      case 'delivered':
        return '✅';
      case 'opened':
        return '👁️';
      case 'clicked':
        return '🖱️';
      case 'replied':
        return '💬';
      case 'bounced':
        return '⚠️';
      default:
        return '✉️';
    }
  };

  const formatEventLabel = (eventType) => {
    if (!eventType) return 'Email';
    return eventType.charAt(0).toUpperCase() + eventType.slice(1);
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center">
          📓 Activity Log
        </h3>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          title="Log new activity"
        >
          ➕ Log Activity
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <i className="fa-solid fa-exclamation-triangle text-red-500 mr-2"></i>
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Email Events */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            ✉️ Recent Email Events
          </h4>
        </div>
        {emailError && <div className="text-xs text-red-500 mb-2">{emailError}</div>}
        {emailLoading ? (
          <div className="flex items-center text-sm text-gray-500 gap-2">
            <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            Loading email events...
          </div>
        ) : emailEvents.length === 0 ? (
          <p className="text-xs text-gray-400">No recent email activity yet.</p>
        ) : (
          <div className="space-y-2">
            {emailEvents.map(event => (
              <div key={event.id} className="flex items-start space-x-3 p-2 rounded-lg bg-white border">
                <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                  {getEmailEventIcon(event.event_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {formatEventLabel(event.event_type)}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(event.event_timestamp)}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-1 flex-wrap">
                    {event.provider && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {event.provider}
                      </span>
                    )}
                    {event.campaign_id && (
                      <span className="text-gray-400">Campaign: {String(event.campaign_id).slice(0, 8)}</span>
                    )}
                    {event.message_id && (
                      <span className="text-gray-400">Msg: {String(event.message_id).slice(0, 6)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <span className="ml-2 text-gray-600">Loading activities...</span>
        </div>
      )}

      {/* Activities List */}
      {!loading && !error && (
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-300 mb-2 text-2xl">📝</div>
              <p className="text-gray-500 text-sm mb-2">No activity yet</p>
              <p className="text-gray-400 text-xs mb-4">Start logging touchpoints to track engagement history</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                ➕ Log First Activity
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-2.5 rounded-lg bg-gray-50 border hover:bg-gray-100 transition-colors group">
                  {/* Activity Icon */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border ${getActivityColor(activity.activity_type)}`}>
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  
                  {/* Activity Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 text-sm">{activity.activity_type}</span>
                        {activity.tags && activity.tags.length > 0 && (
                          <div className="flex space-x-1">
                            {activity.tags.map((tag, idx) => (
                              <span 
                                key={idx}
                                className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{formatDate(activity.activity_timestamp)}</span>
                        <button
                          onClick={() => handleDeleteActivity(activity.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all duration-200 p-1"
                          title="Delete activity"
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                    
                    {activity.notes && (
                      <p className="text-sm text-gray-600 mt-1 break-words">{activity.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log Activity Modal */}
      {showModal && (
        <LogActivityModal
          lead={lead}
          entityType={entityType}
          onClose={() => setShowModal(false)}
          onActivityAdded={handleActivityAdded}
        />
      )}
    </div>
  );
}