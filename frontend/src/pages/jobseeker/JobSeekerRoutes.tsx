import React, { Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
  const [authed, setAuthed] = useState(false);

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
        setAuthed(!!data.session);
      } catch {
        if (!isMounted) return;
        setAuthed(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <LoadingFallback />;
  if (!authed) {
    // Preserve where the user was trying to go
    return <Navigate to="/login" replace state={{ from: (typeof window !== 'undefined') ? window.location.pathname + window.location.search : undefined }} />;
  }
  return <>{children}</>;
}

export default function JobSeekerRoutes() {
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
          <Route path="/login" element={<JobSeekerLogin />} />
          <Route path="/signup" element={<JobSeekerSignup />} />
          {/* Allow onboarding to render even if not authenticated */}
          <Route path="/onboarding" element={<OnboardingPage />} />
          {/* Allow job routes to render before auth guard decides, to avoid catch-all redirect */}
          <Route path="/jobs" element={<JobRequisitions />} />
          <Route path="/jobs/:id" element={<JobRequisitionPage />} />
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
