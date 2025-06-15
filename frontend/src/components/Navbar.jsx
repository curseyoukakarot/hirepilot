// components/Navbar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <header className="bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center">
      <NavLink to="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
        <img src="/logo.png" alt="HirePilot Logo" className="h-10 w-10" />
        <span className="text-2xl font-bold text-indigo-600">HirePilot</span>
      </NavLink>
      <nav className="flex space-x-6">
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
