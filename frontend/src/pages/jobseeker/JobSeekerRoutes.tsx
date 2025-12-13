import React, { Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, Outlet, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import JobSeekerAppShell from '../../components/jobseeker/JobSeekerAppShell';
import JobSeekerDashboardPage from './JobSeekerDashboardPage';
import PrepPage from './PrepPage';
import ResumeBuilderPage from './ResumeBuilderPage';
import ResumeParserPage from './ResumeParserPage';
import LandingPageBuilderPage from './LandingPageBuilderPage';
import JobPrepChatPage from './JobPrepChatPage';
import ResumeWizardPage from './ResumeWizardPage';
import OnboardingPage from './OnboardingPage';
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
import { supabase } from '../../lib/supabaseClient';

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
  const location = useLocation();

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
          try {
            const { data: profile } = await supabase
              .from('users')
              .select('account_type, plan, role')
              .eq('id', data.session.user.id)
              .maybeSingle();
            const roleVal = profile?.account_type || profile?.plan || profile?.role || data.session.user.user_metadata?.account_type || data.session.user.user_metadata?.role;
            setUserRole(roleVal || null);
          } catch {
            setUserRole(null);
          }
        }
      } catch {
        if (!isMounted) return;
        setSession(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setLoading(false);
      if (newSession?.user?.id) {
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('account_type, plan, role')
            .eq('id', newSession.user.id)
            .maybeSingle();
          const roleVal = profile?.account_type || profile?.plan || profile?.role || newSession.user.user_metadata?.account_type || newSession.user.user_metadata?.role;
          setUserRole(roleVal || null);
        } catch {
          setUserRole(null);
        }
      }
    });
    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) return <LoadingFallback />;
  if (!session) {
    // Preserve where the user was trying to go
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  const isFree = String(userRole || '').toLowerCase() === 'free';
  const path = location.pathname;
  if (isFree && (path.startsWith('/prep') || path.startsWith('/agent-mode'))) {
    return <Navigate to="/dashboard" replace />;
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
          <Route path="/login" element={<JobSeekerLogin />} />
          <Route path="/signup" element={<JobSeekerSignup />} />
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
            <Route path="/prep/resume/wizard" element={<ResumeWizardPage />} />
            <Route path="/prep/resume/builder" element={<ResumeBuilderPage />} />
            <Route path="/prep/resume-builder" element={<Navigate to="/prep/resume/builder" replace />} />
            <Route path="/prep/resume-parser" element={<ResumeParserPage />} />
            <Route path="/prep/landing-page" element={<LandingPageBuilderPage />} />
            <Route path="/prep/rex-chat" element={<JobPrepChatPage />} />
            <Route path="/messages" element={<MessagingCenter />} />
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
