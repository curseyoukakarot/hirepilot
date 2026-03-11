import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

// ── Type → icon/color mapping ──

const TYPE_META = {
  sourcing_reply:    { icon: '\uD83D\uDCAC', label: 'Reply',          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',     badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  health_alert:      { icon: '\u26A0\uFE0F', label: 'Health Alert',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  milestone:         { icon: '\uD83C\uDF89', label: 'Milestone',      color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  reply_draft:       { icon: '\u270F\uFE0F', label: 'Draft',          color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  meeting_draft:     { icon: '\uD83D\uDCC5', label: 'Meeting',        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  sourcing_campaign: { icon: '\uD83D\uDCCA', label: 'Campaign',       color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',       badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  sourcing_sequence: { icon: '\uD83D\uDCDD', label: 'Sequence',       color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',       badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  snooze_reminder:   { icon: '\u23F0',       label: 'Reminder',       color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
};

function getTypeMeta(type) {
  return TYPE_META[type] || { icon: '\uD83D\uDD14', label: type?.replace(/_/g, ' ') || 'Notification', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
}

// ── Relative time ──

function formatRelativeTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Filter tabs ──

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'sourcing_reply', label: 'Replies' },
  { key: 'health_alert', label: 'Health Alerts' },
  { key: 'milestone', label: 'Milestones' },
  { key: 'reply_draft', label: 'Drafts' },
  { key: 'sourcing_campaign', label: 'Campaigns' },
];

// ── Action button styles ──

const ACTION_STYLES = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

// ── Component ──

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState({ total: 0, unread: 0, by_type: {} });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState({});

  const getCurrentUserId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || '';
  }, []);

  // Fetch notifications
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (filter === 'unread') {
        params.append('unread_only', 'true');
      } else if (filter !== 'all') {
        params.append('type', filter);
      }
      const data = await api(`/api/notifications?${params.toString()}`);
      setCards(data?.notifications || data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Fetch stats
  const loadStats = useCallback(async () => {
    try {
      const data = await api('/api/notifications/stats');
      setStats(data || { total: 0, unread: 0, by_type: {} });
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, [loadNotifications, loadStats]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      loadNotifications();
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications, loadStats]);

  // Mark single as read
  const markRead = async (card) => {
    try {
      await api(`/api/notifications/${card.id}/read`, { method: 'PATCH' });
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, read_at: new Date().toISOString() } : c)));
      setStats((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch {}
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'PATCH' });
      setCards((prev) => prev.map((c) => ({ ...c, read_at: c.read_at || new Date().toISOString() })));
      setStats((prev) => ({ ...prev, unread: 0 }));
      toast.success('All notifications marked as read');
    } catch {}
  };

  // Handle interaction
  const interact = async (card, action, extraData = {}) => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const meta = card?.metadata || {};

      const interactionData = {
        user_id: userId,
        source: 'inapp',
        action_type: action.type === 'input' ? 'input' : action.type === 'select' ? 'select' : action.type === 'chips' ? 'chips' : 'button',
        action_id: action.id,
        thread_key: card.thread_key,
        data: action.type === 'input'
          ? { text: inputs[card.id] || '' }
          : {
              ...extraData,
              reply_id: meta.reply_id || null,
              lead_id: meta.lead_id || null,
              campaign_id: meta.campaign_id || null,
              lead_email: meta.from_email || meta.lead_email || null,
            },
      };

      await api('/api/agent-interactions', { method: 'POST', body: JSON.stringify(interactionData) });
      await api(`/api/notifications/${card.id}/read`, { method: 'PATCH' });

      setCards((prev) => prev.filter((c) => c.id !== card.id));
      setStats((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
      setInputs((prev) => { const n = { ...prev }; delete n[card.id]; return n; });

      const actionLabels = {
        book_meeting: 'Meeting request queued',
        book_demo: 'Demo request queued',
        reply_draft: 'Drafting reply...',
        send_draft: 'Email queued',
        disqualify: 'Lead disqualified',
        pause_campaign: 'Campaign paused',
        resume_campaign: 'Campaign resumed',
        snooze: 'Snoozed',
      };
      toast.success(actionLabels[action.id] || 'Action recorded');
    } catch (err) {
      console.error('Interaction failed:', err);
      toast.error('Action failed');
    }
  };

  // ── Render helpers ──

  const renderAction = (card, action) => {
    if (action.type === 'button') {
      return (
        <button
          key={action.id}
          onClick={(e) => { e.stopPropagation(); interact(card, action); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${ACTION_STYLES[action.style] || ACTION_STYLES.secondary}`}
          disabled={action.disabled}
        >
          {action.label || action.id}
        </button>
      );
    }

    if (action.type === 'input') {
      return (
        <div key={action.id} className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
          <input
            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            placeholder={action.placeholder || 'Type here...'}
            value={inputs[card.id] || ''}
            onChange={(e) => setInputs((prev) => ({ ...prev, [card.id]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') interact(card, action); }}
          />
          <button
            onClick={() => interact(card, action)}
            disabled={!inputs[card.id]?.trim()}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${ACTION_STYLES.primary} disabled:opacity-40`}
          >
            Send
          </button>
        </div>
      );
    }

    if (action.type === 'chips') {
      return (
        <div key={action.id} className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {(action.options || []).map((option) => (
            <button
              key={option}
              onClick={() => interact(card, { ...action, type: 'button', id: `${action.id}:${option}` }, { selected_option: option })}
              className="px-3 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-sm"
            >
              {option}
            </button>
          ))}
        </div>
      );
    }

    if (action.type === 'select') {
      return (
        <div key={action.id} onClick={(e) => e.stopPropagation()}>
          <select
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
            onChange={(e) => interact(card, action, { selected_option: e.target.value })}
            defaultValue=""
          >
            <option value="" disabled>{action.label || 'Select...'}</option>
            {(action.options || []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stats.unread > 0
                  ? `${stats.unread} unread of ${stats.total} total`
                  : stats.total > 0
                    ? `${stats.total} notifications — all caught up!`
                    : 'No notifications yet'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {stats.unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => { loadNotifications(); loadStats(); }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
            {FILTERS.map((f) => {
              const count = f.key === 'unread' ? stats.unread : f.key === 'all' ? stats.total : (stats.by_type?.[f.key] || 0);
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    filter === f.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      filter === f.key
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading && cards.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading notifications...</p>
            </div>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">{'\uD83D\uDCEC'}</div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
              {filter === 'unread' ? 'No unread notifications' : filter !== 'all' ? `No ${FILTERS.find(f => f.key === filter)?.label?.toLowerCase() || ''} notifications` : 'No notifications yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'unread'
                ? "You're all caught up! New notifications will appear here."
                : 'When REX has updates, health alerts, or replies that need attention, they\'ll show up here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => {
              const meta = getTypeMeta(card.type);
              const isUnread = !card.read_at;

              return (
                <div
                  key={card.id}
                  onClick={() => markRead(card)}
                  className={`rounded-xl border p-5 transition cursor-pointer ${
                    isUnread
                      ? 'border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-gray-900 shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Type icon */}
                    <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${meta.color}`}>
                      {meta.icon}
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2">
                        <h3 className={`text-base font-semibold truncate ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {card.title}
                        </h3>
                        {isUnread && <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500" />}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatRelativeTime(card.created_at)}
                        </span>
                        {card.thread_key && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-600 truncate max-w-[200px]">
                            {card.thread_key}
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      {card.body_md && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap leading-relaxed line-clamp-3">
                          {card.body_md.replace(/[*_#>~`|]/g, '')}
                        </p>
                      )}

                      {/* Actions */}
                      {card.actions && card.actions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {card.actions.map((action) => renderAction(card, action))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
