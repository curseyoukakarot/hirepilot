/**
 * v2 — V2KillSwitchGuard
 *
 * Renders nothing. Watches the global `v2_banner_enabled` flag (set by
 * Super Admins from the SuperAdmin dashboard) and force-redirects the
 * user to `/dashboard` whenever:
 *
 *   - the flag is OFF, AND
 *   - the user is currently on a `/v2/*` route.
 *
 * Mount once at the App root (alongside V2UpgradeBanner). Used as a
 * UX kill-switch while v2 is still being polished — protects production
 * from half-finished surfaces with a single Super-Admin toggle.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useV2BannerFlag } from '../hooks/useV2BannerFlag';

export default function V2KillSwitchGuard() {
  const { enabled, loaded } = useV2BannerFlag();
  const location = useLocation();

  useEffect(() => {
    if (!loaded) return;
    if (enabled) return;
    if (!location.pathname.startsWith('/v2')) return;
    // v2 access has been turned off — bounce back to legacy.
    try {
      window.location.replace('/dashboard');
    } catch {
      window.location.href = '/dashboard';
    }
  }, [enabled, loaded, location.pathname]);

  return null;
}
