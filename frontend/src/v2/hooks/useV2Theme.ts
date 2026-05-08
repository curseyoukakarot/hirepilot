/**
 * v2 — useV2Theme
 *
 * v2 surfaces are designed light-mode-only. The legacy app's ThemeProvider
 * (context/ThemeContext.jsx) toggles a `dark` class on <html>; when a user
 * in legacy dark mode opens /v2/*, that class is still set and Tailwind's
 * `dark:` variants bleed through, turning kanban cards / inbox panes /
 * lead drawers black-on-white.
 *
 * This hook removes the `dark` class on mount, adds the v2 body classes,
 * and RESTORES the user's previous theme on unmount so when they switch
 * back to legacy their preference isn't clobbered.
 *
 * Drop into every v2 page's top-level useEffect (or use it via
 * WorkspaceShell which calls it for the pages that wrap with the shell).
 */

import { useEffect } from 'react';

export function useV2Theme(options: { autopilot?: boolean } = {}) {
  const { autopilot = true } = options;

  useEffect(() => {
    let restoredDark = false;
    let html: HTMLElement | null = null;

    try {
      html = document.documentElement;
      if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        restoredDark = true;
      }
    } catch {}

    const bodyClasses = autopilot ? ['v2-app', 'autopilot'] : ['v2-app'];
    try { document.body.classList.add(...bodyClasses); } catch {}

    return () => {
      try { document.body.classList.remove('v2-app', 'autopilot'); } catch {}
      if (restoredDark && html) {
        try { html.classList.add('dark'); } catch {}
      }
    };
  }, [autopilot]);
}
