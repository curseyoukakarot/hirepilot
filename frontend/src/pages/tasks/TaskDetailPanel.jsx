import React from 'react';
import TaskActivityFeed from './TaskActivityFeed';

export default function TaskDetailPanel({ task, activity }) {
  if (!task) {
    return null;
  }

  return (
    <div className="w-[400px] bg-dark-300 border-l border-gray-800 flex-col h-full shadow-drawer z-30 lg:relative lg:flex hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="bg-dark-200 px-2 py-1 rounded border border-gray-700">{task.code}</span>
          <span>•</span>
          <span>{task.createdAt}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-gray-500 hover:text-gray-300 p-1.5 rounded-md hover:bg-dark-200 transition">
            <i className="fa-solid fa-link" />
          </button>
          <button className="text-gray-500 hover:text-gray-300 p-1.5 rounded-md hover:bg-dark-200 transition">
            <i className="fa-solid fa-ellipsis" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-4">
            <button className="mt-1.5 text-gray-600 hover:text-primary-400 transition">
              <i className="fa-regular fa-circle text-xl" />
            </button>
            <h2 className="text-xl font-bold text-white leading-snug">{task.title}</h2>
          </div>

          <div className="flex flex-wrap gap-2 ml-8">
            <button className="flex items-center gap-1.5 bg-blue-600/20 text-blue-400 px-3 py-1 rounded-md text-xs font-semibold hover:bg-blue-600/30 transition border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {task.status}
              <i className="fa-solid fa-chevron-down text-[10px] ml-1 opacity-50" />
            </button>
            <button className="flex items-center gap-1.5 bg-dark-200 text-gray-300 px-3 py-1 rounded-md text-xs font-medium hover:bg-dark-100 transition border border-gray-700 border-dashed">
              <i className="fa-solid fa-calendar text-gray-500" />
              {task.dueLabel}
            </button>
            <button className="flex items-center gap-1.5 bg-dark-200 text-gray-300 px-3 py-1 rounded-md text-xs font-medium hover:bg-dark-100 transition border border-gray-700 border-dashed">
              <span className={`w-2 h-2 rounded-full ${task.priorityTone === 'orange' ? 'bg-orange-400' : 'bg-red-500'}`} />
              {task.priority}
            </button>
          </div>
        </div>

        <div className="bg-dark-200 rounded-lg p-4 mb-6 border border-gray-800">
          <div className="grid grid-cols-2 gap-y-4 gap-x-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Assignee</label>
              <div className="flex items-center gap-2">
                <img src={task.assigneeAvatar} className="w-6 h-6 rounded-full ring-2 ring-gray-700" alt={task.assigneeName} />
                <span className="text-sm text-gray-300">{task.assigneeName}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Related To</label>
              <a href="#" className="flex items-center gap-1.5 text-sm text-primary-400 hover:underline">
                <i className={`${task.relatedTypeIcon} text-xs`} />
                {task.relatedLabel}
              </a>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <p className="text-sm text-gray-400 leading-relaxed">{task.description}</p>
            </div>
          </div>
        </div>

        <TaskActivityFeed activity={activity} />
      </div>

      <div className="p-4 border-t border-gray-800 bg-dark-200">
        <div className="relative">
          <input
            type="text"
            className="block w-full pl-3 pr-10 py-2 border border-gray-700 rounded-md leading-5 bg-dark-300 placeholder-gray-500 text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="Write a comment or type / for actions..."
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button className="text-gray-500 hover:text-primary-400 p-1 transition">
              <i className="fa-solid fa-paper-plane text-sm" />
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            <button className="p-1.5 text-gray-500 hover:bg-dark-300 hover:text-gray-300 hover:shadow-sm rounded transition" title="Add Attachment">
              <i className="fa-solid fa-paperclip text-sm" />
            </button>
            <button className="p-1.5 text-gray-500 hover:bg-dark-300 hover:text-gray-300 hover:shadow-sm rounded transition" title="Mention">
              <i className="fa-solid fa-at text-sm" />
            </button>
          </div>
          <div className="flex gap-2">
            <button className="bg-dark-300 border border-gray-700 text-gray-300 text-xs font-medium px-3 py-1.5 rounded hover:bg-dark-200 shadow-sm transition">
              Convert to Reminder
            </button>
            <button className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700 shadow-sm transition shadow-glow">
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
