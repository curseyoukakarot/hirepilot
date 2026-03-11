import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FaEnvelope, FaChartBar, FaCog, FaSignOutAlt, FaCreditCard,
  FaShieldAlt, FaRobot, FaSlidersH,
  FaPlug, FaUsers, FaTerminal, FaTable, FaWpforms, FaHeartbeat,
  FaGlobe, FaTasks, FaColumns, FaHandshake, FaRocket, FaKey, FaPlus,
} from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import { usePlan } from '../context/PlanContext';
import { markIntentionalSignOut } from '../auth/sessionExpiry';
import { useSidebarApps } from '../hooks/useSidebarApps';

// ---------------------------------------------------------------------------
// Icon mapping: registry string names → React components
// ---------------------------------------------------------------------------
const ICON_MAP = {
  FaEnvelope: <FaEnvelope />,
  FaChartBar: <FaChartBar />,
  FaCog: <FaCog />,
  FaCreditCard: <FaCreditCard />,
  FaTable: <FaTable />,
  FaColumns: <FaColumns />,
  FaHandshake: <FaHandshake />,
  FaTasks: <FaTasks />,
  FaWpforms: <FaWpforms />,
  FaGlobe: <FaGlobe />,
  FaTerminal: <FaTerminal />,
  FaRocket: <FaRocket />,
  FaUsers: <FaUsers />,
  FaKey: <FaKey />,
  FaPlug: <FaPlug />,
  FaRobot: <FaRobot />,
};

// ---------------------------------------------------------------------------
// NavLink style helpers
// ---------------------------------------------------------------------------
const navLinkClass = (isActive, collapsed) =>
  `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
    isActive
      ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-gray-700 dark:text-indigo-300'
      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`;

const adminNavLinkClass = (isActive, collapsed) =>
  `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base rounded-lg font-medium transition-colors cursor-pointer ${
    isActive
      ? 'bg-blue-100 text-blue-700 font-semibold dark:bg-gray-700 dark:text-blue-300'
      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`;

export default function Sidebar() {
  const navigate = useNavigate();
  const { isFree } = usePlan();
  const { enabledApps, isLoading: appsLoading, trackUsage } = useSidebarApps();
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
      let guestFlag = (typeof window !== 'undefined' && sessionStorage.getItem('guest_mode') === '1');
      if (user) {
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
        try {
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
          if (data && data.role) role = data.role;
        } catch {}
        const { data: integ } = await supabase
          .from('integrations')
          .select('provider,status')
          .eq('user_id', user.id);
        const rexRow = (integ || []).find(r => r.provider === 'rex');
        rexEnabled = ['enabled','connected','on','true'].includes(String(rexRow?.status || '').toLowerCase());
        if (!role && user.user_metadata?.role) role = user.user_metadata.role;
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
      const workflowsPaidRoles = ['members','member','admin','team_admin','teamadmin','recruitpro','super_admin','superadmin'];
      setCanAccessWorkflows(workflowsPaidRoles.includes(roleLc));
    };
    fetchRole();
  }, []);

  const handleSignOut = async () => {
    try {
      markIntentionalSignOut();
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

  // ---------------------------------------------------------------------------
  // Build standard items list (always shown, respects plan/role gating)
  // ---------------------------------------------------------------------------
  const standardItems = [];
  if (!isGuest) {
    standardItems.push({ to: '/settings', label: 'Settings', icon: <FaCog /> });
    standardItems.push({ to: '/billing', label: 'Billing', icon: <FaCreditCard /> });
  } else {
    standardItems.push({ to: '/settings', label: 'Settings', icon: <FaCog /> });
  }
  if (!isFree && !isGuest) {
    standardItems.push({ to: '/analytics', label: 'Analytics', icon: <FaChartBar /> });
  }
  if (canAccessWorkflows || isPremium || rexEnabled) {
    standardItems.push({ to: '/workflows', label: 'Workflows', icon: <FaPlug /> });
  }
  if (isPremium || rexEnabled || isFree) {
    standardItems.push({ to: '/rex-chat', label: 'REX Chat', icon: <FaRobot /> });
  }

  // ---------------------------------------------------------------------------
  // Resolve dynamic app icons
  // ---------------------------------------------------------------------------
  const resolvedApps = enabledApps
    .filter(app => {
      // Skip plan-gated apps for free/guest users
      if (app.requiresPaidPlan && (isFree || isGuest)) return false;
      return true;
    })
    .map(app => ({
      to: app.route,
      label: app.label,
      icon: ICON_MAP[app.icon] || <FaTable />,
      appId: app.id,
    }));

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-200 h-full bg-gray-50 dark:bg-gray-800 flex flex-col border-r border-gray-200 dark:border-gray-700`}>
      <div className="p-2 flex justify-end">
        <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title={collapsed ? 'Expand' : 'Collapse'} onClick={toggleCollapsed}>
          {collapsed ? '\u203A' : '\u2039'}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {/* ─── Standard Items (always visible) ─── */}
        <div className="px-4 pt-2 pb-1">
          {!collapsed && <div className="text-xs text-gray-400 font-semibold uppercase mb-2 tracking-wider">Navigation</div>}
          <ul className="space-y-1">
            {standardItems.map(link => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => navLinkClass(isActive, collapsed)}
                >
                  <span className={`${collapsed ? '' : 'mr-3'} text-lg`}>{link.icon}</span>
                  {!collapsed && link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* ─── Divider ─── */}
        <div className="mx-4 my-3 border-t border-gray-200 dark:border-gray-700" />

        {/* ─── User's Apps (dynamic, customizable) ─── */}
        <div className="px-4 pb-1">
          {!collapsed && <div className="text-xs text-gray-400 font-semibold uppercase mb-2 tracking-wider">Your Apps</div>}

          {appsLoading ? (
            // Skeleton while loading
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse ${collapsed ? 'w-10 mx-auto' : ''}`} />
              ))}
            </div>
          ) : resolvedApps.length > 0 ? (
            <ul className="space-y-1">
              {resolvedApps.map(app => (
                <li key={app.to}>
                  <NavLink
                    to={app.to}
                    onClick={() => trackUsage(app.appId)}
                    className={({ isActive }) => navLinkClass(isActive, collapsed)}
                  >
                    <span className={`${collapsed ? '' : 'mr-3'} text-lg`}>{app.icon}</span>
                    {!collapsed && app.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            !collapsed && (
              <p className="text-sm text-gray-400 dark:text-gray-500 px-4 py-2">
                No apps added yet
              </p>
            )
          )}

          {/* ─── Add Apps CTA ─── */}
          <div className="mt-3">
            <NavLink
              to="/apps"
              className={({ isActive }) =>
                `flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-sm rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-gray-700 dark:text-indigo-300'
                    : 'text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 border border-dashed border-indigo-300 dark:border-indigo-500/40'
                }`
              }
            >
              <span className={`${collapsed ? '' : 'mr-2'} text-base`}><FaPlus /></span>
              {!collapsed && 'Add Apps'}
            </NavLink>
          </div>
        </div>

        {/* ─── Super Admin Section ─── */}
        {isSuperAdmin && (
          <div className="px-2 mt-8">
            {!collapsed && <div className="text-xs text-gray-400 font-semibold uppercase mb-2 tracking-wider">Admin Controls</div>}
            <NavLink to="/super-admin" className={({ isActive }) => adminNavLinkClass(isActive, collapsed)}>
              <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaShieldAlt /></span>
              {!collapsed && 'Super Admin'}
            </NavLink>
            <NavLink to="/admin/puppet-health" className={({ isActive }) => adminNavLinkClass(isActive, collapsed)}>
              <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaRobot /></span>
              {!collapsed && 'Puppet Health'}
            </NavLink>
            <NavLink to="/admin/repo-guardian" className={({ isActive }) => adminNavLinkClass(isActive, collapsed)}>
              <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaHeartbeat /></span>
              {!collapsed && 'Repo Guard'}
            </NavLink>
            <NavLink to="/admin/proxy-management" className={({ isActive }) => adminNavLinkClass(isActive, collapsed)}>
              <span className={`${collapsed ? '' : 'mr-3'} text-lg`}><FaSlidersH /></span>
              {!collapsed && 'Proxy Management'}
            </NavLink>
          </div>
        )}
      </nav>
      {/* Fixed Sign Out Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30`}
        >
          <FaSignOutAlt className="text-lg" /> {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
