import React, { useMemo } from 'react';
import JobSeekerLandingPage from './JobSeekerLandingPage';
import PublicLandingPage from './PublicLandingPage';

function isCustomHost(hostname: string) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h.endsWith('.localhost')) return false;
  if (h === '127.0.0.1') return false;
  // Canonical HirePilot jobs domains
  if (h.endsWith('thehirepilot.com')) return false;
  return true;
}

export default function JobSeekerRootPage() {
  const hostname = useMemo(() => {
    try {
      return window.location.hostname || '';
    } catch {
      return '';
    }
  }, []);

  // If this is a white-labeled custom domain, serve the landing page at "/".
  if (isCustomHost(hostname)) {
    return <PublicLandingPage hostOverride={hostname} whiteLabel={true} />;
  }

  // Default: jobs.thehirepilot.com marketing home
  return <JobSeekerLandingPage />;
}


