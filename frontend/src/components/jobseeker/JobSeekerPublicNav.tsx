import React from 'react';
import { useNavigate } from 'react-router-dom';

type JobSeekerPublicNavProps = {
  variant?: 'dark' | 'light';
};

export function JobSeekerPublicNav({ variant = 'dark' }: JobSeekerPublicNavProps) {
  const navigate = useNavigate();
  const isDark = variant === 'dark';
  const baseLink = isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900';

  const smoothScroll = (id: string) => {
    if (typeof window === 'undefined') return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${id}`);
      setTimeout(() => {
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
  };

  return (
    <header className={isDark ? 'bg-gray-900 border-b border-gray-800' : 'bg-white border-b border-slate-200'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <img src="/logo.png" alt="HirePilot" className="w-8 h-8" />
            <span className={isDark ? 'text-xl font-bold text-white' : 'text-xl font-bold text-slate-900'}>
              HirePilot Jobs
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-8 text-sm">
            <button className={baseLink} onClick={() => smoothScroll('method')}>How it works</button>
            <button className={baseLink} onClick={() => navigate('/pricing')}>Pricing</button>
            <button className={baseLink} onClick={() => smoothScroll('rex-demo')}>Try REX</button>
            <button className={baseLink} onClick={() => navigate('/login')}>Sign in</button>
          </nav>
          <div className="flex items-center space-x-4 text-sm">
            <button
              className={isDark ? 'bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors' : 'bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors'}
              onClick={() => navigate('/signup')}
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
