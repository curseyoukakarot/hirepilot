import React, { useState, useEffect } from 'react';
import LogActivityModal from './LogActivityModal';
import { supabase } from '../lib/supabase';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function ActivityLogSection({ lead, onActivityAdded }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  // Helper to get auth headers
  const getAuthHeaders = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  };

  // Fetch activities for the lead
  useEffect(() => {
    if (lead?.id) {
      fetchActivities();
    }
  }, [lead?.id]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError('');
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/lead-activities?lead_id=${lead.id}`, {
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
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
  };

  const handleActivityAdded = (newActivity) => {
    // Add the new activity to the top of the list
    setActivities(prev => [newActivity, ...prev]);
    setShowModal(false);
    
    // Notify parent component if callback provided
    if (onActivityAdded) {
      onActivityAdded(newActivity);
    }
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

  const handleDeleteActivity = async (activityId) => {
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
  };

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
          onClose={() => setShowModal(false)}
          onActivityAdded={handleActivityAdded}
        />
      )}
    </div>
  );
}