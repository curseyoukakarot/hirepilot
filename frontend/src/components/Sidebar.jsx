import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaEnvelope, FaChartBar, FaCog, FaSignOutAlt, FaCreditCard, FaShieldAlt, FaRobot, FaExclamationTriangle, FaCookie, FaSlidersH, FaPlug } from 'react-icons/fa';
import { supabase } from '../lib/supabase';

const links = [
  { to: '/messages', label: 'Messages', icon: <FaEnvelope /> },
  { to: '/analytics', label: 'Analytics', icon: <FaChartBar /> },
  { to: '/settings', label: 'Settings', icon: <FaCog /> },
  { to: '/billing', label: 'Billing', icon: <FaCreditCard /> },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let role = null;
      if (user) {
        // Try to fetch from users table
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        if (data && data.role) {
          role = data.role;
        } else if (user.user_metadata?.role) {
          role = user.user_metadata.role;
        }
      }
      const premiumRoles = ['RecruitPro','TeamAdmin','SuperAdmin','super_admin'];
      setIsPremium(premiumRoles.includes(role));
      setIsSuperAdmin(role === 'super_admin');
    };
    fetchRole();
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error.message);
        return;
      }
      localStorage.removeItem('hirepilot-auth');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Error during sign out:', err);
    }
  };

  return (
    <aside className="h-full bg-gray-50 dark:bg-gray-800 flex flex-col border-r border-gray-200 dark:border-gray-700">
      <nav className="flex-1 overflow-y-auto">
        <div className="p-4">
          <ul className="space-y-1">
            {links.map(link => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                      isActive ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-gray-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  <span className="mr-3 text-lg">{link.icon}</span>
                  {link.label}
                </NavLink>
              </li>
            ))}
            {isPremium && (
              <li>
                <NavLink
                  to="/rex-chat"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-gray-700 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  <span className="mr-3 text-lg"><FaRobot /></span>
                  REX Chat
                </NavLink>
              </li>
            )}
          </ul>
        </div>

        {/* LinkedIn Automation Section */}
        <div className="px-6 mt-8">
          <div className="text-xs text-gray-400 font-semibold uppercase mb-2 tracking-wider">LinkedIn Automation</div>
          {/* Only show Bulk Cookie Refresh for super admins */}
          {isSuperAdmin && (
            <NavLink
              to="/phantom/bulk-refresh"
              className={({ isActive }) =>
                `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-gray-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <span className="mr-3 text-lg"><FaCog /></span>
              Bulk Cookie Refresh
            </NavLink>
          )}
        </div>

        {/* Super Admin Sections */}
        {isSuperAdmin && (
          <>
            <div className="px-6 mt-8">
              <div className="text-xs text-gray-400 font-semibold uppercase mb-2 tracking-wider">Admin Controls</div>
              <NavLink
                to="/super-admin"
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                <span className="mr-3 text-lg"><FaShieldAlt /></span>
                Super Admin
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                <span className="mr-3 text-lg"><FaCog /></span>
                Settings
              </NavLink>
            </div>
            <div className="px-6 mt-8">
              <div className="text-xs font-semibold uppercase mb-2 tracking-wider text-blue-600 dark:text-blue-400">Phantom Tools</div>
              <NavLink to="/phantom-monitor" className={({ isActive }) =>
                `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className="mr-3 text-lg"><FaRobot /></span>
                Queue Monitor
              </NavLink>
              <NavLink to="/phantom/lead-sync-failures" className={({ isActive }) =>
                `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className="mr-3 text-lg"><FaExclamationTriangle /></span>
                Lead Sync Failures
              </NavLink>
              <NavLink to="/phantom/cookie-refresh" className={({ isActive }) =>
                `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className="mr-3 text-lg"><FaCookie /></span>
                Cookie Refresher
              </NavLink>
              <NavLink to="/phantom/webhook-logs" className={({ isActive }) =>
                `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className="mr-3 text-lg"><FaPlug /></span>
                Webhook Logs
              </NavLink>
              <NavLink to="/phantom/config" className={({ isActive }) =>
                `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className="mr-3 text-lg"><FaSlidersH /></span>
                Phantom Config
              </NavLink>
            </div>
          </>
        )}
      </nav>
      {/* Fixed Sign Out Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors"
        >
          <FaSignOutAlt className="text-lg" /> Sign Out
        </button>
      </div>
    </aside>
  );
} 