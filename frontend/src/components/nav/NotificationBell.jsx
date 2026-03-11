import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';

// ── Type → icon/color mapping ──

const TYPE_META = {
  sourcing_reply:    { icon: '\uD83D\uDCAC', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  health_alert:      { icon: '\u26A0\uFE0F', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  milestone:         { icon: '\uD83C\uDF89', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  reply_draft:       { icon: '\u270F\uFE0F', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  meeting_draft:     { icon: '\uD83D\uDCC5', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  sourcing_campaign: { icon: '\uD83D\uDCCA', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  sourcing_sequence: { icon: '\uD83D\uDCDD', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  snooze_reminder:   { icon: '\u23F0', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
};

function getTypeMeta(type) {
  return TYPE_META[type] || { icon: '\uD83D\uDD14', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
}

// ── Relative time helper ──

function formatRelativeTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

// ── Component ──

export default function NotificationBell() {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch unread count
  const fetchStats = useCallback(async () => {
    try {
      const data = await api('/api/notifications/stats');
      setUnread(data?.unread || 0);
    } catch {}
  }, []);

  // Fetch latest notifications
  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/api/notifications?limit=8');
      setCards(data?.notifications || data || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Fetch cards when dropdown opens
  useEffect(() => {
    if (open) {
      fetchCards();
      fetchStats();
    }
  }, [open, fetchCards, fetchStats]);

  // Click outside + escape to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Mark single notification as read
  const markRead = async (card) => {
    try {
      await api(`/api/notifications/${card.id}/read`, { method: 'PATCH' });
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, read_at: new Date().toISOString() } : c)));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'PATCH' });
      setCards((prev) => prev.map((c) => ({ ...c, read_at: c.read_at || new Date().toISOString() })));
      setUnread(0);
    } catch {}
  };

  // Handle quick action button click
  const handleAction = async (card, action) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return;

      const meta = card?.metadata || {};
      await api('/api/agent-interactions', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          source: 'inapp',
          action_type: action.type === 'input' ? 'input' : 'button',
          action_id: action.id,
          thread_key: card.thread_key,
          data: {
            reply_id: meta.reply_id || null,
            lead_id: meta.lead_id || null,
            campaign_id: meta.campaign_id || null,
            lead_email: meta.from_email || meta.lead_email || null,
          },
        }),
      });

      await api(`/api/notifications/${card.id}/read`, { method: 'PATCH' });
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Notification action failed:', err);
    }
  };

  // Click card → mark read + navigate to inbox
  const handleCardClick = (card) => {
    markRead(card);
    setOpen(false);
    navigate('/notifications');
  };

  const actionStyleMap = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell button */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        {/* Bell SVG */}
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-96 max-h-[520px] flex flex-col rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 shadow-xl backdrop-blur-md z-50"
            role="menu"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 text-[11px] font-semibold">
                    {unread} new
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Card list */}
            <div className="flex-1 overflow-y-auto">
              {loading && cards.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
                </div>
              ) : cards.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="text-3xl mb-2">{'\uD83D\uDCEC'}</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">All caught up!</p>
                </div>
              ) : (
                cards.map((card) => {
                  const meta = getTypeMeta(card.type);
                  const isUnread = !card.read_at;
                  const buttonActions = (card.actions || []).filter((a) => a.type === 'button').slice(0, 2);

                  return (
                    <div
                      key={card.id}
                      className={`px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition cursor-pointer ${isUnread ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}`}
                      onClick={() => handleCardClick(card)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Type icon */}
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${meta.color}`}>
                          {meta.icon}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium truncate ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {card.title}
                            </span>
                            {isUnread && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />}
                          </div>

                          {/* Body preview */}
                          {card.body_md && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                              {card.body_md.replace(/[*_#>~`\-|]/g, '').slice(0, 120)}
                            </p>
                          )}

                          {/* Time + type */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                              {formatRelativeTime(card.created_at)}
                            </span>
                            {card.type && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                {card.type.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>

                          {/* Quick action buttons */}
                          {buttonActions.length > 0 && (
                            <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                              {buttonActions.map((action) => (
                                <button
                                  key={action.id}
                                  onClick={() => handleAction(card, action)}
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${actionStyleMap[action.style] || actionStyleMap.secondary}`}
                                >
                                  {action.label || action.id}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2.5">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications');
                }}
                className="w-full text-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View all notifications &rarr;
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
