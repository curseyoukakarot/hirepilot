import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SettingsProfileInfo from './SettingsProfileInfo';
import SettingsIntegrations from './SettingsIntegrations';
import SettingsTeamMembers from './SettingsTeamMembers';
import SettingsNotifications from './SettingsNotifications';
import SettingsApiKeys from './SettingsApiKeys';
import SettingsSalesAgent from './SettingsSalesAgent';
import SettingsCredits from './SettingsCredits';
import { supabase } from '../lib/supabaseClient';

export default function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    // Get the active tab from the URL path
    const path = location.pathname.split('/').pop();
    return path || 'profile';
  });

  const baseTabs = [
    { id: 'profile', label: 'Profile Info', path: '/settings/profile' },
    { id: 'integrations', label: 'Integrations', path: '/settings/integrations' },
    { id: 'team', label: 'Team Settings', path: '/settings/team' },
    { id: 'notifications', label: 'Notifications', path: '/settings/notifications' },
    { id: 'credits', label: 'Credits', path: '/settings/credits' },
    { id: 'api', label: 'API Keys', path: '/settings/api' }
  ];

  const [tabs, setTabs] = useState(baseTabs);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role || user?.user_metadata?.account_type;
      let filtered = [...baseTabs];
      // Determine if this user is a guest collaborator on any job
      let guestFlag = (typeof window !== 'undefined' && sessionStorage.getItem('guest_mode') === '1');
      try {
        if (user?.email) {
          const { data: guestRow } = await supabase
            .from('job_guest_collaborators')
            .select('id')
            .eq('email', user.email)
            .limit(1)
            .maybeSingle();
          if (guestRow) guestFlag = true;
        }
      } catch {}
      setIsGuest(guestFlag);
      // Hide Team Settings for free users
      if (String(role || '').toLowerCase() === 'free') {
        filtered = filtered.filter(t => t.id !== 'team');
        if (activeTab === 'team') setActiveTab('profile');
      }
      if (role === 'RecruitPro') {
        filtered = filtered.filter(t => t.id !== 'team' && t.id !== 'api');
      }
      if (role !== 'super_admin') {
        filtered = filtered.filter(t => t.id !== 'api');
        if (activeTab === 'api') setActiveTab('profile');
      }
      // Guest collaborators cannot access Integrations, Team, or Credits
      if (guestFlag) {
        filtered = filtered.filter(t => !['integrations','team','credits'].includes(t.id));
        if (['integrations','team','credits'].includes(activeTab)) setActiveTab('profile');
      }
      setTabs(filtered);
    })();
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/settings/${tabId}`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <SettingsProfileInfo />;
      case 'integrations':
        return <SettingsIntegrations />;
      case 'team':
        return <SettingsTeamMembers />;
      case 'notifications':
        return <SettingsNotifications />;
      case 'credits':
        return <SettingsCredits />;
      case 'api':
        return <SettingsApiKeys />;
      default:
        return <SettingsProfileInfo />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-gray-900">
                <i className="fa-regular fa-bell text-xl"></i>
              </button>
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
                alt="Profile"
                className="w-10 h-10 rounded-full"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 bg-white rounded-lg p-1 mb-8 border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border">
          {renderContent()}
        </div>
      </main>
    </div>
  );
} 