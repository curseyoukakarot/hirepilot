import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaEnvelope, FaChartBar, FaCog, FaSignOutAlt, FaCreditCard, FaShieldAlt, FaRobot, FaExclamationTriangle, FaCookie, FaSlidersH, FaPlug, FaBell, FaUsers, FaTerminal, FaTable, FaWpforms, FaHeartbeat } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import { usePlan } from '../context/PlanContext';

const baseLinks = [
  { to: '/messages', label: 'Messages', icon: <FaEnvelope /> },
  { to: '/settings', label: 'Settings', icon: <FaCog /> },
  { to: '/billing', label: 'Billing', icon: <FaCreditCard /> },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { isFree } = usePlan();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [rexEnabled, setRexEnabled] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [canAccessWorkflows, setCanAccessWorkflows] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('sidebar_collapsed') === '1'); } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(v => {
      const next = !v;
      try { localStorage.setItem('sidebar_collapsed', next ? '1' : '0'); } catch {}
      try { window.dispatchEvent(new CustomEvent('sidebar:toggle', { detail: { collapsed: next } })); } catch {}
      return next;
    });
  };

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let role = null;
      let rexEnabled = false;
      // Default guest flag from session
      let guestFlag = (typeof window !== 'undefined' && sessionStorage.getItem('guest_mode') === '1');
      if (user) {
        // Prefer backend canonical profile (more reliable than client-side RLS reads)
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          const base = import.meta.env.VITE_BACKEND_URL || 'https://api.thehirepilot.com';
          if (token) {
            const resp = await fetch(`${base}/api/user/me`, {
              headers: { Authorization: `Bearer ${token}` },
              credentials: 'include'
            });
            if (resp.ok) {
              const me = await resp.json();
              if (me?.role) role = me.role;
            }
          }
        } catch {}

        // Fallback: Try to fetch from users table (may be blocked by RLS)
        try {
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
          if (data && data.role) role = data.role;
        } catch {}
        // Determine REX flag from integrations table only (source of truth)
        const { data: integ } = await supabase
          .from('integrations')
          .select('provider,status')
          .eq('user_id', user.id);
        const rexRow = (integ || []).find(r => r.provider === 'rex');
        rexEnabled = ['enabled','connected','on','true'].includes(String(rexRow?.status || '').toLowerCase());
        if (!role && user.user_metadata?.role) role = user.user_metadata.role;
        // Determine guest membership
        try {
          const { data: guestRow } = await supabase
            .from('job_guest_collaborators')
            .select('id')
            .eq('email', user.email)
            .limit(1)
            .maybeSingle();
          if (guestRow) guestFlag = true;
        } catch {}
      }
      const roleLc = (role || '').toLowerCase();
      const premiumRoles = ['recruitpro','teamadmin','team_admin','superadmin','super_admin','admin','member'];
      setIsPremium(premiumRoles.includes(roleLc) || rexEnabled);
      setIsSuperAdmin(roleLc === 'super_admin' || roleLc === 'superadmin');
      setRexEnabled(rexEnabled);
      setIsGuest(guestFlag);
      // Workflows eligibility: explicit paid roles only (no rexEnabled shortcut)
      const workflowsPaidRoles = ['members','member','admin','team_admin','teamadmin','recruitpro','super_admin','superadmin'];
      setCanAccessWorkflows(workflowsPaidRoles.includes(roleLc));
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
    <aside className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-200 h-full bg-gray-50 dark:bg-gray-800 flex flex-col border-r border-gray-200 dark:border-gray-700`}> 
      <div className="p-2 flex justify-end">
        <button className="text-gray-500 hover:text-gray-700" title={collapsed? 'Expand' : 'Collapse'} onClick={toggleCollapsed}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto">
        <div className="p-4">
          <ul className="space-y-1">
            {[
              ...((isGuest ? baseLinks.filter(l => !['/messages','/billing'].includes(l.to)) : baseLinks)),
              ...((isFree || isGuest) ? [] : [{ to: '/analytics', label: 'Analytics', icon: <FaChartBar /> }]),
              { to: '/tables', label: 'Tables', icon: <FaTable /> },
              { to: '/forms', label: 'Forms', icon: <FaWpforms /> },
            ].map(link => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                      isActive ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-gray-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  <span className={`${collapsed ? '' : 'mr-3'} text-lg`}>{link.icon}</span>
                  {!collapsed && link.label}
                </NavLink>
              </li>
            ))}
            {/* Affiliate nav removed from main dashboard */}
            {(isPremium || rexEnabled || isFree) && (
              <>
                <li>
                  <NavLink
                    to="/agent"
                    className={({ isActive }) =>
                      `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-gray-700 dark:text-indigo-300'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`
                    }
                  >
                    <span className="mr-3 text-lg"><FaTerminal /></span>
                    Agent Mode
                  </NavLink>
                </li>
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
                <li>
                  <NavLink
                    to="/workflows"
                    className={({ isActive }) =>
                      `flex items-center px-4 py-2 text-base rounded-lg font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-gray-700 dark:text-indigo-300'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`
                    }
                  >
                    <span className="mr-3 text-lg"><FaPlug /></span>
                    Workflows
                  </NavLink>
                </li>
                {/* Action Inbox is inside Agent Mode */}
              </>
            )}
          </ul>
        </div>

        {/* LinkedIn Automation Section */}
            <div className="px-2 mt-8">
              {!collapsed && <div className="text-xs text-gray-400 font-semibold uppercase mb-2 tracking-wider">LinkedIn Automation</div>}
          {/* Only show Bulk Cookie Refresh for super admins */}
          {isSuperAdmin && (
            <NavLink
              to="/phantom/bulk-refresh"
              className={({ isActive }) =>
                `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-gray-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaCog /></span>
              {!collapsed && 'Bulk Cookie Refresh'}
            </NavLink>
          )}
        </div>

        {/* Super Admin Sections */}
        {isSuperAdmin && (
          <>
            <div className="px-2 mt-8">
              {!collapsed && <div className="text-xs text-gray-400 font-semibold uppercase mb-2 tracking-wider">Admin Controls</div>}
              <NavLink
                to="/super-admin"
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaShieldAlt /></span>
                {!collapsed && 'Super Admin'}
              </NavLink>
              {/* Removed Action Inbox and Sourcing Campaigns in favor of unified Agent Mode */}
              <NavLink
                to="/admin/puppet-health"
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaRobot /></span>
                {!collapsed && 'Puppet Health'}
              </NavLink>
              <NavLink
                to="/admin/repo-guardian"
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaHeartbeat /></span>
                {!collapsed && 'Repo Guard'}
              </NavLink>
              <NavLink
                to="/admin/proxy-management"
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaSlidersH /></span>
                {!collapsed && 'Proxy Management'}
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaCog /></span>
                {!collapsed && 'Settings'}
              </NavLink>
            </div>
            <div className="px-2 mt-8">
              {!collapsed && <div className="text-xs font-semibold uppercase mb-2 tracking-wider text-blue-600 dark:text-blue-400">Phantom Tools</div>}
              <NavLink to="/phantom-monitor" className={({ isActive }) =>
                `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaRobot /></span>
                {!collapsed && 'Queue Monitor'}
              </NavLink>
              <NavLink to="/phantom/lead-sync-failures" className={({ isActive }) =>
                `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaExclamationTriangle /></span>
                {!collapsed && 'Lead Sync Failures'}
              </NavLink>
              <NavLink to="/phantom/cookie-refresh" className={({ isActive }) =>
                `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaCookie /></span>
                {!collapsed && 'Cookie Refresher'}
              </NavLink>
              <NavLink to="/phantom/webhook-logs" className={({ isActive }) =>
                `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaPlug /></span>
                {!collapsed && 'Webhook Logs'}
              </NavLink>
              <NavLink to="/phantom/config" className={({ isActive }) =>
                `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }>
                <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaSlidersH /></span>
                {!collapsed && 'Phantom Config'}
              </NavLink>
            </div>
          </>
        )}
      </nav>
      {/* Fixed Sign Out Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-center'} gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors`}
        >
          <FaSignOutAlt className="text-lg" /> Sign Out
        </button>
      </div>
    </aside>
  );
} 