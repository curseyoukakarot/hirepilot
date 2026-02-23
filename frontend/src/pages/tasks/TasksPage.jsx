import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TasksTabs from './TasksTabs';
import TasksList from './TasksList';
import TaskDetailPanel from './TaskDetailPanel';
import TaskCreateModal from './TaskCreateModal';
import { TASK_TABS } from './mockTasks';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import './tasks-theme.css';

const WORKSPACE_STORAGE_KEY = 'hp_active_workspace_id';

function normalizeDateLabel(dueAt) {
  if (!dueAt) return 'No due date';
  const dt = new Date(dueAt);
  if (Number.isNaN(dt.getTime())) return 'No due date';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  if (itemDay === today) return `Today, ${dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (itemDay === today - 86400000) return 'Yesterday';
  if (itemDay === today + 86400000) return 'Tomorrow';
  return dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapPriorityTone(priority) {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'high') return 'red';
  if (normalized === 'medium') return 'orange';
  return 'blue';
}

function mapStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'done'].includes(normalized)) return 'green';
  if (['in_progress', 'in progress', 'in review'].includes(normalized)) return 'blue';
  if (['waiting', 'blocked'].includes(normalized)) return 'yellow';
  return 'gray';
}

function mapRelatedIcon(relatedType) {
  const normalized = String(relatedType || '').toLowerCase();
  if (normalized === 'lead') return 'fa-solid fa-user-tie';
  if (normalized === 'job_req') return 'fa-solid fa-briefcase';
  if (normalized === 'kanban_card') return 'fa-solid fa-layer-group';
  if (normalized === 'dashboard_item') return 'fa-solid fa-chart-line';
  return 'fa-solid fa-link';
}

function avatarFallback(name) {
  const label = String(name || 'User').trim() || 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=random`;
}

function mapTask(task, usersById = {}) {
  const assignee = task.assigned_to_user_id ? usersById[task.assigned_to_user_id] : null;
  const owner = task.created_by_user_id ? usersById[task.created_by_user_id] : null;
  const isCompleted = Boolean(task.completed_at) || String(task.status || '').toLowerCase() === 'completed';
  const dueOverdue = Boolean(task.due_at) && new Date(task.due_at).getTime() < Date.now() && !isCompleted;
  const ownerName = owner?.name || 'Owner';
  const assigneeName = assignee?.name || 'Unassigned';
  return {
    id: task.id,
    code: String(task.id || '').slice(0, 8).toUpperCase(),
    title: task.title || 'Untitled Task',
    status: task.status_label || task.status || 'open',
    statusKey: task.status || 'open',
    statusTone: mapStatusTone(task.status || ''),
    dueLabel: normalizeDateLabel(task.due_at),
    dueAt: task.due_at || null,
    dueOverdue,
    priority: String(task.priority || 'medium').replace(/^./, (c) => c.toUpperCase()),
    priorityKey: String(task.priority || 'medium').toLowerCase(),
    priorityTone: mapPriorityTone(task.priority || 'medium'),
    commentCount: Number(task.comment_count || 0),
    relatedLabel: task.related_id ? `${task.related_type || 'related'} #${String(task.related_id).slice(0, 6)}` : 'Unlinked',
    relatedTypeIcon: mapRelatedIcon(task.related_type),
    ownerAvatar: owner?.avatar || avatarFallback(ownerName),
    assigneeName,
    assigneeAvatar: assignee?.avatar || avatarFallback(assigneeName),
    assigneeId: task.assigned_to_user_id || '',
    createdAt: task.created_at ? `Created ${new Date(task.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'Created --',
    description: task.description || 'No description',
    completed: isCompleted,
    raw: task,
  };
}

function emptyCounts() {
  return {
    assigned_to_me: 0,
    assigned_by_me: 0,
    all_team: 0,
    overdue: 0,
    completed: 0,
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function toStatusKey(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export default function TasksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [tabCounts, setTabCounts] = useState(emptyCounts());
  const [activeTab, setActiveTab] = useState('assigned_to_me');
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [activity, setActivity] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('User');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserAvatar, setCurrentUserAvatar] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedDue, setSelectedDue] = useState('');
  const [todayProgress, setTodayProgress] = useState({ done: 0, total: 0 });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [highlightedActivityId, setHighlightedActivityId] = useState('');
  const createTaskInFlightRef = useRef(false);
  const lastRealtimeRefreshAt = useRef(0);

  const triggerLightRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRealtimeRefreshAt.current < 800) return;
    lastRealtimeRefreshAt.current = now;
    setRefreshKey((k) => k + 1);
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const tabs = ['assigned_to_me', 'assigned_by_me', 'all_team', 'overdue', 'completed'];
      const responses = await Promise.all(
        tabs.map(async (tab) => {
          const res = await apiGet(`/api/tasks?tab=${tab}`);
          return { tab, count: Array.isArray(res?.tasks) ? res.tasks.length : 0 };
        }),
      );
      const next = emptyCounts();
      responses.forEach((entry) => {
        next[entry.tab] = entry.count;
      });
      setTabCounts(next);
    } catch {}
  }, []);

  const loadTodayProgress = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const [openRes, doneRes] = await Promise.all([
        apiGet('/api/tasks?tab=assigned_to_me&due=today'),
        apiGet(`/api/tasks?tab=completed&due=today&assignee=${encodeURIComponent(currentUserId)}`),
      ]);
      const openCount = Array.isArray(openRes?.tasks) ? openRes.tasks.length : 0;
      const doneCount = Array.isArray(doneRes?.tasks) ? doneRes.tasks.length : 0;
      setTodayProgress({ done: doneCount, total: doneCount + openCount });
    } catch {
      setTodayProgress({ done: 0, total: 0 });
    }
  }, [currentUserId]);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([apiGet('/api/notifications?limit=8'), apiGet('/api/notifications/stats')]);
      const rows = Array.isArray(listRes?.notifications) ? listRes.notifications : [];
      setNotifications(rows);
      setNotificationUnread(Number(statsRes?.unread || rows.filter((item) => !item?.read_at).length || 0));
    } catch {
      setNotifications([]);
      setNotificationUnread(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (!authUser || !mounted) return;
        setCurrentUserId(String(authUser.id || ''));
        const { data } = await supabase
          .from('users')
          .select('id,first_name,last_name,full_name,email,team_id,avatar_url')
          .eq('id', authUser.id)
          .maybeSingle();
        const current = data || {};
        const meta = authUser.user_metadata || {};
        const fullName =
          String(current?.full_name || '').trim() ||
          `${current?.first_name || meta.first_name || meta.firstName || ''} ${current?.last_name || meta.last_name || meta.lastName || ''}`
            .trim() ||
          String(meta.full_name || meta.name || authUser.email || 'User').trim();
        const avatarCandidate =
          String(current?.avatar_url || '').trim() ||
          String(meta.avatar_url || meta.photo_url || meta.profile_image_url || meta.picture || meta.image || '').trim();
        const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
        if (mounted) {
          setCurrentUserName(fullName);
          setCurrentUserEmail(String(current?.email || authUser.email || '').trim());
          setCurrentUserAvatar(avatarCandidate || fallbackAvatar);
        }
        let users = [current];
        if (current?.team_id) {
          const { data: teamUsers } = await supabase
            .from('users')
            .select('id,first_name,last_name,full_name,email,avatar_url')
            .eq('team_id', current.team_id);
          users = teamUsers || users;
        }
        const normalized = users
          .filter((user) => user?.id)
          .map((user) => ({
            id: user.id,
            name: String(user.full_name || '').trim() || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Team Member',
            avatar: String(user.avatar_url || '').trim() || avatarFallback(String(user.full_name || '').trim() || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Team Member'),
          }));
        const map = normalized.reduce((acc, user) => ({ ...acc, [user.id]: user }), {});
        if (mounted) {
          setAssignees(normalized);
          setUsersById(map);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const routeTaskId = String(searchParams.get('taskId') || '').trim();
    const routeCommentId = String(searchParams.get('commentId') || '').trim();
    if (isUuid(routeTaskId)) setSelectedTaskId(routeTaskId);
    setHighlightedActivityId(routeCommentId);
  }, [searchParams]);

  useEffect(() => {
    const syncWorkspace = () => {
      try {
        setActiveWorkspaceId(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) || '');
      } catch {
        setActiveWorkspaceId('');
      }
    };
    syncWorkspace();
    window.addEventListener('storage', syncWorkspace);
    return () => {
      window.removeEventListener('storage', syncWorkspace);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiGet('/api/tasks/statuses');
        if (!mounted) return;
        setStatuses(Array.isArray(res?.statuses) ? res.statuses : []);
      } catch {
        if (!mounted) return;
        setStatuses([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoadingList(true);
      try {
        const queryParams = new URLSearchParams({ tab: activeTab, search });
        if (selectedStatus) queryParams.set('status', selectedStatus);
        if (selectedAssignee) queryParams.set('assignee', selectedAssignee);
        if (selectedDue) queryParams.set('due', selectedDue);
        const query = queryParams.toString();
        const res = await apiGet(`/api/tasks?${query}`);
        const rows = Array.isArray(res?.tasks) ? res.tasks : [];
        const mapped = rows.map((task) => mapTask(task, usersById));
        setTasks(mapped);
        if (!selectedTaskId && mapped[0]) setSelectedTaskId(mapped[0].id);
        if (selectedTaskId && !mapped.some((task) => task.id === selectedTaskId)) {
          setSelectedTaskId(mapped[0]?.id || '');
        }
      } catch {
        setTasks([]);
      } finally {
        setLoadingList(false);
      }
      loadCounts();
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTab, search, selectedTaskId, usersById, refreshKey, loadCounts, selectedStatus, selectedAssignee, selectedDue]);

  useEffect(() => {
    let mounted = true;
    if (!selectedTaskId || !isUuid(selectedTaskId)) {
      setSelectedTask(null);
      setActivity([]);
      return;
    }
    if (tasks.length && !tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTask(null);
      setActivity([]);
      return;
    }
    (async () => {
      try {
        const fallbackTask = tasks.find((row) => row.id === selectedTaskId) || null;
        const encodedTaskId = encodeURIComponent(selectedTaskId);
        const [taskRes, commentsRes] = await Promise.all([
          apiGet(`/api/tasks/fetch?task_id=${encodedTaskId}`),
          apiGet(`/api/tasks/fetch/comments?task_id=${encodedTaskId}`),
        ]);
        if (!mounted) return;
        const task = taskRes?.task ? mapTask(taskRes.task, usersById) : fallbackTask;
        const comments = Array.isArray(commentsRes?.comments) ? commentsRes.comments : [];
        let hasHighlightedComment = false;
        setSelectedTask(task);
        setActivity([
          {
            id: 'system-created',
            type: 'system',
            author: 'System',
            at: task?.createdAt || 'Created',
            body: 'Task created',
          },
          ...comments.map((comment) => ({
            id: comment.id,
            type: String(comment.user_id) === String(taskRes?.task?.assigned_to_user_id) ? 'comment-primary' : 'comment',
            author: usersById[comment.user_id]?.name || 'Team Member',
            at: comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Just now',
            avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
            body: comment.body || '',
            highlighted: highlightedActivityId && String(comment.id) === String(highlightedActivityId),
          })),
        ]);
        hasHighlightedComment = comments.some((comment) => String(comment.id) === String(highlightedActivityId));
        if (hasHighlightedComment) {
          setTimeout(() => {
            const target = document.getElementById(`task-activity-${highlightedActivityId}`);
            if (target && typeof target.scrollIntoView === 'function') {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 80);
        }
      } catch {
        if (!mounted) return;
        setSelectedTask(null);
        setActivity([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedTaskId, refreshKey, usersById, tasks, highlightedActivityId]);

  useEffect(() => {
    loadTodayProgress();
  }, [loadTodayProgress, refreshKey, selectedTaskId]);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  const hasActiveFilters = Boolean(selectedStatus || selectedAssignee || selectedDue);

  const formatNotificationTime = (isoString) => {
    if (!isoString) return '';
    const dt = new Date(isoString);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const handleNotificationClick = async (row) => {
    const meta = row?.metadata || {};
    const taskId = String(meta.task_id || '').trim();
    const commentId = String(meta.comment_id || '').trim();
    try {
      await apiPatch(`/api/notifications/${row.id}/read`);
    } catch {}
    setNotificationsOpen(false);
    setNotificationUnread((prev) => Math.max(0, prev - (row?.read_at ? 0 : 1)));
    if (isUuid(taskId)) {
      const params = new URLSearchParams();
      params.set('taskId', taskId);
      if (commentId) params.set('commentId', commentId);
      navigate(`/tasks?${params.toString()}`);
      setSelectedTaskId(taskId);
      if (commentId) setHighlightedActivityId(commentId);
      return;
    }
    if (!row?.read_at) loadNotifications();
  };

  const handleTaskRowAction = useCallback(
    async (task, action) => {
      if (!task?.id) return;
      if (action === 'edit') {
        setSelectedTaskId(task.id);
        return;
      }

      if (action === 'duplicate') {
        const source = task.raw || null;
        if (!source) return;
        setSavingTask(true);
        try {
          const res = await apiPost('/api/tasks', {
            title: `${source.title || task.title} (Copy)`,
            description: source.description || null,
            assigned_to_user_id: source.assigned_to_user_id || null,
            due_at: source.due_at || null,
            priority: source.priority || 'medium',
            status: source.status || 'open',
            related_type: source.related_type || null,
            related_id: source.related_id || null,
          });
          const duplicateId = res?.task?.id || '';
          setRefreshKey((k) => k + 1);
          if (duplicateId) setSelectedTaskId(duplicateId);
        } finally {
          setSavingTask(false);
        }
        return;
      }

      if (action === 'delete') {
        const confirmed = window.confirm('Delete this task? This cannot be undone.');
        if (!confirmed) return;
        setSavingTask(true);
        try {
          await apiDelete(`/api/tasks/${task.id}`);
          if (String(task.id) === String(selectedTaskId)) {
            setSelectedTaskId('');
            setSelectedTask(null);
            setActivity([]);
          }
          setRefreshKey((k) => k + 1);
        } finally {
          setSavingTask(false);
        }
      }
    },
    [selectedTaskId],
  );

  useEffect(() => {
    if (!activeWorkspaceId) return undefined;
    const ch = supabase
      .channel(`tasks-realtime-${activeWorkspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${activeWorkspaceId}` },
        () => {
          triggerLightRefresh();
        },
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [activeWorkspaceId, triggerLightRefresh]);

  useEffect(() => {
    if (!activeWorkspaceId || !selectedTaskId) return undefined;
    const assigneeId = String(selectedTask?.assigneeId || '');
    const ch = supabase
      .channel(`task-comments-realtime-${selectedTaskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `workspace_id=eq.${activeWorkspaceId}` },
        (payload) => {
          const row = payload?.new;
          if (!row || String(row.task_id) !== String(selectedTaskId)) return;
          const nextItem = {
            id: row.id,
            type: String(row.user_id) === assigneeId ? 'comment-primary' : 'comment',
            author: usersById[row.user_id]?.name || 'Team Member',
            at: row.created_at ? new Date(row.created_at).toLocaleString() : 'Just now',
            avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
            body: row.body || '',
          };
          setActivity((prev) => {
            if (prev.some((item) => String(item.id) === String(row.id))) return prev;
            return [...prev, nextItem];
          });
          setTasks((prev) => prev.map((task) => (task.id === selectedTaskId ? { ...task, commentCount: Number(task.commentCount || 0) + 1 } : task)));
          setSelectedTask((prev) => (
            prev && prev.id === selectedTaskId
              ? { ...prev, commentCount: Number(prev.commentCount || 0) + 1 }
              : prev
          ));
        },
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [activeWorkspaceId, selectedTaskId, selectedTask?.assigneeId, usersById]);

  return (
    <div className="tasks-ui h-full min-h-full overflow-hidden">
      <main className="text-gray-700 h-full overflow-hidden flex bg-dark-500">
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-dark-400 relative">
          <header className="bg-dark-300 border-b border-gray-200 h-16 flex items-center justify-between px-6 flex-shrink-0 z-10">
            <div className="w-96 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fa-solid fa-magnifying-glass text-gray-400 text-sm" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-dark-200 placeholder-gray-400 text-gray-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition duration-150 ease-in-out"
                placeholder="Search tasks, candidates, or notes..."
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-dark-200 transition relative"
                  onClick={async () => {
                    const next = !notificationsOpen;
                    setNotificationsOpen(next);
                    if (next) await loadNotifications();
                  }}
                >
                  <i className="fa-regular fa-bell text-lg" />
                  {notificationUnread > 0 && (
                    <span className="absolute top-1.5 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-96 max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg z-30">
                    <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Notifications</span>
                      <span className="text-xs text-gray-500">{notificationUnread} unread</span>
                    </div>
                    {notificationsLoading ? (
                      <div className="px-3 py-4 text-sm text-gray-500">Loading...</div>
                    ) : notifications.length ? (
                      notifications.map((row) => (
                        <button
                          key={row.id}
                          onClick={() => handleNotificationClick(row)}
                          className="w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm ${row.read_at ? 'text-gray-500' : 'text-gray-900 font-medium'}`}>{row.title || 'Notification'}</p>
                            {!row.read_at && <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{row.body_md || ''}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{formatNotificationTime(row.created_at)}</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-500">No notifications yet.</div>
                    )}
                  </div>
                )}
              </div>
              <div className="h-8 w-px bg-gray-200 mx-1" />
              <div className="flex items-center gap-3 cursor-pointer hover:bg-dark-200 p-1.5 rounded-lg transition">
                <img
                  className="h-8 w-8 rounded-lg object-cover ring-2 ring-gray-200"
                  src={currentUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserName || 'User')}&background=random`}
                  alt={currentUserName || 'User'}
                />
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-800">{currentUserName || 'User'}</p>
                  <p className="text-xs text-gray-500">{currentUserEmail || 'No email'}</p>
                </div>
                <i className="fa-solid fa-chevron-down text-xs text-gray-400 ml-1" />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden flex flex-row relative">
            <div className="flex-[1.5] flex flex-col overflow-hidden min-w-0 bg-dark-400 p-6">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
                  <p className="text-sm text-gray-500 mt-1">Execution &amp; Accountability</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden xl:flex items-center bg-dark-200 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm mr-2">
                    <div className="flex -space-x-1 mr-2">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      My Tasks Today: <span className="font-bold text-gray-900">{todayProgress.done}/{todayProgress.total}</span>
                    </span>
                  </div>

                  <div className="relative">
                    <button
                      className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition ${hasActiveFilters ? 'border-primary-500 text-primary-400 bg-indigo-50' : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-50'}`}
                      onClick={() => setFiltersOpen((open) => !open)}
                    >
                      <i className="fa-solid fa-filter mr-2 text-gray-400" />
                      Filter
                    </button>
                    {filtersOpen && (
                      <div className="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-3 z-20">
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Status</label>
                        <select
                          className="w-full mb-3 px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800"
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                          <option value="">All statuses</option>
                          {statuses.map((status) => (
                            <option key={status.key} value={status.key}>
                              {status.label}
                            </option>
                          ))}
                        </select>

                        <label className="block text-xs text-gray-500 mb-1 font-medium">Assignee</label>
                        <select
                          className="w-full mb-3 px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800"
                          value={selectedAssignee}
                          onChange={(e) => setSelectedAssignee(e.target.value)}
                        >
                          <option value="">All assignees</option>
                          {assignees.map((assignee) => (
                            <option key={assignee.id} value={assignee.id}>
                              {assignee.name}
                            </option>
                          ))}
                        </select>

                        <label className="block text-xs text-gray-500 mb-1 font-medium">Due Date</label>
                        <select
                          className="w-full mb-3 px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800"
                          value={selectedDue}
                          onChange={(e) => setSelectedDue(e.target.value)}
                        >
                          <option value="">Any due date</option>
                          <option value="today">Due today</option>
                          <option value="overdue">Overdue</option>
                          <option value="none">No due date</option>
                        </select>

                        <div className="flex items-center justify-between">
                          <button
                            className="text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => {
                              setSelectedStatus('');
                              setSelectedAssignee('');
                              setSelectedDue('');
                            }}
                          >
                            Clear filters
                          </button>
                          <button
                            className="text-xs text-gray-700 hover:text-gray-900 font-medium"
                            onClick={() => setFiltersOpen(false)}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition"
                    onClick={() => setRefreshKey((k) => k + 1)}
                  >
                    <i className="fa-solid fa-rotate-right mr-2 text-gray-400" />
                    Refresh
                  </button>
                  <button
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition shadow-glow"
                    onClick={() => setCreateOpen(true)}
                  >
                    <i className="fa-solid fa-plus mr-2" />
                    Create Task
                  </button>
                </div>
              </div>

              <TasksTabs
                tabs={TASK_TABS}
                activeTab={activeTab}
                counts={tabCounts}
                onChange={(key) => {
                  setActiveTab(key);
                  setSelectedTaskId('');
                }}
              />

              <TasksList
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                onTaskAction={handleTaskRowAction}
                currentUserId={currentUserId}
              />
              {loadingList && (
                <div className="text-xs text-gray-400 mt-3 px-2">Loading tasks...</div>
              )}
            </div>

            <TaskDetailPanel
              task={selectedTask}
              activity={activity}
              highlightedActivityId={highlightedActivityId}
              statuses={statuses}
              assignees={assignees}
              saving={savingTask}
              onFieldUpdate={async (updates) => {
                if (!selectedTaskId) return;
                setSavingTask(true);
                try {
                  await apiPatch(`/api/tasks/${selectedTaskId}`, updates);
                  setRefreshKey((k) => k + 1);
                } finally {
                  setSavingTask(false);
                }
              }}
              onMarkComplete={async () => {
                if (!selectedTaskId) return;
                setSavingTask(true);
                try {
                  await apiPost(`/api/tasks/${selectedTaskId}/complete`, {});
                  setRefreshKey((k) => k + 1);
                } finally {
                  setSavingTask(false);
                }
              }}
              onAddComment={async (body) => {
                if (!selectedTaskId) return;
                try {
                  await apiPost('/api/tasks/fetch/comments', { task_id: selectedTaskId, body });
                  setRefreshKey((k) => k + 1);
                } catch (err) {
                  const message = String(err?.message || '');
                  if (message.includes('task_not_found')) {
                    setSelectedTaskId('');
                    setSelectedTask(null);
                    setActivity([]);
                    setRefreshKey((k) => k + 1);
                    throw new Error('This task no longer exists. The list has been refreshed.');
                  }
                  throw err;
                }
              }}
              onDuplicate={async () => {
                if (!selectedTask?.raw) return;
                setSavingTask(true);
                try {
                  const source = selectedTask.raw;
                  const res = await apiPost('/api/tasks', {
                    title: `${source.title || selectedTask.title} (Copy)`,
                    description: source.description || null,
                    assigned_to_user_id: source.assigned_to_user_id || null,
                    due_at: source.due_at || null,
                    priority: source.priority || 'medium',
                    status: source.status || 'open',
                    related_type: source.related_type || null,
                    related_id: source.related_id || null,
                  });
                  const duplicateId = res?.task?.id || '';
                  setRefreshKey((k) => k + 1);
                  if (duplicateId) setSelectedTaskId(duplicateId);
                } finally {
                  setSavingTask(false);
                }
              }}
              onDelete={async () => {
                if (!selectedTaskId) return;
                const confirmed = window.confirm('Delete this task? This cannot be undone.');
                if (!confirmed) return;
                setSavingTask(true);
                try {
                  await apiDelete(`/api/tasks/${selectedTaskId}`);
                  setSelectedTaskId('');
                  setSelectedTask(null);
                  setActivity([]);
                  setRefreshKey((k) => k + 1);
                } finally {
                  setSavingTask(false);
                }
              }}
              onCreateStatus={async (label) => {
                const key = toStatusKey(label);
                if (!key) return;
                try {
                  const res = await apiPost('/api/tasks/statuses', { key, label, sort_order: statuses.length * 10 + 10 });
                  const created = res?.status;
                  if (created) {
                    setStatuses((prev) => {
                      const withoutDuplicate = prev.filter((item) => item.key !== created.key);
                      return [...withoutDuplicate, created].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
                    });
                    await apiPatch(`/api/tasks/${selectedTaskId}`, { status: created.key });
                    setRefreshKey((k) => k + 1);
                    return;
                  }
                } catch {}
                // Fallback: keep UI usable even if custom status API is unavailable.
                setStatuses((prev) => {
                  if (prev.some((item) => item.key === key)) return prev;
                  return [...prev, { key, label, sort_order: prev.length * 10 + 10 }];
                });
                await apiPatch(`/api/tasks/${selectedTaskId}`, { status: key });
                setRefreshKey((k) => k + 1);
              }}
              onConvertReminder={async () => {
                if (!selectedTaskId || !selectedTask?.raw) return;
                setSavingTask(true);
                try {
                  const source = selectedTask.raw;
                  const res = await apiPost(`/api/tasks/${selectedTaskId}/follow-up`, {
                    title: `Reminder: ${source.title || selectedTask.title}`,
                    description: source.description || null,
                    assigned_to_user_id: source.assigned_to_user_id || null,
                    related_type: source.related_type || null,
                    related_id: source.related_id || null,
                    due_in_hours: 24,
                    priority: source.priority || 'medium',
                  });
                  const reminderId = res?.task?.id || '';
                  setRefreshKey((k) => k + 1);
                  if (reminderId) setSelectedTaskId(reminderId);
                } finally {
                  setSavingTask(false);
                }
              }}
            />
          </div>
        </div>
      </main>

      <TaskCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        assignees={assignees}
        currentUserId={currentUserId}
        creating={creatingTask}
        onCreate={async (form) => {
          if (createTaskInFlightRef.current) return;
          createTaskInFlightRef.current = true;
          setCreatingTask(true);
          try {
            const payload = {
              title: form.title.trim(),
              description: form.description || null,
              assigned_to_user_id: form.assigneeId || null,
              due_at: form.dueDate ? `${form.dueDate}T17:00:00.000Z` : null,
              related_type: form.relatedObject ? 'note' : null,
              related_id: null,
              priority: 'medium',
            };
            const res = await apiPost('/api/tasks', payload);
            const createdId = res?.task?.id || '';
            setCreateOpen(false);
            setActiveTab('assigned_to_me');
            setRefreshKey((k) => k + 1);
            if (createdId) setSelectedTaskId(createdId);
          } finally {
            createTaskInFlightRef.current = false;
            setCreatingTask(false);
          }
        }}
      />
    </div>
  );
}
