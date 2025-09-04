import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

export default function ActionInbox() {
  const [cards, setCards] = useState([]);
  const [inputs, setInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, unread: 0 });

  // Get current user ID from Supabase
  const getCurrentUserId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || '';
  }, []);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      
      if (filter === 'unread') {
        queryParams.append('unread_only', 'true');
      }
      queryParams.append('limit', '50');

      const data = await api(`/api/notifications?${queryParams.toString()}`);
      setCards(data.notifications || data);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Load notification statistics
  const loadStats = useCallback(async () => {
    try {
      const data = await api('/api/notifications/stats');
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, []);

  // Handle user interaction with notification actions
  const interact = async (card, action, data = {}) => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');
      // Prepare interaction data
      const interactionData = {
        user_id: userId,
        source: 'inapp',
        thread_key: card.thread_key,
        action_type: action.type === 'input' ? 'input' : 
                     action.type === 'select' ? 'select' :
                     action.type === 'chips' ? 'chips' : 'button',
        action_id: action.id,
        data: action.type === 'input' ? 
              { text: inputs[card.id] || '' } : 
              data
      };

      // Send interaction to backend
      await api('/api/agent-interactions', { method: 'POST', body: JSON.stringify(interactionData) });

      // Mark notification as read
      await api(`/api/notifications/${card.id}/read`, { method: 'PATCH' });

      // Optimistically remove card from UI
      setCards(prev => prev.filter(c => c.id !== card.id));
      
      // Clear input for this card
      setInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[card.id];
        return newInputs;
      });

      // Refresh stats
      loadStats();

      console.log(`✅ Interaction recorded: ${action.id} for card ${card.id}`);
    } catch (err) {
      console.error('Error recording interaction:', err);
      setError(`Failed to process action: ${err.message}`);
    }
  };

  // Handle input changes
  const handleInputChange = (cardId, value) => {
    setInputs(prev => ({
      ...prev,
      [cardId]: value
    }));
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'PATCH' });

      // Refresh notifications
      loadNotifications();
      loadStats();
    } catch (err) {
      console.error('Error marking all as read:', err);
      setError(`Failed to mark all as read: ${err.message}`);
    }
  };

  // Load data on component mount and filter change
  useEffect(() => {
    loadNotifications();
    loadStats();
  }, [loadNotifications, loadStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadNotifications();
      loadStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadNotifications, loadStats]);

  // Render action button
  const renderAction = (card, action) => {
    const baseClasses = "px-3 py-2 rounded-lg font-medium transition-colors text-sm";
    
    if (action.type === 'button') {
      const styleClasses = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
        danger: 'bg-red-600 hover:bg-red-700 text-white'
      };
      
      const buttonClass = `${baseClasses} ${styleClasses[action.style] || styleClasses.primary}`;
      
      return (
        <button
          key={action.id}
          className={buttonClass}
          onClick={() => interact(card, action)}
          disabled={action.disabled}
        >
          {action.label || action.id}
        </button>
      );
    }

    if (action.type === 'input') {
      return (
        <div key={action.id} className="flex items-center gap-2 flex-1">
          <input
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder={action.placeholder || 'Type here...'}
            value={inputs[card.id] || ''}
            onChange={(e) => handleInputChange(card.id, e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                interact(card, action);
              }
            }}
          />
          <button
            className={`${baseClasses} bg-blue-600 hover:bg-blue-700 text-white`}
            onClick={() => interact(card, action)}
            disabled={!inputs[card.id]?.trim()}
          >
            {action.label || 'Send'}
          </button>
        </div>
      );
    }

    if (action.type === 'chips') {
      return (
        <div key={action.id} className="flex flex-wrap gap-2">
          {(action.options || []).map(option => (
            <button
              key={option}
              className="px-3 py-1 rounded-full border border-slate-600 text-gray-200 hover:border-blue-500 hover:text-blue-300 transition-colors text-sm"
              onClick={() => interact(card, { ...action, type: 'button', id: `${action.id}:${option}` }, { selected_option: option })}
            >
              {option}
            </button>
          ))}
        </div>
      );
    }

    if (action.type === 'select') {
      return (
        <div key={action.id} className="flex items-center gap-2">
          <select
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:border-blue-500 focus:outline-none"
            onChange={(e) => interact(card, action, { selected_option: e.target.value })}
            defaultValue=""
          >
            <option value="" disabled>
              {action.label || 'Select an option'}
            </option>
            {(action.options || []).map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return null;
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading notifications...</p>
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
            <h1 className="text-2xl font-bold text-white">Action Inbox</h1>
            <p className="text-gray-400 mt-1">
              {stats.unread > 0 ? `${stats.unread} unread notifications` : 'All caught up!'}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {stats.unread > 0 && (
              <button
                onClick={markAllAsRead}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Mark All Read
              </button>
            )}
            <button
              onClick={() => {
                loadNotifications();
                loadStats();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="mt-4 flex space-x-2">
          {['all', 'unread', 'sourcing_reply', 'sourcing_campaign'].map((filterType) => (
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
               filterType === 'unread' ? 'Unread' :
               filterType === 'sourcing_reply' ? 'Replies' :
               filterType === 'sourcing_campaign' ? 'Campaigns' :
               filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {cards.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-6xl mb-4">📬</div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </h3>
            <p className="text-gray-500">
              {filter === 'unread' 
                ? "You're all caught up! New notifications will appear here."
                : "When you have actionable notifications, they'll appear here."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map(card => (
              <div
                key={card.id}
                className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6 hover:border-slate-600 transition-colors"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg">{card.title}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      {card.type && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                          {card.type.replace('_', ' ')}
                        </span>
                      )}
                      <span className="text-gray-400 text-sm">
                        {formatRelativeTime(card.created_at)}
                      </span>
                      {card.thread_key && (
                        <span className="text-gray-500 text-xs">
                          {card.thread_key}
                        </span>
                      )}
                    </div>
                  </div>
                  {!card.read_at && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>

                {/* Body */}
                {card.body_md && (
                  <div className="mt-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {card.body_md}
                  </div>
                )}

                {/* Actions */}
                {card.actions && card.actions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {card.actions.map(action => renderAction(card, action))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
