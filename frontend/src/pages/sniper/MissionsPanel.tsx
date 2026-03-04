import React, { useState } from 'react';
import MissionCard from './MissionCard';
import MissionDrawer from './MissionDrawer';
import CampaignBuilder from './CampaignBuilder';
import type { MissionDef } from './MissionCard';

/* ------------------------------------------------------------------ */
/*  Mission definitions                                                */
/* ------------------------------------------------------------------ */

const MISSIONS: MissionDef[] = [
  {
    id: 'post_engagement',
    emoji: '\uD83D\uDD25',
    title: 'Post Engagement',
    description: 'Extract likers and commenters from any LinkedIn post.',
    color: 'bg-amber-500',
    status: 'implemented',
  },
  {
    id: 'people_search',
    emoji: '\uD83D\uDD0D',
    title: 'People Search',
    description: 'Scrape profiles from a LinkedIn people search URL.',
    color: 'bg-indigo-600',
    status: 'implemented',
  },
  {
    id: 'jobs_intent',
    emoji: '\uD83D\uDCBC',
    title: 'Jobs Intent Miner',
    description: 'Extract job postings from a LinkedIn Jobs search.',
    color: 'bg-emerald-600',
    status: 'implemented',
  },
  {
    id: 'decision_maker_lookup',
    emoji: '\uD83C\uDFAF',
    title: 'Decision Maker Lookup',
    description: 'Find key contacts at companies from LinkedIn company pages.',
    color: 'bg-teal-600',
    status: 'implemented',
  },
  {
    id: 'connect_requests',
    emoji: '\uD83E\uDD1D',
    title: 'Connect Requests',
    description: 'Queue LinkedIn connection requests via Cloud Engine.',
    color: 'bg-sky-600',
    status: 'implemented',
  },
  {
    id: 'send_message',
    emoji: '\uD83D\uDCAC',
    title: 'Send Message',
    description: 'Send messages to 1st connections via Cloud Engine.',
    color: 'bg-violet-600',
    status: 'implemented',
  },
  {
    id: 'sequences',
    emoji: '\uD83D\uDD17',
    title: 'Sequences',
    description: 'Multi-step campaigns with connect, message, and follow-up.',
    color: 'bg-gradient-to-br from-indigo-500 to-violet-600',
    status: 'implemented',
  },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type Props = {
  conn: { connected: boolean; profileId?: string };
  onNavigate: (tab: string) => void;
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function MissionsPanel({ conn, onNavigate }: Props) {
  const [activeMission, setActiveMission] = useState<MissionDef | null>(null);
  const [showCampaigns, setShowCampaigns] = useState(false);

  const handleMissionClick = (m: MissionDef) => {
    if (m.id === 'sequences') {
      setShowCampaigns(true);
    } else {
      setActiveMission(m);
    }
  };

  return (
    <>
      {/* Campaign Builder overlay */}
      {showCampaigns && (
        <CampaignBuilder onClose={() => setShowCampaigns(false)} />
      )}

      {/* Mission Drawer overlay */}
      {activeMission && (
        <MissionDrawer
          mission={activeMission}
          conn={conn}
          onClose={() => setActiveMission(null)}
          onNavigate={(tab) => { setActiveMission(null); onNavigate(tab); }}
        />
      )}

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
              {MISSIONS.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  onClick={() => handleMissionClick(m)}
                />
              ))}
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
                <span>Hit Run &mdash; results appear in Activity</span>
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
    </>
  );
}
