import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import CampaignsPanel from './CampaignsPanel';
import SniperTargetsPanel from './SniperTargetsPanel';
import ActionInboxPanel from './ActionInboxPanel';

export default function AgentModeCenter() {
  const [tab, setTab] = useState<'campaigns' | 'sniper' | 'inbox'>('campaigns');

  const tabStyle = (active: boolean) =>
    `px-4 py-2 rounded-full font-medium transition-colors text-sm ${
      active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-900">
      <h1 className="text-3xl font-bold text-white mb-2">Agent Mode Center</h1>
      <p className="text-gray-400 mb-6">Your recruiting assistant’s mission control.</p>

      <div className="flex space-x-3 mb-6">
        <button onClick={() => setTab('campaigns')} className={tabStyle(tab === 'campaigns')}>
          📦 Campaigns
        </button>
        <button onClick={() => setTab('sniper')} className={tabStyle(tab === 'sniper')}>
          🎯 Sniper Targets
        </button>
        <button onClick={() => setTab('inbox')} className={tabStyle(tab === 'inbox')}>
          📨 Action Inbox
        </button>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        {tab === 'campaigns' && <CampaignsPanel />}
        {tab === 'sniper' && <SniperTargetsPanel />}
        {tab === 'inbox' && <ActionInboxPanel />}
      </div>

      {/* Nested drawers mount here */}
      <Outlet />
    </div>
  );
}


