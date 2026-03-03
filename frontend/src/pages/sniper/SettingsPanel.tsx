import React from 'react';

type Props = {
  conn: { connected: boolean; profileId?: string };
  onStatusChange: () => void;
};

export default function SettingsPanel({ conn, onStatusChange }: Props) {
  return (
    <div className="space-y-6">
      {/* Cloud Engine status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Cloud Engine</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Manage your cloud browser connection and automation guardrails.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              conn.connected
                ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                : 'bg-amber-500/10 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${conn.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {conn.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Settings panel is being rebuilt. Full guardrails and connection controls coming shortly.
          </p>
          {conn.profileId && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Profile: {conn.profileId}
            </p>
          )}
        </div>
      </div>

      {/* Guardrails placeholder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-bold">Guardrails</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Rate limits, operating hours, and safety controls will appear here.
        </p>
      </div>
    </div>
  );
}
