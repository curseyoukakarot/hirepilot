import React, { useMemo, useState } from 'react';

const INITIAL_FORM = {
  title: '',
  description: '',
  assignee: 'Sarah Johnson',
  dueDate: '',
  relatedObject: '',
};

export default function TaskCreateModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [attempted, setAttempted] = useState(false);

  const titleError = useMemo(() => (attempted && !form.title.trim() ? 'Task title is required.' : ''), [attempted, form.title]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div className="inline-block align-bottom bg-dark-300 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-800">
          <div className="bg-dark-300 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-white" id="modal-title">
                  Create New Task
                </h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400">Task Title</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      className={`mt-1 block w-full border-gray-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm border p-2 bg-dark-200 text-gray-200 placeholder-gray-500 ${titleError ? 'border-red-500' : ''}`}
                      placeholder="e.g. Call candidate John Doe"
                    />
                    {titleError && <p className="mt-1 text-xs text-red-400">{titleError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">Description</label>
                    <textarea
                      rows="3"
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="mt-1 block w-full border-gray-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm border p-2 bg-dark-200 text-gray-200 placeholder-gray-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400">Assignee</label>
                      <select
                        value={form.assignee}
                        onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value }))}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md border bg-dark-200 text-gray-200"
                      >
                        <option>Sarah Johnson</option>
                        <option>Mike Ross</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400">Due Date</label>
                      <input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                        className="mt-1 block w-full border-gray-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm border p-2 bg-dark-200 text-gray-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">Related Object</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i className="fa-solid fa-magnifying-glass text-gray-500" />
                      </div>
                      <input
                        type="text"
                        value={form.relatedObject}
                        onChange={(e) => setForm((prev) => ({ ...prev, relatedObject: e.target.value }))}
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-700 rounded-md border p-2 bg-dark-200 text-gray-200 placeholder-gray-500"
                        placeholder="Search candidates, jobs, or notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-dark-200 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-800">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm transition shadow-glow"
              onClick={() => {
                setAttempted(true);
                if (!form.title.trim()) return;
                onCreate(form);
                setForm(INITIAL_FORM);
                setAttempted(false);
              }}
            >
              Create Task
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-700 shadow-sm px-4 py-2 bg-dark-300 text-base font-medium text-gray-300 hover:bg-dark-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition"
              onClick={() => {
                setForm(INITIAL_FORM);
                setAttempted(false);
                onClose();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
