import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';
import SettingsProfileInfo from './SettingsProfileInfo';
import SettingsIntegrations from './SettingsIntegrations';
import SettingsTeamMembers from './SettingsTeamMembers';
import SettingsNotifications from './SettingsNotifications';
import SettingsApiKeys from './SettingsApiKeys';
import SettingsSalesAgent from './SettingsSalesAgent';
import SettingsCredits from './SettingsCredits';
import JobSeekerCloudEngineSettings from './JobSeekerCloudEngineSettings';
import { supabase } from '../lib/supabaseClient';
import { useAppMode } from '../lib/appMode';

export default function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const appMode = useAppMode();
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
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profileName, setProfileName] = useState('Profile');
  const { progress } = useOnboardingProgress();
  const completionPct = progress?.total_steps ? Math.round((progress.total_completed / progress.total_steps) * 100) : 0;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role || user?.user_metadata?.account_type;
      let filtered = [...baseTabs];
      // Hide Team Settings entirely for job seekers
      if (appMode === 'job_seeker') {
        filtered = filtered.filter(t => t.id !== 'team');
        filtered.push({ id: 'cloud-engine', label: 'Cloud Engine', path: '/settings/cloud-engine' });
      }
      // Determine if this user is a guest collaborator on any job
      let guestFlag = (typeof window !== 'undefined' && sessionStorage.getItem('guest_mode') === '1');
      let derivedDisplayName = '';
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
      try {
        if (user?.id) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('avatar_url, first_name, last_name')
            .eq('id', user.id)
            .maybeSingle();
          const meta = user?.user_metadata || {};
          const nameParts = [
            userProfile?.first_name || meta.first_name || meta.firstName || '',
            userProfile?.last_name || meta.last_name || meta.lastName || ''
          ].filter(Boolean);
          derivedDisplayName = nameParts.join(' ').trim() || meta.full_name || meta.name || user?.email || 'User';
          const avatarCandidate =
            userProfile?.avatar_url ||
            meta.avatar_url ||
            meta.photo_url ||
            meta.profile_image_url ||
            meta.picture ||
            meta.image ||
            null;
          const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(derivedDisplayName)}&background=random`;
          setProfilePhoto(avatarCandidate || fallbackAvatar);
          setProfileName(derivedDisplayName);
        }
      } catch (avatarErr) {
        const fallbackName = derivedDisplayName || user?.email || 'User';
        setProfileName(fallbackName);
        setProfilePhoto(`https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`);
        console.warn('Failed to load profile avatar', avatarErr);
      }
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
      case 'cloud-engine':
        return <JobSeekerCloudEngineSettings />;
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
                src={profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=random`}
                alt={profileName || 'Profile'}
                className="w-10 h-10 rounded-full object-cover border border-gray-200"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {appMode === 'job_seeker' && (
          <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Job Search Setup</div>
              <div className="text-sm text-blue-800">
                {progress?.total_completed ?? 0} of {progress?.total_steps ?? 7} complete — {progress?.total_credits_awarded ?? 0}/100 credits earned
              </div>
              <div className="mt-2 w-64 bg-white/70 rounded-full h-2 overflow-hidden">
                <div className="h-2 bg-blue-500" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-500"
            >
              Continue setup
            </button>
          </div>
        )}

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