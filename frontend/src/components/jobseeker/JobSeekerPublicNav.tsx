import React from 'react';
import { useNavigate } from 'react-router-dom';

type JobSeekerPublicNavProps = {
  variant?: 'dark' | 'light';
};

export function JobSeekerPublicNav({ variant = 'dark' }: JobSeekerPublicNavProps) {
  const navigate = useNavigate();
  const isDark = variant === 'dark';
  const baseLink = isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900';
  const [open, setOpen] = React.useState(false);

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
          <div className="flex items-center space-x-3 text-sm">
            <button
              className={isDark ? 'bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors hidden md:inline-flex' : 'bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors hidden md:inline-flex'}
              onClick={() => navigate('/signup')}
            >
              Get Started
            </button>
            <button
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 transition"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <span className="sr-only">Toggle navigation</span>
              <div className="space-y-1">
                <span className="block h-0.5 w-5 bg-current"></span>
                <span className="block h-0.5 w-5 bg-current"></span>
                <span className="block h-0.5 w-5 bg-current"></span>
              </div>
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden pb-4 space-y-3 text-sm">
            <button className={`${baseLink} block w-full text-left`} onClick={() => { smoothScroll('method'); setOpen(false); }}>How it works</button>
            <button className={`${baseLink} block w-full text-left`} onClick={() => { navigate('/pricing'); setOpen(false); }}>Pricing</button>
            <button className={`${baseLink} block w-full text-left`} onClick={() => { smoothScroll('rex-demo'); setOpen(false); }}>Try REX</button>
            <button className={`${baseLink} block w-full text-left`} onClick={() => { navigate('/login'); setOpen(false); }}>Sign in</button>
            <button
              className={isDark ? 'w-full text-left bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors' : 'w-full text-left bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors'}
              onClick={() => { navigate('/signup'); setOpen(false); }}
            >
              Get Started
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
