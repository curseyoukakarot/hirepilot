import React, { useCallback, useEffect, useState } from 'react';
import TasksTabs from './TasksTabs';
import TasksList from './TasksList';
import TaskDetailPanel from './TaskDetailPanel';
import TaskCreateModal from './TaskCreateModal';
import { TASK_TABS } from './mockTasks';
import { apiGet, apiPatch, apiPost } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import './tasks-theme.css';

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

function mapTask(task, usersById = {}) {
  const assignee = task.assigned_to_user_id ? usersById[task.assigned_to_user_id] : null;
  const isCompleted = Boolean(task.completed_at) || String(task.status || '').toLowerCase() === 'completed';
  const dueOverdue = Boolean(task.due_at) && new Date(task.due_at).getTime() < Date.now() && !isCompleted;
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
    ownerAvatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
    assigneeName: assignee?.name || 'Unassigned',
    assigneeAvatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
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

export default function TasksPage() {
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (!authUser || !mounted) return;
        setCurrentUserId(String(authUser.id || ''));
        const { data } = await supabase.from('users').select('id,first_name,last_name,email,team_id').eq('id', authUser.id).maybeSingle();
        const current = data || {};
        let users = [current];
        if (current?.team_id) {
          const { data: teamUsers } = await supabase.from('users').select('id,first_name,last_name,email').eq('team_id', current.team_id);
          users = teamUsers || users;
        }
        const normalized = users
          .filter((user) => user?.id)
          .map((user) => ({
            id: user.id,
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Team Member',
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
        const query = new URLSearchParams({ tab: activeTab, search }).toString();
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
  }, [activeTab, search, selectedTaskId, usersById, refreshKey, loadCounts]);

  useEffect(() => {
    let mounted = true;
    if (!selectedTaskId) {
      setSelectedTask(null);
      setActivity([]);
      return;
    }
    (async () => {
      try {
        const [taskRes, commentsRes] = await Promise.all([
          apiGet(`/api/tasks/${selectedTaskId}`),
          apiGet(`/api/tasks/${selectedTaskId}/comments`),
        ]);
        if (!mounted) return;
        const task = taskRes?.task ? mapTask(taskRes.task, usersById) : null;
        const comments = Array.isArray(commentsRes?.comments) ? commentsRes.comments : [];
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
          })),
        ]);
      } catch {
        if (!mounted) return;
        setSelectedTask(null);
        setActivity([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedTaskId, refreshKey, usersById]);

  return (
    <div className="tasks-ui h-full min-h-full overflow-hidden">
      <main className="text-gray-100 h-full overflow-hidden flex bg-dark-500">
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-dark-400 relative">
          <header className="bg-dark-300 border-b border-gray-800 h-16 flex items-center justify-between px-6 flex-shrink-0 z-10">
            <div className="w-96 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fa-solid fa-magnifying-glass text-gray-500 text-sm" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md leading-5 bg-dark-200 placeholder-gray-500 text-gray-200 focus:outline-none focus:bg-dark-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition duration-150 ease-in-out"
                placeholder="Search tasks, candidates, or notes..."
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-dark-200 transition relative">
                <i className="fa-regular fa-bell text-lg" />
                <span className="absolute top-1.5 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-dark-300" />
              </button>
              <div className="h-8 w-px bg-gray-800 mx-1" />
              <div className="flex items-center gap-3 cursor-pointer hover:bg-dark-200 p-1.5 rounded-lg transition">
                <img
                  className="h-8 w-8 rounded-lg object-cover ring-2 ring-gray-700"
                  src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg"
                  alt="Sarah Johnson"
                />
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-200">Sarah Johnson</p>
                  <p className="text-xs text-gray-500">johns@hirepilot.com</p>
                </div>
                <i className="fa-solid fa-chevron-down text-xs text-gray-500 ml-1" />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden flex flex-row relative">
            <div className="flex-[1.5] flex flex-col overflow-hidden min-w-0 bg-dark-400 p-6">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Tasks</h1>
                  <p className="text-sm text-gray-400 mt-1">Execution &amp; Accountability</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden xl:flex items-center bg-dark-200 px-3 py-1.5 rounded-md border border-gray-700 shadow-sm mr-2">
                    <div className="flex -space-x-1 mr-2">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-300">
                      My Tasks Today: <span className="font-bold text-white">4/12</span>
                    </span>
                  </div>

                  <button className="inline-flex items-center px-3 py-2 border border-gray-700 shadow-sm text-sm font-medium rounded-md text-gray-300 bg-dark-200 hover:bg-dark-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition">
                    <i className="fa-solid fa-filter mr-2 text-gray-500" />
                    Filter
                  </button>
                  <button
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition shadow-glow"
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
              />
              {loadingList && (
                <div className="text-xs text-gray-500 mt-3 px-2">Loading tasks...</div>
              )}
            </div>

            <TaskDetailPanel
              task={selectedTask}
              activity={activity}
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
                await apiPost(`/api/tasks/${selectedTaskId}/comments`, { body });
                setRefreshKey((k) => k + 1);
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
            setCreatingTask(false);
          }
        }}
      />
    </div>
  );
}
