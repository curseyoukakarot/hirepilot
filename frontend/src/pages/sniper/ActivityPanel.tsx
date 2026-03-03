import React from 'react';

export default function ActivityPanel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Activity Log</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Track every extraction, connection, and message your automation has executed.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center py-16 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">
          📊
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-700 dark:text-slate-200">No activity yet</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Run a mission to see your job history here.
        </p>
      </div>
    </div>
  );
}
