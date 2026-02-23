import React from 'react';
import TaskRow from './TaskRow';

export default function TasksList({ tasks, selectedTaskId, onSelectTask, onTaskAction, currentUserId = '' }) {
  return (
    <div className="bg-dark-300 shadow-card rounded-lg overflow-hidden flex-1 flex flex-col border border-gray-800 min-h-0">
      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-dark-200 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        <div className="col-span-5">Task</div>
        <div className="col-span-2">Related To</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Due Date</div>
        <div className="col-span-1 text-right">Owner</div>
      </div>

      <div className="overflow-y-auto flex-1">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            selected={selectedTaskId === task.id}
            onSelect={onSelectTask}
            onAction={onTaskAction}
            currentUserId={currentUserId}
          />
        ))}
        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm text-gray-500 p-10">
            No tasks match this view.
          </div>
        )}
      </div>
    </div>
  );
}
