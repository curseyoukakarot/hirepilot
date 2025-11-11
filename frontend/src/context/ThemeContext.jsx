import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'hp_theme';

const ThemeContext = createContext({
  theme: 'light',
  setTheme: (_t) => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    try {
      if (typeof window !== 'undefined') {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch {}
    return 'light';
  });

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
    try {
      const root = document.documentElement;
      if (!root) return;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') return;
        setTheme(e.matches ? 'dark' : 'light');
      };
      if (mq.addEventListener) mq.addEventListener('change', handler); else mq.addListener(handler);
      return () => { try { if (mq.removeEventListener) mq.removeEventListener('change', handler); else mq.removeListener(handler); } catch {} };
    } catch {}
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}


