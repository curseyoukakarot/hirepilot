import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import SigninScreen from './screens/SigninScreen';
import SignupScreen from './screens/SignupScreen';
import OnboardingWizard from './screens/OnboardingWizard';
import Dashboard from './screens/Dashboard';
import CampaignBuilder from './screens/CampaignBuilder';
import MessageGenerator from './screens/MessageGenerator';
import SettingsApiKeys from './screens/SettingsApiKeys';
import SettingsTeamMembers from './screens/SettingsTeamMembers';
import SettingsProfile from './screens/SettingsProfile';
import SettingsNotifications from './screens/SettingsNotifications';
import SettingsIntegrations from './screens/SettingsIntegrations';
import LeadManagement from './screens/LeadManagement';
import LeadProfileDrawer from './screens/LeadProfileDrawer';
import PricingScreen from './screens/PricingScreen';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-semibold text-blue-600">HirePilot</span>
          </div>
          <nav className="flex items-center space-x-6 text-sm text-gray-600">
            <Link to="/dashboard" className="hover:text-gray-900">Dashboard</Link>
            <Link to="/campaigns" className="hover:text-gray-900">Campaigns</Link>
            <Link to="/leads" className="hover:text-gray-900">Leads</Link>
            <Link to="/pricing" className="hover:text-gray-900 font-medium text-blue-600">Pricing</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<SigninScreen />} />
          <Route path="/signup" element={<SignupScreen />} />
          <Route path="/onboarding" element={<OnboardingWizard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/campaigns" element={<CampaignBuilder />} />
          <Route path="/messages" element={<MessageGenerator />} />
          <Route path="/settings/api" element={<SettingsApiKeys />} />
          <Route path="/settings/team" element={<SettingsTeamMembers />} />
          <Route path="/settings/profile" element={<SettingsProfile />} />
          <Route path="/settings/notifications" element={<SettingsNotifications />} />
          <Route path="/settings/integrations" element={<SettingsIntegrations />} />
          <Route path="/leads" element={<LeadManagement />} />
          <Route path="/leads/profile" element={<LeadProfileDrawer />} />
          <Route path="/pricing" element={<PricingScreen />} />
        </Routes>
      </div>
    </Router>
  );
}
