import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import AdminPuppetHealth from './screens/AdminPuppetHealth';
import AdminProxyManagement from './screens/AdminProxyManagement';
import LeadSyncFailures from './screens/LeadSyncFailures';
import PhantomConfig from './screens/PhantomConfig';
import WebhookLogs from './screens/WebhookLogs';
import HomePage from './screens/HomePage';
import Copilot from './screens/Copilot';
import Handsfree from './screens/Handsfree';
import Pricing from './screens/Pricing';
import RexChatBox from './components/RexChatBox';
import RexChatPage from './screens/RexChatPage';
import { apiPost } from './lib/api';
import BlogLandingPage from './screens/BlogLandingPage';
import MeetRex from './screens/MeetRex';
import useGAPageViews from "./hooks/useGAPageViews";
import ChromeExtension from './screens/ChromeExtension';
import ChromeExtensionPrivacy from './screens/ChromeExtensionPrivacy';
import TermsPage from './screens/TermsPage';
import RexSupport from './screens/RexSupport';
import ApiDocs from './screens/ApiDocs';
// Blog article pages
const FlowOfHirePilot = lazy(() => import("./pages/blog/FlowOfHirePilot"));
const MessageCenterSetup = lazy(() => import("./pages/blog/MessageCenterSetup"));
const ApolloIntegrationGuide = lazy(() => import("./pages/blog/ApolloIntegrationGuide"));
const LinkedInSalesNavigatorGuide = lazy(() => import("./pages/blog/LinkedInSalesNavigatorGuide"));
const MeetRexGuide = lazy(() => import("./pages/blog/MeetRexGuide"));
const ImportCsvGuide = lazy(() => import("./pages/blog/ImportCsvGuide"));
const CampaignWizardGuide = lazy(() => import("./pages/blog/CampaignWizardGuide"));
const PipelineBestPracticesGuide = lazy(() => import("./pages/blog/PipelineBestPracticesGuide"));
const EmailTroubleshootingGuide = lazy(() => import("./pages/blog/EmailTroubleshootingGuide"));
const EmailDeliverability1 = lazy(() => import("./pages/blog/EmailDeliverability1"));
const EmailDeliverability2 = lazy(() => import("./pages/blog/EmailDeliverability2"));
const EmailDeliverability3 = lazy(() => import("./pages/blog/EmailDeliverability3"));
const EmailDeliverability4 = lazy(() => import("./pages/blog/EmailDeliverability4"));
const EmailDeliverability5 = lazy(() => import("./pages/blog/EmailDeliverability5"));
const CreditsGuide = lazy(() => import("./pages/blog/CreditsGuide"));
// AutomateRecruiting Series
const AutomateRecruiting1 = lazy(() => import("./pages/blog/AutomateRecruiting1"));
const AutomateRecruiting2 = lazy(() => import("./pages/blog/AutomateRecruiting2"));
const AutomateRecruiting3 = lazy(() => import("./pages/blog/AutomateRecruiting3"));
const AutomateRecruiting4 = lazy(() => import("./pages/blog/AutomateRecruiting4"));
const AutomateRecruiting5 = lazy(() => import("./pages/blog/AutomateRecruiting5"));
const TestGmail = lazy(() => import("./pages/TestGmail"));

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
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <InnerApp />
          </BrowserRouter>
        </QueryClientProvider>
      </WizardProvider>
    </ErrorBoundary>
  );
}

function InnerApp() {
  const location = useLocation();
  const landingPages = ["/", "/signup", "/login", "/copilot", "/handsfree", "/pricing", "/rex", "/chromeextension", "/chromeextension/privacy", "/terms", "/apidoc", "/test-gmail"];
  // Treat blog landing and article pages as public landing pages (no dashboard UI)
  const isAuthPage = landingPages.includes(location.pathname) || location.pathname.startsWith('/blog') || location.pathname.startsWith('/rex');
  const navigate = useNavigate();
  const [userLoaded, setUserLoaded] = useState(false);
  const [dbRole, setDbRole] = useState(null);
  const [paymentWarning, setPaymentWarning] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  useGAPageViews();

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
        } else {
          setDbRole(null);
        }
        setPaymentWarning(user.payment_warning || false);
        setIsSuspended(user.is_suspended || false);
      } else {
        setDbRole(null);
      }
      setUserLoaded(true);
    };
    fetchRole();
  }, []);

  useEffect(() => {
    if (!userLoaded) return;
    // If user is authenticated and on a public landing page, send them to dashboard
    if (dbRole && landingPages.includes(location.pathname) && !['/login','/signup'].includes(location.pathname)) {
      navigate('/dashboard', { replace: true });
      return;
    }
    // Use dbRole for redirect
    if (dbRole === 'super_admin') {
      if (location.pathname === '/' || location.pathname === '/dashboard') {
        console.log('Redirecting to /super-admin (dbRole)');
        navigate('/super-admin', { replace: true });
      }
    }
    if (isSuspended) {
      navigate('/pricing?payment_required=1', { replace: true });
      return;
    }
  }, [userLoaded, dbRole, location.pathname, navigate, isSuspended]);

  if (!userLoaded && !isAuthPage) {
    return <div className="flex items-center justify-center h-screen text-lg">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {paymentWarning && !isSuspended && (
        <div className="w-full bg-red-600 text-white text-center py-2 text-sm flex items-center justify-center gap-3">
          <span>Payment failed – update your card to avoid account suspension.</span>
          <button className="underline" onClick={async()=>{
            const { data } = await apiPost('/api/stripe/create-portal-session', {}, { requireAuth:true });
            window.location = data.url;
          }}>Update payment</button>
        </div>
      )}
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
              <Route path="/" element={<HomePage />} />
              <Route path="/signup" element={<SignupScreen />} />
              <Route path="/login" element={<SigninScreen />} />
              <Route path="/onboarding" element={<OnboardingWizard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/new/*" element={<CampaignWizard />} />
              <Route path="/messages" element={<MessagingCenter />} />
              <Route path="/settings/*" element={<Settings />} />
              <Route path="/billing" element={<BillingScreen />} />
              <Route path="/rex-chat" element={<RexChatPage />} />
              <Route path="/leads" element={<LeadManagement />} />
              <Route path="/leads/profile" element={<LeadProfileDrawer />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/rex" element={<MeetRex />} />
              <Route path="/copilot" element={<Copilot />} />
              <Route path="/handsfree" element={<Handsfree />} />
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
              <Route path="/admin/puppet-health" element={<AdminPuppetHealth />} />
              <Route path="/admin/proxy-management" element={<AdminProxyManagement />} />
              <Route path="/blog" element={<BlogLandingPage />} />
              <Route path="/chromeextension" element={<ChromeExtension />} />
              <Route path="/chromeextension/privacy" element={<ChromeExtensionPrivacy />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/rexsupport" element={<RexSupport />} />
              <Route path="/apidoc" element={<ApiDocs />} />
              <Route path="/test-gmail" element={<TestGmail />} />
              {/* Blog articles */}
              <Route path="/blog/flow-of-hirepilot" element={<FlowOfHirePilot />} />
              <Route path="/blog/message-center-setup" element={<MessageCenterSetup />} />
              <Route path="/blog/apollo-integration" element={<ApolloIntegrationGuide />} />
              <Route path="/blog/linkedin-sales-navigator" element={<LinkedInSalesNavigatorGuide />} />
              <Route path="/blog/meet-rex" element={<MeetRexGuide />} />
              <Route path="/blog/import-csv" element={<ImportCsvGuide />} />
              <Route path="/blog/campaign-wizard" element={<CampaignWizardGuide />} />
              <Route path="/blog/PipelineBestPractices" element={<PipelineBestPracticesGuide />} />
              <Route path="/blog/email-troubleshooting" element={<EmailTroubleshootingGuide />} />
              <Route path="/blog/CreditsGuide" element={<CreditsGuide />} />
              {/* Email Deliverability Series */}
              <Route path="/blog/email-deliverability-1" element={<EmailDeliverability1 />} />
              <Route path="/blog/email-deliverability-2" element={<EmailDeliverability2 />} />
              <Route path="/blog/email-deliverability-3" element={<EmailDeliverability3 />} />
              <Route path="/blog/email-deliverability-4" element={<EmailDeliverability4 />} />
              <Route path="/blog/email-deliverability-5" element={<EmailDeliverability5 />} />
              {/* AutomateRecruiting Series */}
              <Route path="/blog/AutomateRecruiting1" element={<AutomateRecruiting1 />} />
              <Route path="/blog/AutomateRecruiting2" element={<AutomateRecruiting2 />} />
              <Route path="/blog/AutomateRecruiting3" element={<AutomateRecruiting3 />} />
              <Route path="/blog/AutomateRecruiting4" element={<AutomateRecruiting4 />} />
              <Route path="/blog/AutomateRecruiting5" element={<AutomateRecruiting5 />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // Data is considered fresh for 30 seconds
      retry: 1, // Retry failed requests once
      refetchOnWindowFocus: false, // Don't refetch on window focus
    },
  },
});
