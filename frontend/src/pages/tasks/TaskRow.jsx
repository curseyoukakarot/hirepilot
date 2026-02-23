import React, { useState } from 'react';

function statusClass(tone) {
  if (tone === 'yellow') return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (tone === 'blue') return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (tone === 'green') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
}

export default function TaskRow({ task, selected, onSelect, onAction, currentUserId = '' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const canDelete = String(task?.raw?.created_by_user_id || '') === String(currentUserId || '');
  const rowClasses = selected
    ? 'group grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-200 bg-indigo-50 cursor-pointer items-center border-l-4 border-l-indigo-500 transition-colors'
    : task.completed
      ? 'group grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer items-center border-l-4 border-l-transparent transition-colors opacity-50'
      : task.dueOverdue
        ? 'group grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer items-center border-l-4 border-l-red-500 transition-colors'
        : 'group grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer items-center border-l-4 border-l-transparent transition-colors';

  return (
    <div className={rowClasses} onClick={() => onSelect(task.id)}>
      <div className="col-span-5 flex items-start gap-3 min-w-0">
        <button className={`mt-1 ${task.completed ? 'text-green-500' : 'text-gray-300 hover:text-indigo-500'} transition`}>
          <i className={task.completed ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={`text-sm ${task.completed ? 'font-medium text-gray-400 line-through' : 'font-semibold text-gray-900 group-hover:text-indigo-600'} transition-colors truncate`}
            >
              {task.title}
            </p>
            {task.dueOverdue && !task.completed && (
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-tight bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                Overdue
              </span>
            )}
            {selected && !task.completed && (
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                Selected
              </span>
            )}
            <div className="relative ml-1">
              <button
                className="text-xs text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
              >
                <i className="fa-solid fa-ellipsis" />
              </button>
              {menuOpen && (
                <div
                  className="absolute left-0 top-6 z-20 w-32 rounded-lg border border-gray-200 bg-white shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onAction?.(task, 'duplicate');
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onAction?.(task, 'edit');
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 ${canDelete ? 'text-red-600' : 'text-gray-300 cursor-not-allowed'}`}
                    onClick={() => {
                      if (!canDelete) return;
                      setMenuOpen(false);
                      onAction?.(task, 'delete');
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                task.priorityTone === 'red'
                  ? 'bg-red-500'
                  : task.priorityTone === 'orange'
                    ? 'bg-orange-400'
                    : 'bg-blue-400'
              }`}
              title={`${task.priority} Priority`}
            />
            <span className="text-xs text-gray-500">{task.completed ? 'Completed Today' : `${task.priority} Priority`}</span>
            {!task.completed && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <i className="fa-regular fa-comment" /> {task.commentCount}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-2">
        <a href="#" className={`text-xs font-medium ${task.completed ? 'text-gray-400 bg-gray-100' : 'text-indigo-600 bg-indigo-50'} hover:underline px-2 py-1 rounded inline-flex items-center gap-1`}>
          <i className={`${task.relatedTypeIcon} text-xs`} /> {task.relatedLabel}
        </a>
      </div>
      <div className="col-span-2">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass(task.statusTone)}`}>
          {task.status}
        </span>
      </div>
      <div className="col-span-2">
        {task.dueOverdue && !task.completed ? (
          <span className="text-xs font-medium text-red-600 flex items-center gap-1">
            <i className="fa-solid fa-circle-exclamation" /> {task.dueLabel}
          </span>
        ) : (
          <span className={`text-xs font-medium ${task.completed ? 'text-gray-400' : 'text-gray-600'}`}>{task.dueLabel}</span>
        )}
      </div>
      <div className="col-span-1 flex justify-end">
        <img className="h-6 w-6 rounded-full ring-2 ring-gray-200" src={task.ownerAvatar} alt="" />
      </div>
    </div>
  );
}
