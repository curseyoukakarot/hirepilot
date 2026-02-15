import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

type IgniteAppLayoutProps = {
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { to: '/ignite/proposals', label: 'Proposals', icon: 'fa-file-lines' },
  { to: '/ignite/templates', label: 'Templates', icon: 'fa-layer-group' },
  { to: '/ignite/rate-cards', label: 'Vendors / Rate Cards', icon: 'fa-users' },
  { to: '/ignite/clients', label: 'Clients', icon: 'fa-building' },
  { to: '/ignite/exports', label: 'Exports', icon: 'fa-download' },
];

function isActivePath(currentPath: string, targetPath: string): boolean {
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export default function IgniteAppLayout({ children }: IgniteAppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = React.useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 border-r border-gray-200 bg-white transition-all duration-200 md:static md:translate-x-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          } ${desktopCollapsed ? 'md:w-20' : 'md:w-64'} w-64`}
        >
          <div className="border-b border-gray-200 p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                <img
                  src="https://images.squarespace-cdn.com/content/v1/63e9b6d2e579fc1e26b444a1/b21b0d24-3b10-49a6-8df0-4d13b9ab3e3c/Scratchpad+2025.png?format=1500w"
                  alt="Ignite logo"
                  className="h-8 w-8 rounded-lg object-cover"
                />
                {!desktopCollapsed && <span className="text-xl font-bold text-gray-900">Ignite</span>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDesktopCollapsed((prev) => !prev)}
                  className="hidden rounded-md p-2 text-gray-500 hover:bg-gray-100 md:inline-flex"
                  aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <i className={`fa-solid ${desktopCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100 md:hidden"
                  aria-label="Close menu"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>
          </div>
          <nav className="p-3 md:p-4">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={`mb-2 flex items-center rounded-lg px-3 py-2 text-sm ${
                    desktopCollapsed ? 'justify-center' : 'space-x-3'
                  } ${
                    active
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={desktopCollapsed ? item.label : undefined}
                >
                  <i className={`fa-solid ${item.icon}`} />
                  {!desktopCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}

            <div className="mt-4 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 ${
                  desktopCollapsed ? 'justify-center' : 'space-x-3'
                }`}
                title={desktopCollapsed ? 'Sign out' : undefined}
              >
                <i className="fa-solid fa-right-from-bracket" />
                {!desktopCollapsed && <span>Sign out</span>}
              </button>
            </div>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
              aria-label="Open menu"
            >
              <i className="fa-solid fa-bars" />
            </button>
            <div className="flex items-center gap-2">
              <img
                src="https://images.squarespace-cdn.com/content/v1/63e9b6d2e579fc1e26b444a1/b21b0d24-3b10-49a6-8df0-4d13b9ab3e3c/Scratchpad+2025.png?format=1500w"
                alt="Ignite logo"
                className="h-6 w-6 rounded-md object-cover"
              />
              <span className="text-sm font-semibold text-gray-900">Ignite</span>
            </div>
          </div>
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
