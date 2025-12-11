import React, { PropsWithChildren } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import JobSeekerSidebar from './JobSeekerSidebar';

const topNavLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leads', label: 'Leads' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/prep', label: 'Prep' },
];

export default function JobSeekerAppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      <div className="fixed top-0 left-0 bottom-0 w-64 border-r border-slate-800 bg-slate-950">
        <JobSeekerSidebar />
      </div>
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800">
          <div className="h-16 px-6 flex items-center justify-between">
            <Link to="/dashboard" className="text-lg font-semibold tracking-tight text-white">
              HirePilot for Job Seekers
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              {topNavLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    [
                      'px-3 py-2 rounded-md transition-colors',
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900',
                    ].join(' ')
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
