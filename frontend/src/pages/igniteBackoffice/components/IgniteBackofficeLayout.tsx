import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';

type IgniteBackofficeLayoutProps = {
  children: React.ReactNode;
};

type SidebarUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
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
  const [sidebarUser, setSidebarUser] = useState<SidebarUser>({
    name: 'Ignite User',
    email: '',
    avatarUrl: null,
  });

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user || !isMounted) return;

      const meta = (user.user_metadata || {}) as Record<string, any>;
      const fullName = String(meta.full_name || meta.name || '').trim();
      const first = String(meta.first_name || meta.firstName || '').trim();
      const last = String(meta.last_name || meta.lastName || '').trim();
      const fallbackName = [first, last].filter(Boolean).join(' ').trim();
      const displayName = fullName || fallbackName || String(user.email || 'Ignite User');

      setSidebarUser({
        name: displayName,
        email: String(user.email || ''),
        avatarUrl: String(meta.avatar_url || meta.picture || '').trim() || null,
      });
    };
    void loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const userInitials = useMemo(() => {
    const source = sidebarUser.name || sidebarUser.email || 'IU';
    const parts = source.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    return (parts[0] || 'IU').slice(0, 2).toUpperCase();
  }, [sidebarUser.email, sidebarUser.name]);

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
            {sidebarUser.avatarUrl ? (
              <img src={sidebarUser.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt={sidebarUser.name || 'User'} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center text-xs font-semibold">
                {userInitials}
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-white truncate">{sidebarUser.name}</p>
              <p className="text-xs text-gray-500 truncate">{sidebarUser.email || 'No email'}</p>
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
