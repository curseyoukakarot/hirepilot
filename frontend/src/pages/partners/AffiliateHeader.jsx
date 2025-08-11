import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { partnersSupabase } from '../../lib/partnersSupabase';

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium ${
        isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </Link>
  );
}

export default function AffiliateHeader() {
  const navigate = useNavigate();
  const signOut = async () => {
    await partnersSupabase.auth.signOut();
    navigate('/partners/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-gray-900">HirePilot</h1>
            </div>
            <div className="ml-6">
              <span className="text-gray-500 text-sm">Affiliate Dashboard</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center space-x-2">
            <NavLink to="/partners/dashboard">Dashboard</NavLink>
            <NavLink to="/partners/payouts">Payouts</NavLink>
            <NavLink to="/partners/activity">Activity</NavLink>
            <NavLink to="/partners/settings">Settings</NavLink>
            <button
              onClick={signOut}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              title="Sign Out"
            >
              <span className="fa-solid fa-right-from-bracket" aria-hidden />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}


