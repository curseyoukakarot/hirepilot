import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from 'react-hot-toast';
import Step1JobDescription from "./components/CampaignWizard/Step1JobDescription";
import Step2Pipeline from './components/CampaignWizard/Step2Pipeline';
import Step3Message from './components/CampaignWizard/Step3Message';
import Step4Import from './components/CampaignWizard/Step4Import';
import Step5ReviewLaunch from './components/CampaignWizard/Step5ReviewLaunch';
import { WizardProvider, useWizard } from './context/WizardContext';
import PhantomMonitor from '../pages/phantom-monitor';
import CookieRefresh from '../pages/phantom/cookie-refresh';
import BulkCookieRefresh from '../pages/phantom/bulk-refresh';
import PhantomAnalytics from '../pages/phantom/analytics';
import SuperAdminDashboard from './screens/SuperAdminDashboard';
import { supabase } from "./lib/supabase";
import AdminUserManagement from './screens/AdminUserManagement';
import LeadSyncFailures from './screens/LeadSyncFailures';
import PhantomConfig from './screens/PhantomConfig';
import WebhookLogs from './screens/WebhookLogs';

// Lazy load screens
const SigninScreen = lazy(() => import("./screens/SigninScreen"));
const SignupScreen = lazy(() => import("./screens/SignupScreen"));
const OnboardingWizard = lazy(() => import("./screens/OnboardingWizard"));
const Dashboard = lazy(() => import("./screens/Dashboard"));
const CampaignBuilder = lazy(() => import("./screens/CampaignBuilder"));
const MessageGenerator = lazy(() => import("./screens/MessageGenerator"));
const MessagingCenter = lazy(() => import("./screens/MessagingCenter"));
const TemplateManager = lazy(() => import("./screens/TemplateManager"));
const Settings = lazy(() => import("./screens/Settings"));
const SettingsApiKeys = lazy(() => import("./screens/SettingsApiKeys"));
const SettingsTeamMembers = lazy(() => import("./screens/SettingsTeamMembers"));
const SettingsProfileInfo = lazy(() => import("./screens/SettingsProfileInfo"));
const SettingsNotifications = lazy(() => import("./screens/SettingsNotifications"));
const SettingsIntegrations = lazy(() => import("./screens/SettingsIntegrations"));
const LeadManagement = lazy(() => import("./screens/LeadManagement"));
const LeadProfileDrawer = lazy(() => import("./screens/LeadProfileDrawer"));
const PricingScreen = lazy(() => import("./screens/PricingScreen"));
const CandidateList = lazy(() => import("./screens/CandidateList"));
const JobRequisitions = lazy(() => import("./screens/JobRequisitions"));
const JobPipeline = lazy(() => import("./screens/JobPipeline"));
const Campaigns = lazy(() => import("./screens/Campaigns"));
const Analytics = lazy(() => import("./screens/Analytics"));
const BillingScreen = lazy(() => import("./screens/BillingScreen"));

// Campaign Wizard Component
function CampaignWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { wizard, setWizard } = useWizard();

  // Update wizard step based on route
  useEffect(() => {
    const path = location.pathname.split('/').pop();
    let newStep = 1;
    
    switch(path) {
      case 'pipeline':
        newStep = 2;
        break;
      case 'message':
        newStep = 3;
        break;
      case 'import-leads':
        newStep = 4;
        break;
      case 'review':
        newStep = 5;
        break;
      default:
        newStep = 1;
    }

    if (wizard.step !== newStep) {
      setWizard(prev => ({ ...prev, step: newStep }));
    }
  }, [location.pathname]);

  // Navigate based on wizard step
  useEffect(() => {
    const currentPath = location.pathname.split('/').pop();
    let targetPath = 'job-description';
    
    switch(wizard.step) {
      case 2:
        targetPath = 'pipeline';
        break;
      case 3:
        targetPath = 'message';
        break;
      case 4:
        targetPath = 'import-leads';
        break;
      case 5:
        targetPath = 'review';
        break;
    }

    if (currentPath !== targetPath) {
      navigate(targetPath);
    }
  }, [wizard.step]);

  // Render the appropriate step based on the current path
  const renderStep = () => {
    const path = location.pathname.split('/').pop();
    
    switch(path) {
      case 'job-description':
        return (
          <Step1JobDescription 
            onNext={() => navigate('pipeline')}
            onBack={() => navigate('/campaigns')}
          />
        );
      case 'pipeline':
        return (
          <Step2Pipeline 
            onBack={() => navigate('job-description')}
            onNext={() => navigate('message')}
          />
        );
      case 'message':
        return (
          <Step3Message 
            onBack={() => navigate('pipeline')}
            onNext={() => navigate('import-leads')}
          />
        );
      case 'import-leads':
        return (
          <Step4Import 
            onBack={() => navigate('message')}
            onNext={() => navigate('review')}
          />
        );
      case 'review':
        return (
          <Step5ReviewLaunch 
            onBack={() => navigate('import-leads')}
            onEdit={(step) => {
              switch(step) {
                case 'job-description':
                  navigate('job-description');
                  break;
                case 'pipeline':
                  navigate('pipeline');
                  break;
                case 'message':
                  navigate('message');
                  break;
                case 'leads':
                  navigate('import-leads');
                  break;
              }
            }}
          />
        );
      default:
        return <Navigate to="job-description" replace />;
    }
  };

  return (
    <div className="min-h-screen bg-base-50">
      {renderStep()}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WizardProvider>
        <BrowserRouter>
          <InnerApp />
        </BrowserRouter>
      </WizardProvider>
    </ErrorBoundary>
  );
}

function InnerApp() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/signup" || location.pathname === "/login";
  const navigate = useNavigate();
  const [userLoaded, setUserLoaded] = useState(false);
  const [dbRole, setDbRole] = useState(null);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to fetch role from users table
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        if (data && data.role) {
          setDbRole(data.role);
        } else if (user.user_metadata?.role) {
          setDbRole(user.user_metadata.role);
        } else {
          setDbRole(null);
        }
      } else {
        setDbRole(null);
      }
      setUserLoaded(true);
    };
    fetchRole();
  }, []);

  useEffect(() => {
    if (!userLoaded) return;
    // Use dbRole for redirect
    if (dbRole === 'super_admin') {
      if (location.pathname === '/' || location.pathname === '/dashboard') {
        console.log('Redirecting to /super-admin (dbRole)');
        navigate('/super-admin', { replace: true });
      }
    }
  }, [userLoaded, dbRole, location.pathname, navigate]);

  if (!userLoaded && !isAuthPage) {
    return <div className="flex items-center justify-center h-screen text-lg">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {!isAuthPage && <div className="fixed top-0 left-0 right-0 z-50"><Navbar /></div>}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
      <div className={`flex flex-1 ${!isAuthPage ? 'pt-[72px]' : ''}`}>
        {!isAuthPage && <div className="fixed left-0 top-[72px] bottom-0 w-64"><Sidebar /></div>}
        <main className={`flex-1 ${!isAuthPage ? 'ml-64 p-6 min-h-0 overflow-y-auto' : ''}`}>
          <Suspense fallback={<div className="text-center p-6">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/signup" element={<SignupScreen />} />
              <Route path="/login" element={<SigninScreen />} />
              <Route path="/onboarding" element={<OnboardingWizard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/new/*" element={<CampaignWizard />} />
              <Route path="/messages" element={<MessagingCenter />} />
              <Route path="/settings/*" element={<Settings />} />
              <Route path="/billing" element={<BillingScreen />} />
              <Route path="/leads" element={<LeadManagement />} />
              <Route path="/leads/profile" element={<LeadProfileDrawer />} />
              <Route path="/pricing" element={<PricingScreen />} />
              <Route path="/templates" element={<TemplateManager userId="mock-user-id" />} />
              <Route path="/candidates" element={<CandidateList />} />
              <Route path="/jobs" element={<JobRequisitions />} />
              <Route path="/jobs/pipeline" element={<JobPipeline />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/phantom-monitor" element={<PhantomMonitor />} />
              <Route path="/phantom/cookie-refresh" element={<CookieRefresh />} />
              <Route path="/phantom/bulk-refresh" element={<BulkCookieRefresh />} />
              <Route path="/phantom/analytics" element={<PhantomAnalytics />} />
              <Route path="/phantom/lead-sync-failures" element={<LeadSyncFailures />} />
              <Route path="/phantom/config" element={<PhantomConfig />} />
              <Route path="/phantom/webhook-logs" element={<WebhookLogs />} />
              <Route path="/super-admin" element={<SuperAdminDashboard />} />
              <Route path="/admin/users" element={<AdminUserManagement />} />
              <Route path="*" element={<div className="text-center text-red-500">404 - Page Not Found</div>} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
