// components/Navbar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    (async () => {
      let guestFlag = (typeof window !== 'undefined' && sessionStorage.getItem('guest_mode') === '1');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
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
    <header className="bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center">
      <NavLink to="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
        <img src="/logo.png" alt="HirePilot Logo" className="h-10 w-10" />
        <span className="text-2xl font-bold text-indigo-600">HirePilot</span>
      </NavLink>
      <nav className="flex space-x-6">
        {!isGuest && (
          <>
            <NavLink
              to="/campaigns"
              className={({ isActive }) =>
                isActive ? 'text-indigo-600 font-semibold' : 'text-gray-600 hover:text-indigo-600'
              }
            >
              Campaigns
            </NavLink>
            <NavLink
              to="/leads"
              className={({ isActive }) =>
                isActive ? 'text-indigo-600 font-semibold' : 'text-gray-600 hover:text-indigo-600'
              }
            >
              Leads
            </NavLink>
            <NavLink
              to="/candidates"
              className={({ isActive }) =>
                isActive ? 'text-indigo-600 font-semibold' : 'text-gray-600 hover:text-indigo-600'
              }
            >
              Candidates
            </NavLink>
          </>
        )}
        <NavLink
          to="/jobs"
          className={({ isActive }) =>
            isActive ? 'text-indigo-600 font-semibold' : 'text-gray-600 hover:text-indigo-600'
          }
        >
          Jobs
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive ? 'text-indigo-600 font-semibold' : 'text-gray-600 hover:text-indigo-600'
          }
        >
          Dashboard
        </NavLink>
      </nav>
    </header>
  );
}
