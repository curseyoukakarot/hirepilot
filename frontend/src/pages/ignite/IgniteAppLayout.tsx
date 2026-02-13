import React from 'react';
import { Link, useLocation } from 'react-router-dom';

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <i className="fa-solid fa-fire text-sm text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Ignite</span>
            </div>
          </div>
          <nav className="p-4">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`mb-2 flex items-center space-x-3 rounded-lg px-3 py-2 text-sm ${
                    active
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <i className={`fa-solid ${item.icon}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
