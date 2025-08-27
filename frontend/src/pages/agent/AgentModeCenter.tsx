import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import CampaignsPanel from './CampaignsPanel';
import SniperTargetsPanel from './SniperTargetsPanel';
import ActionInboxPanel from './ActionInboxPanel';
import SalesAgentSettingsCard from './SalesAgentSettingsCard';

export default function AgentModeCenter() {
  const [tab, setTab] = useState<'campaigns' | 'sniper' | 'inbox'>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = (params.get('tab') || '').toLowerCase();
    return (['campaigns','sniper','inbox'] as const).includes(t as any) ? (t as any) : 'campaigns';
  });

  const tabStyle = (active: boolean) =>
    `px-4 py-2 rounded-full font-medium transition-colors text-sm ${
      active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-900">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-white">Agent Mode Center</h1>
          <p className="text-gray-400">Your recruiting assistant’s mission control.</p>
        </div>
        {/* Top-right Chat with REX button (hidden if campaigns exist via CampaignsPanel empty state handles link) */}
        <a href="/rex-chat" className="hidden md:inline-flex items-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium">🤖 Chat with REX</a>
      </div>
      <div className="h-2" />

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          {tab === 'campaigns' && <CampaignsPanel />}
          {tab === 'sniper' && <SniperTargetsPanel />}
          {tab === 'inbox' && <ActionInboxPanel />}
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <SalesAgentSettingsCard />
        </div>
      </div>

      {/* Nested drawers mount here */}
      <Outlet />
    </div>
  );
}


