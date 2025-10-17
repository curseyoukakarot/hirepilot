import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlan } from '../../context/PlanContext';
import { Outlet } from 'react-router-dom';
import CampaignsPanel from './CampaignsPanel';
import SniperTargetsPanel from './SniperTargetsPanel';
import ActionInboxPanel from './ActionInboxPanel';
import SalesAgentSettingsCard from './SalesAgentSettingsCard';
import PersonasPanel from './PersonasPanel';
import SchedulesPanel from './SchedulesPanel';
import CreateScheduleModal from './CreateScheduleModal';
import REXConsole from './REXConsole';

export default function AgentModeCenter() {
  const { isFree, role } = usePlan() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<'console' | 'personas' | 'schedules' | 'campaigns' | 'inbox'>(() => {
    const path = location.pathname;
    if (path.startsWith('/agent/advanced/campaigns')) return 'campaigns';
    if (path.startsWith('/agent/advanced/inbox')) return 'inbox';
    if (path.startsWith('/agent/advanced/personas')) return 'personas';
    if (path.startsWith('/agent/advanced/schedules')) return 'schedules';
    return 'console';
  });
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [modalPersonaId, setModalPersonaId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/agent/advanced/campaigns')) setTab('campaigns');
    else if (path.startsWith('/agent/advanced/inbox')) setTab('inbox');
    if (path.startsWith('/agent/advanced/personas')) setTab('personas');
    else if (path.startsWith('/agent/advanced/schedules')) setTab('schedules');
    else setTab('console');
  }, [location.pathname]);

  const tabStyle = (active: boolean) =>
    `px-4 py-2 rounded-full font-medium transition-colors text-sm ${
      active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;

  // Never block super admins regardless of plan
  const normalizedRole = String(role || '').toLowerCase().replace(/\s|-/g, '_');
  const isSuperAdmin = ['super_admin','superadmin'].includes(normalizedRole);
  if (isFree && !isSuperAdmin) {
    return (
      <div className="p-6 w-full min-h-screen bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mt-8">
            <h2 className="text-xl font-bold text-yellow-800 mb-2">Agent Mode is a paid plan feature</h2>
            <p className="text-yellow-700 mb-4">Upgrade to unlock autonomous sourcing and campaigns.</p>
            <a href="/pricing" className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">See Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 w-full min-h-screen bg-gray-900">
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
        <button onClick={() => navigate('/agent/advanced/console')} className={tabStyle(tab === 'console')}>
          💬 REX Console
        </button>
        <button onClick={() => navigate('/super-admin/sourcing')} className={tabStyle(tab === 'campaigns')}>
          📦 Campaigns
        </button>
        <button onClick={() => navigate('/super-admin/inbox')} className={tabStyle(tab === 'inbox')}>
          📨 Action Inbox
        </button>
        <button onClick={() => navigate('/agent/advanced/personas')} className={tabStyle(tab === 'personas')}>
          🧠 Personas
        </button>
        <button onClick={() => navigate('/agent/advanced/schedules')} className={tabStyle(tab === 'schedules')}>
          ⏱️ Schedules
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          {tab === 'console' && (
            <REXConsole />
          )}
          {tab === 'campaigns' && (
            <CampaignsPanel />
          )}
          {tab === 'inbox' && (
            <ActionInboxPanel />
          )}
          {tab === 'personas' && (
            <PersonasPanel
              onUseInScheduler={(persona) => {
                setModalPersonaId(persona.id);
                setShowCreateSchedule(true);
              }}
              onCreatePersona={() => {
                // Placeholder: In V1 we can reuse the schedule modal to collect persona basics later
                alert('Create Persona (UI only placeholder)');
              }}
            />
          )}
          {tab === 'schedules' && (
            <SchedulesPanel
              onCreate={() => {
                setModalPersonaId(undefined);
                setShowCreateSchedule(true);
              }}
              onEdit={() => { /* placeholder */ }}
              onPause={() => { /* placeholder */ }}
              onDelete={() => { /* placeholder */ }}
            />
          )}
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <SalesAgentSettingsCard />
        </div>
      </div>

      {/* Nested drawers mount here */}
      <Outlet />
      {showCreateSchedule && (
        <CreateScheduleModal
          open={showCreateSchedule}
          onClose={() => setShowCreateSchedule(false)}
          defaultPersonaId={modalPersonaId}
        />
      )}
    </div>
  );
}


