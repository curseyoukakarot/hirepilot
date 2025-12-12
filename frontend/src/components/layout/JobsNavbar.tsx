import React from 'react';
import { applyTheme, getStoredTheme, ThemeMode } from '../../lib/theme';

type JobsNavbarProps = {
  logoSrc: string;
  onMenuClick?: () => void;
};

export function JobsNavbar({ logoSrc, onMenuClick }: JobsNavbarProps) {
  const [theme, setTheme] = React.useState<ThemeMode>('system');

  React.useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const setAndApply = (mode: ThemeMode) => {
    setTheme(mode);
    applyTheme(mode);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/80 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900 md:hidden"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <a href="/" className="flex items-center gap-2">
          <img src={logoSrc} alt="HirePilot" className="h-7 w-auto" />
          <span className="hidden text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:inline">Jobs</span>
        </a>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 md:inline-flex"
            aria-label="Open command palette"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
            <span className="text-zinc-500 dark:text-zinc-400">Search</span>
            <span className="ml-2 rounded border border-zinc-200 px-1.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              ⌘K
            </span>
          </button>
          <div className="relative">
            <select
              value={theme}
              onChange={(e) => setAndApply(e.target.value as ThemeMode)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              aria-label="Theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            aria-label="Account"
          >
            <span className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <span className="hidden sm:inline">Account</span>
          </button>
        </div>
      </div>
    </header>
  );
}
