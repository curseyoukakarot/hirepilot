import React, { Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, Outlet, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import JobSeekerAppShell from '../../components/jobseeker/JobSeekerAppShell';
import JobSeekerDashboardPage from './JobSeekerDashboardPage';
import PrepPage from './PrepPage';
import ResumeBuilderPage from './ResumeBuilderPage';
import ResumeParserPage from './ResumeParserPage';
import LandingPageBuilderPage from './LandingPageBuilderPage';
import ResumeTemplatesPage from './ResumeTemplatesPage';
import LandingThemesPage from './LandingThemesPage';
import JobPrepChatPage from './JobPrepChatPage';
import ResumeWizardPage from './ResumeWizardPage';
import OnboardingPage from './OnboardingPage';
import JobSeekerLandingPage from './JobSeekerLandingPage';
import JobSeekerPricingPage from './JobSeekerPricingPage';
import JobRequisitions from '../../screens/JobRequisitions';
import JobRequisitionPage from '../../screens/JobRequisitionPage';
import JobSeekerLogin from './auth/JobSeekerLogin';
import JobSeekerSignup from './auth/JobSeekerSignup';
import LeadManagement from '../../screens/LeadManagement';
import Campaigns from '../../screens/Campaigns';
import MessagingCenter from '../../screens/MessagingCenter';
import AgentModeCenter from '../agent/AgentModeCenter';
import Analytics from '../../screens/Analytics';
import Settings from '../../screens/Settings';
import BillingScreen from '../../screens/BillingScreen';
import HiringManagerWizardPage from './HiringManagerWizardPage';
import ImpersonationBanner from '../../components/ImpersonationBanner';
import { supabase } from '../../lib/supabaseClient';
import AuthCallback from '../AuthCallback';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center w-full h-[50vh]">
      <div className="flex items-center gap-3 text-gray-400">
        <svg
          className="animate-spin h-5 w-5 text-indigo-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <span>Loading...</span>
      </div>
    </div>
  );
}

function JobSeekerProtected({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const location = useLocation();

  const fetchBootstrapRole = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return null;
      setBootstrapLoading(true);
      const apiBase =
        import.meta.env.VITE_BACKEND_URL ||
        (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080');
      const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/auth/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await resp.json().catch(() => ({}));
      return json?.role || null;
    } catch {
      return null;
    } finally {
      setBootstrapLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        console.log('[JOBSEEKER AUTH DEBUG]', {
          host: typeof window !== 'undefined' ? window.location.hostname : '',
          path: typeof window !== 'undefined' ? window.location.pathname : '',
          session: !!data?.session,
          user: data?.session?.user?.id,
        });
        if (!isMounted) return;
        setSession(data.session);
        if (data.session?.user?.id) {
          const meta = data.session.user.user_metadata || {};
          let roleVal = meta.account_type || meta.plan || meta.role;
          // Fetch authoritative role from bootstrap to avoid stale metadata
          const bootstrapRole = await fetchBootstrapRole();
          if (bootstrapRole) roleVal = bootstrapRole;
          setUserRole(roleVal || null);
        }
      } catch {
        if (!isMounted) return;
        setSession(null);
        setUserRole(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      (async () => {
        setSession(newSession);
        setLoading(false);
        if (newSession?.user?.id) {
          const meta = newSession.user.user_metadata || {};
          let roleVal = meta.account_type || meta.plan || meta.role;
          const bootstrapRole = await fetchBootstrapRole();
          if (bootstrapRole) roleVal = bootstrapRole;
          setUserRole(roleVal || null);
        }
      })();
    });
    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading || bootstrapLoading) return <LoadingFallback />;
  if (!session) {
    // Preserve where the user was trying to go
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  const roleLower = String(userRole || '').toLowerCase();
  const isJobSeekerRole = roleLower.startsWith('job_seeker_');
  if (!isJobSeekerRole) {
    // If role is not a job seeker, keep user on local login with message
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  const isFree = roleLower === 'free' || roleLower === 'job_seeker_free';
  const path = location.pathname;
  const isRexChat = path.startsWith('/prep/rex-chat') || path.startsWith('/prep/rexchat');
  if (isFree) {
    const blockingPrep = path.startsWith('/prep') && !isRexChat;
    const blockingAgent = path.startsWith('/agent-mode');
    if (blockingPrep || blockingAgent) {
      const blocked = blockingPrep ? 'prep' : 'agent';
      return <Navigate to="/dashboard" replace state={{ blocked }} />;
    }
  }

  if (children) return <>{children}</>;
  // Fallback to outlet if used as a wrapper route element
  return <Outlet />;
}

function JobIdRedirect() {
  const { id } = useParams();
  const target = id ? `/jobs/${id}` : '/jobs';
  return <Navigate to={target} replace />;
}

function JobListRedirect() {
  return <Navigate to="/jobs" replace />;
}

export default function JobSeekerRoutes() {
  useEffect(() => {
    try {
      console.log('[JOBSEEKER ROUTES MOUNT]', {
        host: typeof window !== 'undefined' ? window.location.hostname : '',
        path: typeof window !== 'undefined' ? window.location.pathname : '',
      });
    } catch {}
  }, []);

  return (
    <>
      <ImpersonationBanner />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#333', color: '#fff' },
        }}
      />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<JobSeekerLandingPage />} />
          <Route path="/pricing" element={<JobSeekerPricingPage />} />
          <Route path="/login" element={<JobSeekerLogin />} />
          <Route path="/signup" element={<JobSeekerSignup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Allow onboarding to render even if not authenticated */}
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Normalize singular /job paths to plural routes */}
          <Route path="/job/:id" element={<JobIdRedirect />} />
          <Route path="/job" element={<JobListRedirect />} />

          {/* Job routes explicitly protected and mounted before any catch-alls */}
          <Route
            path="/jobs/:id"
            element={
              <JobSeekerProtected>
                <JobSeekerAppShell>
                  <JobRequisitionPage />
                </JobSeekerAppShell>
              </JobSeekerProtected>
            }
          />
          <Route
            path="/jobs"
            element={
              <JobSeekerProtected>
                <JobSeekerAppShell>
                  <JobRequisitions />
                </JobSeekerAppShell>
              </JobSeekerProtected>
            }
          />

          {/* Other protected routes via shell */}
          <Route
            element={
              <JobSeekerProtected>
                <JobSeekerAppShell />
              </JobSeekerProtected>
            }
          >
            <Route path="/dashboard" element={<JobSeekerDashboardPage />} />
            <Route path="/leads" element={<LeadManagement />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/prep" element={<PrepPage />} />
            <Route path="/prep/resume/templates" element={<ResumeTemplatesPage />} />
            <Route path="/prep/resume/wizard" element={<ResumeWizardPage />} />
            <Route path="/prep/resume/builder" element={<ResumeBuilderPage />} />
            <Route path="/prep/resume-builder" element={<Navigate to="/prep/resume/builder" replace />} />
            <Route path="/prep/resume-parser" element={<ResumeParserPage />} />
            <Route path="/prep/landing-page" element={<LandingPageBuilderPage />} />
            <Route path="/prep/landing/themes" element={<LandingThemesPage />} />
            <Route path="/prep/rex-chat" element={<JobPrepChatPage />} />
            <Route path="/messages" element={<MessagingCenter />} />
            <Route path="/campaigns/new/*" element={<Navigate to="/campaigns" replace />} />
            <Route path="/campaigns/wizard" element={<HiringManagerWizardPage />} />
            <Route path="/agent-mode" element={<AgentModeCenter />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings/*" element={<Settings />} />
            <Route path="/billing" element={<BillingScreen />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
