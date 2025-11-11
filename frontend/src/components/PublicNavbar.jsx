import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

const links = [
  { label: 'Meet REX', href: '/rex' },
  { label: 'Your Recruiting Co-Pilot', href: '/copilot' },
  { label: 'Free Forever', href: '/freeforever' },
  { label: 'Pricing', href: '/pricing' },
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isActive = (href) => location.pathname === href;

  return (
    <>
      {/* top header */}
      <header id="header" className="fixed w-full top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
            <span className="text-xl font-bold text-gray-900">HirePilot</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`${isActive(l.href) ? 'text-blue-600 font-medium border-b-2 border-blue-600 pb-1' : 'text-gray-800 hover:text-gray-900'}`}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <a href="https://app.thehirepilot.com/login" className="text-sm text-gray-800 hover:text-gray-900">Log in</a>
            <a href="https://app.thehirepilot.com/signup" className="inline-flex items-center bg-indigo-600 px-4 py-2 text-white rounded-lg">Sign up</a>
            <a href="/pricing" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2.5 rounded-lg hover:shadow-lg transition-all duration-200">
              Start for Free
            </a>
          </div>
          {/* mobile hamburger */}
          <button onClick={() => setOpen(true)} className="md:hidden text-gray-600">
            <i className="fa-solid fa-bars text-2xl" />
          </button>
        </div>
      </header>

      {/* mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col p-6">
          <div className="flex items-center justify-between mb-8">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="HirePilot Logo" className="h-8 w-8" />
              <span className="text-xl font-bold text-gray-900">HirePilot</span>
            </a>
            <button onClick={() => setOpen(false)} className="text-gray-600">
              <i className="fa-solid fa-xmark text-3xl" />
            </button>
          </div>
          <nav className="flex-1 flex flex-col items-start gap-6 overflow-y-auto">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`text-lg ${isActive(l.href) ? 'text-blue-600 font-semibold' : 'text-gray-700'} hover:text-blue-600`}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <a href="https://app.thehirepilot.com/login" className="text-lg text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Sign in</a>
          </nav>
          <a href="/pricing" className="mt-auto bg-gradient-to-r from-blue-600 to-blue-500 text-white w-full text-center py-4 rounded-lg font-semibold" onClick={() => setOpen(false)}>
            Start for Free
          </a>
        </div>
      )}
    </>
  );
} 