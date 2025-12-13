import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuthQuerySync from './auth/AuthQuerySync';
import Navbar from "./components/Navbar";
import GuestLayout from './components/GuestLayout';
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
import ActionInbox from './screens/ActionInbox';
import AgentModeCenter from './pages/agent/AgentModeCenter';
import CampaignDetailDrawer from './pages/agent/CampaignDetailDrawer';
import RepliesDrawer from './pages/agent/RepliesDrawer';
import ActionInboxDrawer from './pages/agent/ActionInboxDrawer';
import CampaignsPage from './pages/SuperAdmin/sourcing/CampaignsPage';
import CampaignDetailPage from './pages/SuperAdmin/sourcing/CampaignDetailPage';
import RepliesPage from './pages/SuperAdmin/sourcing/RepliesPage';
import { supabase } from "./lib/supabaseClient";
import AdminUserManagement from './screens/AdminUserManagement';
import AdminPuppetHealth from './screens/AdminPuppetHealth';
import AdminProxyManagement from './screens/AdminProxyManagement';
import AdminAffiliatesManager from './pages/admin/AdminAffiliatesManager';
import EmailAttributionController from './pages/admin/EmailAttributionController';
import RepoGuardianPage from './pages/admin/RepoGuardianPage';
import LeadSyncFailures from './screens/LeadSyncFailures';
import PhantomConfig from './screens/PhantomConfig';
import WebhookLogs from './screens/WebhookLogs';
import HomePage from './screens/HomePage';
import Copilot from './screens/Copilot';
import Handsfree from './screens/Handsfree';
import Pricing from './screens/Pricing';
import RexChatBox from './components/RexChatBox';
import REXChat from './pages/REXChat';
import { apiPost } from './lib/api';
import BlogLandingPage from './screens/BlogLandingPage';
import MeetRex from './screens/MeetRex';
import useGAPageViews from "./hooks/useGAPageViews";
import ChromeExtension from './screens/ChromeExtension';
import ChromeExtensionPrivacy from './screens/ChromeExtensionPrivacy';
import TermsPage from './screens/TermsPage';
import RexSupport from './screens/RexSupport';
import ApiDocs from './screens/ApiDocs';
import useVersionNotifier from './hooks/useVersionNotifier.jsx';
import IntegrationsAndWorkflows from './pages/IntegrationsAndWorkflows';
import WorkflowsPage from './pages/WorkflowsPage';
import SandboxPage from './pages/SandboxPage';
import AffiliateProgram from './screens/AffiliateProgram';
import ProductHunt from './screens/ProductHunt';
import FreeForever from './screens/FreeForever';
import DfyDashboard from './screens/DfyDashboard';
import SniperTargets from './screens/SniperTargets';
import PartnersDashboard from './pages/partners/AffiliateDashboard';
import AffiliatePayouts from './pages/partners/AffiliatePayouts';
import AffiliateSettings from './pages/partners/AffiliateSettings';
import AffiliateActivity from './pages/partners/AffiliateActivity';
import PartnersLogin from './pages/partners/Login';
import PartnersSignup from './pages/partners/Signup';
import { setRefCookie } from './lib/affiliate';
import PartnersRouteGuard from './pages/partners/PartnersRouteGuard';
const RequirePartnersAuth = ({ children }) => <PartnersRouteGuard>{children}</PartnersRouteGuard>;
import RexWidget from './widgets/rex/RexWidget';
import PromoBanner from './components/PromoBanner';
import { PlanProvider, usePlan } from './context/PlanContext';
import { startSessionCookieSync } from './auth/sessionSync';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme } from './context/ThemeContext';
import { useAppMode } from './lib/appMode';
import PublicJobPage from './screens/PublicJobPage.jsx';
import ApplyForm from './screens/ApplyForm.jsx';
import ApplySuccess from './screens/ApplySuccess.jsx';
import UseCases from './screens/UseCases';
import UseCasesRecruitingAgencies from './screens/UseCasesRecruitingAgencies';
import UseCasesFractionalExecutives from './screens/UseCasesFractionalExecutives';
import UseCasesConsultants from './screens/UseCasesConsultants';
import OnboardingModals from './components/OnboardingModals';
import JobSeekerRoutes from './pages/jobseeker/JobSeekerRoutes';
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
const ZapierGuide = lazy(() => import("./pages/blog/ZapierGuide"));
const AtsIntegrations = lazy(() => import("./pages/blog/AtsIntegrations"));
const RexAgentMode = lazy(() => import("./pages/blog/RexAgentMode"));
const FreePlanPlaybook = lazy(() => import("./pages/blog/FreePlanPlaybook"));
const HirePilotFullATS = lazy(() => import("./pages/blog/HirePilotFullATS"));
const JobCollaboration = lazy(() => import("./pages/blog/JobCollaboration"));
// AutomateRecruiting Series
const AutomateRecruiting1 = lazy(() => import("./pages/blog/AutomateRecruiting1"));
const AutomateRecruiting2 = lazy(() => import("./pages/blog/AutomateRecruiting2"));
const AutomateRecruiting3 = lazy(() => import("./pages/blog/AutomateRecruiting3"));
const AutomateRecruiting4 = lazy(() => import("./pages/blog/AutomateRecruiting4"));
const AutomateRecruiting5 = lazy(() => import("./pages/blog/AutomateRecruiting5"));
const TestGmail = lazy(() => import("./pages/TestGmail"));
const SequenceDetail = lazy(() => import("./pages/sequences/SequenceDetail"));
const SniperSettings = lazy(() => import("./pages/SniperSettings"));
const SniperIntelligence = lazy(() => import("./screens/SniperIntelligence"));

// Lazy load screens
const SigninScreen = lazy(() => import("./screens/SigninScreen"));
const ResetPassword = lazy(() => import("./screens/ResetPassword"));
const SignupScreen = lazy(() => import("./screens/SignupScreen"));
const JoinInvite = lazy(() => import("./screens/JoinInvite"));
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
const JobRequisitionPage = lazy(() => import("./screens/JobRequisitionPage"));
const AcceptGuest = lazy(() => import('./screens/AcceptGuest'));
const SettingsGuest = lazy(() => import('./screens/SettingsGuest'));
const Campaigns = lazy(() => import("./screens/Campaigns"));
const Analytics = lazy(() => import("./screens/Analytics"));
const Tables = lazy(() => import("./pages/Tables"));
const TableEditor = lazy(() => import("./pages/TableEditor"));
const Dashboards = lazy(() => import("./pages/Dashboards"));
const DashboardDetail = lazy(() => import("./pages/DashboardDetail"));
const BillingScreen = lazy(() => import("./screens/BillingScreen"));
const DealsPage = lazy(() => import("./pages/DealsPage"));
const OpportunityDetail = lazy(() => import("./pages/OpportunityDetail"));
// Forms system (lazy for consistency)
const FormsHome = lazy(() => import("./pages/forms/FormsHome"));
const FormBuilderPage = lazy(() => import("./pages/forms/FormBuilderPage"));
const FormResponsesPage = lazy(() => import("./pages/forms/FormResponsesPage"));
const PublicForm = lazy(() => import("./components/forms/runtime/PublicForm"));

// Campaign Wizard Component
function CampaignWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { wizard, setWizard } = useWizard();

  // set hp_ref cookie if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) setRefCookie(ref);
  }, [location.search]);

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

  // If a campaign_id exists in query params (resuming a draft), preload it
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const campaignId = params.get('campaign_id');
    if (!campaignId) return;
    // Only fetch if not already loaded
    if (wizard?.campaign?.id === campaignId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .single();
        if (data) {
          setWizard(prev => ({ ...prev, campaign: data, campaignId: data.id }));
        }
      } catch {}
    })();
  }, [location.search]);

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
  useEffect(() => {
    const stop = startSessionCookieSync();
    return () => { try { stop(); } catch {} };
  }, []);
  useVersionNotifier();
  return (
    <ErrorBoundary>
      <WizardProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ThemeProvider>
            <PlanProvider>
              <AuthQuerySync />
              <InnerApp />
            </PlanProvider>
            </ThemeProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </WizardProvider>
    </ErrorBoundary>
  );
}

function InnerApp() {
  const mode = useAppMode();
  const location = useLocation();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  console.log('[MODE DEBUG]', {
    hostname,
    path: location.pathname,
    mode,
  });

  // Onboarding: only serve on jobs domain; otherwise redirect to jobs
  if (location.pathname === '/onboarding') {
    if (hostname.startsWith('jobs.')) {
      return <JobSeekerRoutes />;
    }
    if (typeof window !== 'undefined') {
      window.location.replace('https://jobs.thehirepilot.com/onboarding');
    }
    return null;
  }

  if (mode === 'job_seeker') {
    return <JobSeekerRoutes />;
  }

  const landingPages = ["/", "/signup", "/join", "/login", "/reset-password", "/copilot", "/enterprise", "/pricing", "/rex", "/rexsupport", "/chromeextension", "/chromeextension/privacy", "/terms", "/apidoc", "/test-gmail", "/affiliates", "/blog/zapierguide", "/producthunt", "/dfydashboard", "/freeforever", "/jobs/share", "/apply", "/use-cases", "/use-cases/recruiting-agencies", "/use-cases/fractional-executives", "/use-cases/consultants"];
  // Treat blog landing and article pages as public landing pages (no dashboard UI)
  const isPartnerArea = location.pathname.startsWith('/partners');
  // Public dynamic pages (e.g., share/apply) should not be gated by auth
  const isPublicShare = location.pathname.includes('/jobs/share');
  const isPublicApply = location.pathname.includes('/apply');
  const isPublicForm = location.pathname.startsWith('/f/') || location.pathname.startsWith('/forms/public/');
  // Only the marketing page "/rex" should be treated as public; do NOT blanket-match all "/rex*" paths
  let isAuthPage = landingPages.includes(location.pathname) || location.pathname.startsWith('/blog') || isPartnerArea || isPublicShare || isPublicApply || isPublicForm;
  const isBlog = location.pathname.startsWith('/blog');
  // Whether the current authenticated user is a guest collaborator (computed below)
  const [isGuestUser, setIsGuestUser] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // Detect mobile viewport (tailwind md breakpoint ~768px)
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobile(mq.matches);
    try {
      if (mq.addEventListener) mq.addEventListener('change', apply); else mq.addListener(apply);
    } catch {}
    apply();
    return () => { try { if (mq.removeEventListener) mq.removeEventListener('change', apply); else mq.removeListener(apply); } catch {} };
  }, []);

  // Force public (marketing/blog) pages to stay in light mode; in-app follows user theme
  useEffect(() => {
    const root = document.documentElement;
    const path = location.pathname;
    const isAuthScreen = path === '/login' || path === '/signup' || path === '/reset-password';
    const isBlogArticle = path.startsWith('/blog/') && path !== '/blog';
    try {
      if (isAuthPage && !isAuthScreen) {
        root.classList.remove('dark');
      } else {
        if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
      }
      // Mark blog article pages so we can style .prose text color to white
      if (isBlogArticle) {
        root.classList.add('blog-article');
      } else {
        root.classList.remove('blog-article');
      }
    } catch {}
  }, [isAuthPage, theme, location.pathname]);

  // Initialize sidebar collapsed state from localStorage and keep it in sync via events
  useEffect(() => {
    try { setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === '1'); } catch {}
    const handler = (e) => {
      const collapsed = e?.detail?.collapsed;
      if (typeof collapsed === 'boolean') setSidebarCollapsed(collapsed);
    };
    window.addEventListener('sidebar:toggle', handler);
    return () => window.removeEventListener('sidebar:toggle', handler);
  }, []);

  // If partners routes are hit on the main domain, redirect to affiliates subdomain
  useEffect(() => {
    const host = window.location.host;
    if (isPartnerArea && host !== 'affiliates.thehirepilot.com') {
      const dest = `https://affiliates.thehirepilot.com${location.pathname}${location.search}${location.hash}`;
      window.location.replace(dest);
    }
  }, [isPartnerArea, location.pathname, location.search, location.hash]);
  const navigate = useNavigate();
  const [userLoaded, setUserLoaded] = useState(false);
  const [dbRole, setDbRole] = useState(null);
  const [paymentWarning, setPaymentWarning] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [rexFlags, setRexFlags] = useState({ producthunt: false, popup: false });
  useGAPageViews();

  function RequireSuperAdmin({ children }) {
    const location = useLocation();
    if (!userLoaded) {
      return <div className="flex items-center justify-center h-screen text-lg">Loading...</div>;
    }
    if (dbRole === 'super_admin' || dbRole === 'superadmin') {
      return children;
    }
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  // Treat /workflows as a public landing page when unauthenticated
  if (!dbRole && location.pathname === '/workflows') {
    isAuthPage = true;
  }

  // set hp_ref cookie if present on any public route
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) setRefCookie(ref);
  }, [location.search]);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to fetch role from users table
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (data?.role) {
          const normalizedRole = String(data.role).toLowerCase().replace(/\s|-/g, '_');
          setDbRole(normalizedRole);
        } else {
          setDbRole(null);
        }
        setPaymentWarning(user.payment_warning || false);
        setIsSuspended(user.is_suspended || false);

        // Compute guest flag: user has any guest collaborator rows
        try {
          const { data: guestRow } = await supabase
            .from('job_guest_collaborators')
            .select('id')
            .eq('email', user.email)
            .limit(1)
            .maybeSingle();
          setIsGuestUser(!!guestRow);
        } catch {
          setIsGuestUser(false);
        }
      } else {
        setDbRole(null);
        setIsGuestUser(false);
      }
      setUserLoaded(true);
    };
    fetchRole();
  }, []);

  // Best-effort: announce OAuth signups to Slack once per user (client-side guard)
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const key = `signup_slack_announced_${user.id}`;
        if (localStorage.getItem(key) === '1') return;
        // Only announce for social signups heuristically: if no recent email signup flow
        // We can't reliably detect provider here; this is idempotent server-side as well.
        const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/user/announce-signup`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }
        });
        if (resp.ok) {
          localStorage.setItem(key, '1');
        }
      } catch {}
    })();
  }, [userLoaded]);

  // Fetch public toggle flags for REX popup/chat behavior
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('key,value')
          .in('key', ['rex_producthunt_mode', 'rex_popup_enabled']);
        const map = Object.fromEntries((data || []).map(r => [r.key, String(r.value) === 'true' || r.value === true]));
        const flags = { producthunt: !!map.rex_producthunt_mode, popup: !!map.rex_popup_enabled };
        setRexFlags(flags);
        // Expose to the vanilla popup snippet in index.html
        if (typeof window !== 'undefined') {
          window.__REX_FLAGS__ = {
            isProductHuntMode: flags.producthunt,
            isPopupEnabled: flags.popup,
            // Surface env-configured URLs so the non-React FAQ popup in index.html can read them
            demoUrl: (import.meta?.env && import.meta.env.VITE_DEMO_URL) || undefined,
            calendlyUrl: (import.meta?.env && import.meta.env.VITE_CALENDLY_URL) || undefined,
            apiBaseUrl: (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || undefined,
          };
          try {
            window.dispatchEvent(new CustomEvent('rex_flags_ready', { detail: window.__REX_FLAGS__ }));
          } catch {}
        }
      } catch {
        // leave defaults
      }
    })();
  }, []);

  useEffect(() => {
    if (!userLoaded) return;
    // If user is authenticated and on a public landing page, send them to dashboard
    if (dbRole && landingPages.includes(location.pathname) && !['/login','/signup','/reset-password'].includes(location.pathname) && !isPublicShare && !isPublicApply) {
      navigate('/dashboard', { replace: true });
      return;
    }
    // Do not auto-redirect super admins away from the main dashboard
    if (isSuspended) {
      navigate('/pricing?payment_required=1', { replace: true });
      return;
    }
  }, [userLoaded, dbRole, location.pathname, navigate, isSuspended]);

  if (!userLoaded && !isAuthPage) {
    return <div className="flex items-center justify-center h-screen text-lg">Loading...</div>;
  }

  const isRexMobile = isMobile && location.pathname === '/rex-chat';

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
      {!isRexMobile && !isAuthPage && !isPartnerArea && !(location.pathname.startsWith('/accept-guest') || location.pathname === '/signout' || (isGuestUser && (location.pathname.startsWith('/job/') || location.pathname === '/settings'))) && (
        <div className="fixed top-0 left-0 right-0 z-50"><Navbar /></div>
      )}
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
      <div className={`flex flex-1 ${(!isRexMobile && !isAuthPage && !(location.pathname.startsWith('/accept-guest') || location.pathname === '/signout' || (isGuestUser && (location.pathname.startsWith('/job/') || location.pathname === '/settings')))) ? 'pt-[72px]' : ''}`}>
        {!isRexMobile && !isAuthPage && !isPartnerArea && !(location.pathname.startsWith('/accept-guest') || location.pathname === '/signout' || (isGuestUser && (location.pathname.startsWith('/job/') || location.pathname === '/settings'))) && (
          <div id="app-sidebar" className={`fixed left-0 top-[72px] bottom-0 ${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-200`}><Sidebar /></div>
        )}
        <main id="app-main" className={
          isRexMobile
            ? 'fixed inset-0 m-0 p-0 min-h-0 overflow-hidden'
            : `flex-1 transition-all duration-200 ${!isAuthPage && !isPartnerArea && !(location.pathname.startsWith('/accept-guest') || location.pathname === '/signout' || (isGuestUser && (location.pathname.startsWith('/job/') || location.pathname === '/settings'))) ? (location.pathname === '/rex-chat' ? `${sidebarCollapsed ? 'ml-16' : 'ml-64'} min-h-0 overflow-hidden` : `${sidebarCollapsed ? 'ml-16' : 'ml-64'} min-h-0 overflow-y-auto overflow-x-auto`) : ''}`
        } style={location.pathname.startsWith('/agent') ? { WebkitOverflowScrolling: 'touch' } : undefined}>
          {!isAuthPage && <OnboardingModals />}
          <Suspense fallback={
            <div className="flex items-center justify-center w-full h-[50vh]">
              <div className="flex items-center gap-3 text-gray-600">
                <svg className="animate-spin h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <span>Loading...</span>
              </div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<HomePage />} />
              {/* Public Forms runtime */}
              <Route path="/f/:slug" element={<PublicFormRoute />} />
              <Route path="/forms/public/:slug" element={<PublicFormRoute />} />
              <Route path="/signup" element={<SignupScreen />} />
              <Route path="/join" element={<JoinInvite />} />
              <Route path="/login" element={<SigninScreen />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<OnboardingWizard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/new/*" element={<CampaignWizard />} />
              <Route path="/messages" element={<MessagingCenter />} />
              <Route path="/sequences/:id" element={<SequenceDetail />} />
              <Route path="/settings/*" element={<Settings />} />
              <Route path="/accept-guest" element={<GuestLayout><AcceptGuest /></GuestLayout>} />
              <Route path="/settings" element={isGuestUser ? <GuestLayout><SettingsGuest /></GuestLayout> : <Settings />} />
              <Route path="/signout" element={<SignOutRedirect />} />
              <Route path="/billing" element={<BillingScreen />} />
              <Route path="/rex-chat" element={dbRole ? <REXChat /> : <Navigate to="/login" />} />
              <Route path="/sandbox" element={dbRole ? <SandboxPage /> : <Navigate to="/login" />} />
              <Route path="/jobs/share/:shareId" element={<PublicJobPage />} />
              <Route path="/jobs/share/:shareId/*" element={<PublicJobPage />} />
              <Route path="/apply/:jobId" element={<ApplyForm />} />
              <Route path="/apply/:jobId/*" element={<ApplyForm />} />
              <Route path="/apply/:jobId/success" element={<ApplySuccess />} />
              <Route path="/sniper" element={<SniperTargets />} />
              <Route path="/sniper/settings" element={<SniperSettings />} />
              <Route path="/sniper-intelligence" element={<SniperIntelligence />} />
              {/* Agent Mode Center and drawers */}
              <Route path="/agent" element={<AgentModeCenter />}>
                <Route path="campaign/:id" element={<CampaignDetailDrawer />} />
                <Route path="campaign/:id/replies" element={<RepliesDrawer />} />
                <Route path="inbox" element={<ActionInboxDrawer />} />
                {/* Advanced Agent Mode routes */}
                <Route path="advanced/console" element={<div className="p-0" />} />
                <Route path="advanced/campaigns" element={<div className="p-0" />} />
                <Route path="advanced/inbox" element={<div className="p-0" />} />
                <Route path="advanced/personas" element={<div className="p-0" />} />
                <Route path="advanced/schedules" element={<div className="p-0" />} />
              </Route>
              <Route path="/leads" element={<LeadManagement />} />
              <Route path="/leads/profile" element={<LeadProfileDrawer />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/freeforever" element={<FreeForever />} />
              <Route path="/rex" element={<MeetRex />} />
              <Route path="/workflows" element={dbRole ? <WorkflowsPage /> : <IntegrationsAndWorkflows />} />
              <Route path="/copilot" element={<Copilot />} />
              <Route path="/enterprise" element={<Handsfree />} />
              {/* Use Cases marketing pages */}
              <Route path="/use-cases" element={<UseCases />} />
              <Route path="/use-cases/recruiting-agencies" element={<UseCasesRecruitingAgencies />} />
              <Route path="/use-cases/fractional-executives" element={<UseCasesFractionalExecutives />} />
              <Route path="/use-cases/consultants" element={<UseCasesConsultants />} />
              <Route path="/templates" element={<TemplateManager userId="mock-user-id" />} />
              <Route path="/candidates" element={<CandidateList />} />
              <Route path="/jobs" element={<JobRequisitions />} />
              <Route path="/job/:id" element={isGuestUser ? <GuestLayout><JobRequisitionPage /></GuestLayout> : <JobRequisitionPage />} />
              <Route path="/job/:id/pipeline" element={<JobPipeline />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/dashboards" element={<Dashboards />} />
              <Route path="/dashboards/:id" element={<DashboardDetail />} />
              <Route path="/tables" element={<Tables />} />
              <Route path="/tables/:id/edit" element={<TableEditor />} />
              {/* Forms system (authenticated app area, paid feature) */}
              <Route path="/forms" element={<FormsPaidRoute><FormsHome /></FormsPaidRoute>} />
              <Route path="/forms/:id" element={<FormsPaidRoute><FormBuilderPage /></FormsPaidRoute>} />
              <Route path="/forms/:id/responses" element={<FormsPaidRoute><FormResponsesPage /></FormsPaidRoute>} />
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/deals/opportunities/:id" element={<OpportunityDetail />} />
              <Route path="/phantom-monitor" element={<PhantomMonitor />} />
              <Route path="/phantom/cookie-refresh" element={<CookieRefresh />} />
              <Route path="/phantom/bulk-refresh" element={<BulkCookieRefresh />} />
              <Route path="/phantom/analytics" element={<PhantomAnalytics />} />
              <Route path="/phantom/lead-sync-failures" element={<LeadSyncFailures />} />
              <Route path="/phantom/config" element={<PhantomConfig />} />
              <Route path="/phantom/webhook-logs" element={<WebhookLogs />} />
              <Route path="/super-admin" element={<RequireSuperAdmin><SuperAdminDashboard /></RequireSuperAdmin>} />
              <Route path="/super-admin/inbox" element={<RequireSuperAdmin><ActionInbox /></RequireSuperAdmin>} />
              <Route path="/super-admin/sourcing" element={<RequireSuperAdmin><CampaignsPage /></RequireSuperAdmin>} />
              <Route path="/super-admin/sourcing/campaigns/:id" element={<RequireSuperAdmin><CampaignDetailPage /></RequireSuperAdmin>} />
              <Route path="/super-admin/sourcing/campaigns/:id/replies" element={<RequireSuperAdmin><RepliesPage /></RequireSuperAdmin>} />
              <Route path="/admin/users" element={<AdminUserManagement />} />
              <Route path="/admin/repo-guardian" element={<RequireSuperAdmin><RepoGuardianPage /></RequireSuperAdmin>} />
              <Route path="/super-admin/users" element={<RequireSuperAdmin><AdminUserManagement /></RequireSuperAdmin>} />
              <Route path="/admin/puppet-health" element={<AdminPuppetHealth />} />
              <Route path="/admin/proxy-management" element={<AdminProxyManagement />} />
              <Route path="/admin/affiliates" element={<AdminAffiliatesManager />} />
              <Route path="/super-admin/affiliates" element={<RequireSuperAdmin><AdminAffiliatesManager /></RequireSuperAdmin>} />
              <Route path="/super-admin/email-attribution" element={<RequireSuperAdmin><EmailAttributionController /></RequireSuperAdmin>} />
              <Route path="/blog" element={<BlogLandingPage />} />
              <Route path="/chromeextension" element={<ChromeExtension />} />
              <Route path="/chromeextension/privacy" element={<ChromeExtensionPrivacy />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/rexsupport" element={<RexSupport />} />
              <Route path="/apidoc" element={<ApiDocs />} />
              <Route path="/affiliates" element={<AffiliateProgram />} />
              <Route path="/producthunt" element={<ProductHunt />} />
              <Route path="/dfydashboard" element={<DfyDashboard />} />
              <Route path="/partners/login" element={<PartnersLogin />} />
              <Route path="/partners/signup" element={<PartnersSignup />} />
              <Route path="/partners/dashboard" element={<RequirePartnersAuth><PartnersDashboard /></RequirePartnersAuth>} />
              <Route path="/partners/payouts" element={<RequirePartnersAuth><AffiliatePayouts /></RequirePartnersAuth>} />
              <Route path="/partners/settings" element={<RequirePartnersAuth><AffiliateSettings /></RequirePartnersAuth>} />
              <Route path="/partners/activity" element={<RequirePartnersAuth><AffiliateActivity /></RequirePartnersAuth>} />
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
              <Route path="/blog/zapierguide" element={<ZapierGuide />} />
              <Route path="/blog/ats-integrations" element={<AtsIntegrations />} />
              <Route path="/blog/agentmode" element={<RexAgentMode />} />
              <Route path="/blog/free-plan-playbook" element={<FreePlanPlaybook />} />
              <Route path="/blog/hirepilot-full-ats" element={<HirePilotFullATS />} />
              <Route path="/blog/jobcollaboration" element={<JobCollaboration />} />
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
      {/* REX widget mounted (Option A) */}
      {!(rexFlags.producthunt && rexFlags.popup && isAuthPage) && !isRexMobile && (
        <RexWidget
          mode={isAuthPage ? 'sales' : 'support'}
          config={{
            demoUrl: (import.meta?.env && import.meta.env.VITE_DEMO_URL) || undefined,
            calendlyUrl: (import.meta?.env && import.meta.env.VITE_CALENDLY_URL) || undefined,
          }}
        />
      )}
      {/* Promo banner: show on all public pages and blog landing (exclude blog articles) */}
      {isAuthPage && !location.pathname.startsWith('/blog/') && (
        <PromoBanner show={true} />
      )}
    </div>
  );
}

function FormsPaidRoute({ children }) {
  const { isFree, loading } = usePlan();
  if (loading) return <div className="flex items-center justify-center h-screen text-lg">Loading…</div>;
  if (!isFree) return children;
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-xl w-full bg-white dark:bg-gray-800 shadow rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
          <span role="img" aria-label="lock">🔒</span>
        </div>
        <h1 className="text-2xl font-semibold mb-2">Forms is a Pro feature</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Upgrade your plan to create public forms, collect responses, and route submissions to Leads, Candidates, or Custom Tables.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a href="/pricing?plan=pro" className="px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">View Plans</a>
          <a href="/freeforever" className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Learn more</a>
        </div>
      </div>
    </div>
  );
}

function SignOutRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => { await supabase.auth.signOut(); sessionStorage.removeItem('guest_mode'); navigate('/accept-guest'); })();
  }, [navigate]);
  return null;
}

function PublicFormRoute() {
  const { slug } = useParams();
  return <PublicForm slug={slug || ''} />;
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
