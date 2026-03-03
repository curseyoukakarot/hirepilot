import React from 'react';

type Props = {
  conn: { connected: boolean; profileId?: string };
  onNavigate: (tab: string) => void;
};

export default function MissionsPanel({ conn, onNavigate }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: Missions grid */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Missions</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Pick a mission type to extract leads, send connections, or message prospects.
              </p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PlaceholderCard emoji="🔥" title="Post Engagement" color="bg-amber-500" />
            <PlaceholderCard emoji="🔍" title="People Search" color="bg-indigo-600" />
            <PlaceholderCard emoji="💼" title="Jobs Intent Miner" color="bg-emerald-600" />
            <PlaceholderCard emoji="🤝" title="Connect Requests" color="bg-sky-600" />
            <PlaceholderCard emoji="💬" title="Send Message" color="bg-violet-600" />
            <PlaceholderCard emoji="🔗" title="Sequences" color="bg-slate-500" comingSoon />
          </div>
        </div>
      </div>

      {/* Right: Sidebar */}
      <aside className="space-y-6">
        {/* Getting started */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold">Getting started</h3>
          <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">1</span>
              <span>Connect your LinkedIn account</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">2</span>
              <span>Pick a mission and paste a URL</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">3</span>
              <span>Hit Run — results appear in Activity</span>
            </li>
          </ol>
        </div>

        {/* Recent runs placeholder */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold">Recent runs</h3>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No runs yet. Start a mission to see activity here.</p>
          <button
            type="button"
            onClick={() => onNavigate('activity')}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
          >
            View all activity
          </button>
        </div>
      </aside>
    </div>
  );
}

/* Placeholder mission card — will be replaced by MissionCard.tsx */
function PlaceholderCard({ emoji, title, color, comingSoon }: { emoji: string; title: string; color: string; comingSoon?: boolean }) {
  return (
    <div
      className={`group w-full text-left rounded-2xl border border-slate-200 bg-slate-50 p-5 transition dark:border-slate-800 dark:bg-slate-950 ${
        comingSoon ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:hover:bg-slate-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${color} text-white shadow-sm text-lg`}>
          {emoji}
        </div>
        {comingSoon ? (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Coming soon
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
            Open →
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
    </div>
  );
}
