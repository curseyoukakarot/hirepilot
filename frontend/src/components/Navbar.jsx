// components/Navbar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Navbar() {
  const [isGuest, setIsGuest] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  // adjust main layout margin when sidebar collapsed/expanded
  useEffect(() => {
    const handler = (e) => {
      const collapsed = e?.detail?.collapsed;
      const main = document.getElementById('app-main');
      const sidebar = document.getElementById('app-sidebar');
      if (!main || !sidebar) return;
      if (collapsed) {
        main.classList.remove('ml-64');
        main.classList.add('ml-16');
        sidebar.classList.remove('w-64');
        sidebar.classList.add('w-16');
      } else {
        main.classList.remove('ml-16');
        main.classList.add('ml-64');
        sidebar.classList.remove('w-16');
        sidebar.classList.add('w-64');
      }
    };
    window.addEventListener('sidebar:toggle', handler);
    return () => window.removeEventListener('sidebar:toggle', handler);
  }, []);
  useEffect(() => {
    (async () => {
      let guestFlag = (typeof window !== 'undefined' && sessionStorage.getItem('guest_mode') === '1');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setAvatarUrl(user.user_metadata?.avatar_url || '');
          const { data } = await supabase
            .from('job_guest_collaborators')
            .select('id')
            .eq('email', user.email)
            .limit(1)
            .maybeSingle();
          if (data) guestFlag = true;
        }
      } catch {}
      setIsGuest(guestFlag);
    })();
  }, []);
  return (
    <header className="bg-white dark:bg-gray-900 border-b dark:border-transparent shadow-sm dark:shadow-[0_-1px_0_0_rgba(255,255,255,0.04)_inset] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
      <NavLink to="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
        <img src="/logo.png" alt="HirePilot Logo" className="h-10 w-10" />
        <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">HirePilot</span>
      </NavLink>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center space-x-6">
        {!isGuest && (
          <>
            <NavLink
              to="/deals"
              className={({ isActive }) =>
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }
            >
              Deals
            </NavLink>
            <NavLink
              to="/campaigns"
              className={({ isActive }) =>
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }
            >
              Campaigns
            </NavLink>
            <NavLink
              to="/leads"
              className={({ isActive }) =>
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }
            >
              Leads
            </NavLink>
            <NavLink
              to="/candidates"
              className={({ isActive }) =>
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }
            >
              Candidates
            </NavLink>
          </>
        )}
        <NavLink
          to="/jobs"
          className={({ isActive }) =>
            isActive ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
          }
        >
          Jobs
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
          }
        >
          Dashboard
        </NavLink>
        <NavLink to="/settings" className="flex items-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200" />
          )}
        </NavLink>
      </nav>
      {/* Mobile hamburger */}
      <button type="button" className="md:hidden inline-flex items-center justify-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800" onClick={()=>setMobileOpen(v=>!v)} aria-label="Toggle menu">
        <span className="sr-only">Open menu</span>
        <span className="flex flex-col justify-between w-6 h-4">
          <span className="block w-full h-0.5 bg-gray-800 dark:bg-gray-200"></span>
          <span className="block w-full h-0.5 bg-gray-800 dark:bg-gray-200"></span>
          <span className="block w-full h-0.5 bg-gray-800 dark:bg-gray-200"></span>
        </span>
      </button>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={()=>setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black bg-opacity-30"></div>
          <div className="absolute right-0 top-0 h-full w-64 bg-white dark:bg-gray-900 shadow-lg p-4" onClick={(e)=>e.stopPropagation()}>
            <nav className="flex flex-col space-y-3">
              {!isGuest && (
                <>
                  <NavLink to="/deals" onClick={()=>setMobileOpen(false)} className="text-gray-700 dark:text-gray-200">Deals</NavLink>
                  <NavLink to="/campaigns" onClick={()=>setMobileOpen(false)} className="text-gray-700 dark:text-gray-200">Campaigns</NavLink>
                  <NavLink to="/leads" onClick={()=>setMobileOpen(false)} className="text-gray-700 dark:text-gray-200">Leads</NavLink>
                  <NavLink to="/candidates" onClick={()=>setMobileOpen(false)} className="text-gray-700 dark:text-gray-200">Candidates</NavLink>
                </>
              )}
              <NavLink to="/jobs" onClick={()=>setMobileOpen(false)} className="text-gray-700 dark:text-gray-200">Jobs</NavLink>
              <NavLink to="/dashboard" onClick={()=>setMobileOpen(false)} className="text-gray-700 dark:text-gray-200">Dashboard</NavLink>
              <NavLink to="/settings" onClick={()=>setMobileOpen(false)} className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                {avatarUrl ? (<img src={avatarUrl} alt="avatar" className="w-6 h-6 rounded-full object-cover" />) : (<div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />)}
                <span>Settings</span>
              </NavLink>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
