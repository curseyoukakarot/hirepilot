import React from 'react';
import { useNavigate } from 'react-router-dom';
import { applyTheme, getStoredTheme } from '../../lib/theme';
import { supabase } from '../../lib/supabaseClient';

type JobsNavbarProps = {
  logoSrc: string;
  onMenuClick?: () => void;
};

export function JobsNavbar({ logoSrc, onMenuClick }: JobsNavbarProps) {
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [avatarInitial, setAvatarInitial] = React.useState<string>('A');

  React.useEffect(() => {
    const stored = getStoredTheme();
    applyTheme(stored);

    supabase.auth
      .getUser()
      .then(({ data }) => {
        const user = data?.user;
        if (!user) return;
        const meta: any = user.user_metadata || {};
        const fullName = meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || '';
        const avatar = meta.avatar_url || meta.picture || null;
        setAvatarUrl(avatar);
        if (fullName) {
          setAvatarInitial(fullName.charAt(0).toUpperCase());
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/80 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-14 w-full items-center gap-3 px-4 lg:px-6">
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
        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2">
          <img src={logoSrc} alt="HirePilot" className="h-7 w-auto" />
          <span className="hidden text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:inline">Jobs</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="hidden items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 md:inline-flex"
            aria-label="Onboarding Wizard"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
            <span className="text-zinc-500 dark:text-zinc-400">Onboarding Wizard</span>
            <span className="ml-2 rounded border border-zinc-200 px-1.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              ⌘K
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            aria-label="Account"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Account" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <span className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                {avatarInitial}
              </span>
            )}
            <span className="hidden sm:inline">Account</span>
          </button>
        </div>
      </div>
    </header>
  );
}
