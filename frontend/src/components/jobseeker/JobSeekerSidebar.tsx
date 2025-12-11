import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leads', label: 'Leads' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/prep', label: 'Prep' },
  { to: '/messages', label: 'Messages' },
  { to: '/agent-mode', label: 'Agent Mode' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
  { to: '/billing', label: 'Billing' },
];

export default function JobSeekerSidebar() {
  return (
    <aside className="h-full bg-slate-950 text-slate-100 border-r border-slate-800 flex flex-col">
      <div className="px-4 py-4 text-lg font-semibold tracking-tight border-b border-slate-800">
        HirePilot Jobs
      </div>
      <nav className="flex-1 overflow-y-auto">
        <ul className="space-y-1 px-2 py-3">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
