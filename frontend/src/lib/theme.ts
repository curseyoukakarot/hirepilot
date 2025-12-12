export type ThemeMode = 'light' | 'dark' | 'system';

export function getStoredTheme(): ThemeMode {
  return (localStorage.getItem('hp_jobs_theme') as ThemeMode) || 'system';
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldDark = mode === 'dark' || (mode === 'system' && prefersDark);
  root.classList.toggle('dark', shouldDark);
  localStorage.setItem('hp_jobs_theme', mode);
}
