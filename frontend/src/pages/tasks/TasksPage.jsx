import React, { useMemo, useState } from 'react';
import TasksTabs from './TasksTabs';
import TasksList from './TasksList';
import TaskDetailPanel from './TaskDetailPanel';
import TaskCreateModal from './TaskCreateModal';
import { MOCK_ACTIVITY, MOCK_TASKS, TASK_TABS } from './mockTasks';
import './tasks-theme.css';

function getTabTasks(tasks, tabKey) {
  if (tabKey === 'assigned_to_me') return tasks.filter((task) => task.assignedToMe && !task.completed);
  if (tabKey === 'assigned_by_me') return tasks.filter((task) => task.assignedByMe && !task.completed);
  if (tabKey === 'all_team') return tasks.filter((task) => !task.completed);
  if (tabKey === 'overdue') return tasks.filter((task) => task.dueOverdue && !task.completed);
  if (tabKey === 'completed') return tasks.filter((task) => task.completed);
  return tasks;
}

function countByTab(tasks) {
  return {
    assigned_to_me: tasks.filter((task) => task.assignedToMe && !task.completed).length,
    assigned_by_me: tasks.filter((task) => task.assignedByMe && !task.completed).length,
    all_team: tasks.filter((task) => !task.completed).length,
    overdue: tasks.filter((task) => task.dueOverdue && !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [activeTab, setActiveTab] = useState('assigned_to_me');
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(MOCK_TASKS.find((t) => t.selected)?.id || MOCK_TASKS[0]?.id);
  const [createOpen, setCreateOpen] = useState(false);

  const tabCounts = useMemo(() => countByTab(tasks), [tasks]);
  const tabTasks = useMemo(() => getTabTasks(tasks, activeTab), [tasks, activeTab]);
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabTasks;
    return tabTasks.filter(
      (task) => task.title.toLowerCase().includes(q) || task.relatedLabel.toLowerCase().includes(q) || task.assigneeName.toLowerCase().includes(q),
    );
  }, [search, tabTasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || filteredTasks[0] || null,
    [tasks, selectedTaskId, filteredTasks],
  );

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
                  const next = getTabTasks(tasks, key)[0];
                  if (next) setSelectedTaskId(next.id);
                }}
              />

              <TasksList tasks={filteredTasks} selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} />
            </div>

            <TaskDetailPanel task={selectedTask} activity={MOCK_ACTIVITY} />
          </div>
        </div>
      </main>

      <TaskCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(form) => {
          const newTask = {
            id: `task-${Date.now()}`,
            code: `TASK-${Math.floor(2000 + Math.random() * 5000)}`,
            title: form.title.trim(),
            status: 'To Do',
            statusTone: 'gray',
            dueLabel: form.dueDate || 'No due date',
            dueSort: 100,
            dueOverdue: false,
            priority: 'Medium',
            priorityTone: 'orange',
            commentCount: 0,
            relatedLabel: form.relatedObject || 'Unlinked',
            relatedTypeIcon: 'fa-solid fa-link',
            ownerAvatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
            assigneeName: form.assignee || 'Unassigned',
            assigneeAvatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
            createdAt: 'Created just now',
            description: form.description || 'No description',
            assignedToMe: true,
            assignedByMe: true,
            completed: false,
          };
          setTasks((prev) => [newTask, ...prev]);
          setActiveTab('assigned_to_me');
          setSelectedTaskId(newTask.id);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
