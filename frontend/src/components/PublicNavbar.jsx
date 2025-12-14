import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const links = [
  { label: 'Meet REX', href: '/rex' },
  { label: 'Free Forever', href: '/freeforever' },
  { label: 'Workflows', href: '/workflows' },
  { label: 'Pricing', href: '/pricing' },
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [showUseCases, setShowUseCases] = useState(false);
  const [mobileUseCasesOpen, setMobileUseCasesOpen] = useState(false);
  const location = useLocation();
  const dropdownRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const isActive = (href) => location.pathname === href;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowUseCases(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setShowUseCases(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <>
      {/* top header */}
      <header id="header" className="fixed w-full top-0 z-50 bg-white dark:bg-slate-900 shadow-sm border-b border-gray-100 dark:border-slate-800">
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
                className={`${isActive(l.href)
                  ? 'text-blue-600 dark:text-blue-400 font-medium border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-800 dark:text-gray-100 border-b-2 border-transparent hover:border-blue-600 dark:hover:border-blue-400'
                } pb-1`}
              >
                {l.label}
              </a>
            ))}
            <div
              className="relative pb-3"
              ref={dropdownRef}
              onMouseEnter={() => {
                if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                setShowUseCases(true);
              }}
              onMouseLeave={() => {
                // small delay to allow moving cursor into the dropdown without closing
                if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = setTimeout(() => setShowUseCases(false), 180);
              }}
            >
              <div className="flex items-center gap-2">
                <a
                  href="/use-cases"
                  className={`${location.pathname.startsWith('/use-cases')
                    ? 'text-blue-600 dark:text-blue-400 font-medium border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-800 dark:text-gray-100 border-b-2 border-transparent hover:border-blue-600 dark:hover:border-blue-400'
                  } pb-1`}
                >
                  Use Cases
                </a>
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={showUseCases ? 'true' : 'false'}
                  className="text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 pb-1"
                  onClick={() => setShowUseCases((v) => !v)}
                >
                  <i className={`fa-solid ${showUseCases ? 'fa-chevron-up' : 'fa-chevron-down'} text-sm`} />
                </button>
              </div>
              {showUseCases && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-2">
                  <a href="/use-cases" className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white rounded-md">Overview</a>
                  <a href="/use-cases/recruiting-agencies" className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white rounded-md">Recruiting Agencies</a>
                  <a href="/use-cases/fractional-executives" className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white rounded-md">Fractional Executives</a>
                  <a href="/use-cases/consultants" className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white rounded-md">Consultants</a>
                  <a href="https://jobs.thehirepilot.com/" className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white rounded-md">Job Seekers</a>
                </div>
              )}
            </div>
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
            <button
              className="text-lg text-gray-700 hover:text-blue-600 flex items-center gap-2"
              onClick={() => setMobileUseCasesOpen(!mobileUseCasesOpen)}
            >
              <span>Use Cases</span>
              <i className={`fa-solid ${mobileUseCasesOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-sm`} />
            </button>
            {mobileUseCasesOpen && (
              <div className="ml-4 flex flex-col gap-3">
                <a href="/use-cases" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Overview</a>
                <a href="/use-cases/recruiting-agencies" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Recruiting Agencies</a>
                <a href="/use-cases/fractional-executives" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Fractional Executives</a>
                <a href="/use-cases/consultants" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Consultants</a>
                <a href="https://jobs.thehirepilot.com/" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Job Seekers</a>
              </div>
            )}
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