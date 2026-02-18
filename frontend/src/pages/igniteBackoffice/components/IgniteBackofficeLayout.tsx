import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';

type IgniteBackofficeLayoutProps = {
  children: React.ReactNode;
};

const navBaseClass =
  'flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-dark-700 hover:text-white transition';

const navItems = [
  { to: '/ignite/backoffice', label: 'Dashboard', icon: 'fa-solid fa-chart-line w-5', exact: true },
  { to: '/ignite/backoffice/ledger', label: 'Ledger', icon: 'fa-solid fa-book w-5' },
  { to: '/ignite/backoffice/allocations', label: 'Allocations', icon: 'fa-solid fa-layer-group w-5' },
  { to: '/ignite/backoffice/accounts', label: 'Accounts', icon: 'fa-solid fa-wallet w-5' },
  { to: '/ignite/backoffice/imports', label: 'Imports', icon: 'fa-solid fa-download w-5' },
];

export default function IgniteBackofficeLayout({ children }: IgniteBackofficeLayoutProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div id="app-container" className="flex h-screen overflow-hidden bg-dark-900 text-gray-100 font-sans">
      <aside id="sidebar" className="w-64 bg-dark-800 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">Ignite Backoffice</h1>
          <p className="text-xs text-gray-500 mt-1">Cashflow Control</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                isActive ? 'flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 text-white transition' : navBaseClass
              }
            >
              <i className={item.icon} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <img
              src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
              className="w-10 h-10 rounded-full"
              alt="Admin User"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Admin User</p>
              <p className="text-xs text-gray-500">admin@ignitegtm.com</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="mt-2 w-full rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-dark-700 hover:text-white transition"
          >
            <i className="fa-solid fa-arrow-right-from-bracket mr-2" />
            Sign out
          </button>
        </div>
      </aside>

      <main id="main-content" className="flex-1 overflow-y-auto bg-dark-900">
        {children}
      </main>
    </div>
  );
}
