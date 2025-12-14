import React from 'react';
import { JobsNavbar } from './JobsNavbar';
import { JobsSidebar } from './JobsSidebar';
import { OnboardingBanner } from '../jobseeker/OnboardingBanner';

export function JobsLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  const items = React.useMemo(
    () => [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 13h7V4H4v9Zm9 7h7V11h-7v9Z" />
          </svg>
        ),
      },
      {
        label: 'Jobs',
        href: '/jobs',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M3 7h18M3 17h18M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
            <path strokeLinecap="round" d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
          </svg>
        ),
      },
      {
        label: 'Prep',
        href: '/prep',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        ),
      },
      {
        label: 'Leads',
        href: '/leads',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
            <path strokeLinecap="round" d="M6 20a6 6 0 0 1 12 0" />
          </svg>
        ),
      },
      {
        label: 'Campaigns',
        href: '/campaigns',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 6h16M4 12h10M4 18h6" />
          </svg>
        ),
      },
      {
        label: 'REX Chat',
        href: '/prep/rex-chat',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
          </svg>
        ),
      },
      {
        label: 'Messages',
        href: '/messages',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
          </svg>
        ),
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 11 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        ),
      },
      {
        label: 'Billing',
        href: '/billing',
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M21 13V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6m18 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m18 0H3" />
            <path strokeLinecap="round" d="M7 10h10" />
            <path strokeLinecap="round" d="M7 14h4" />
          </svg>
        ),
      },
    ],
    []
  );

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : undefined;

  return (
    <div className="min-h-screen bg-[#0b1220] text-zinc-100 dark:bg-[#0b1220]">
      <JobsNavbar logoSrc="/logo.png" onMenuClick={() => setOpen(true)} />
      <div className="flex w-full">
        <JobsSidebar
          items={items}
          currentPath={currentPath}
          isOpenMobile={open}
          onCloseMobile={() => setOpen(false)}
        />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
          <OnboardingBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
