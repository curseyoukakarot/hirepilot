/**
 * Sticky banner shown in the legacy app when the user is still on
 * `ui_version='legacy'` and hasn't dismissed it yet. Provides a one-click
 * switch to the new v2 UI + a Maybe-Later opt-out.
 *
 * Drop this anywhere in the legacy app's root layout (e.g. App.jsx
 * adjacent to the legacy sidebar). It auto-hides:
 *   - When user is on the v2 UI already
 *   - When dismissed (writes v2_banner_dismissed_at on the user row)
 *   - When the route is /v2/* (don't double-show on v2 pages)
 */

import React from 'react';
import { useUIVersion } from '../hooks/useUIVersion';

export default function V2UpgradeBanner() {
  const { uiVersion, isDismissed, isLoading, switchTo, dismissBanner } = useUIVersion();

  // Don't render until we know the preference + don't show on v2 pages.
  if (isLoading) return null;
  if (uiVersion === 'v2') return null;
  if (isDismissed) return null;
  try { if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v2')) return null; } catch {}

  return (
    <div
      role="banner"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        maxWidth: 'calc(100vw - 32px)',
        background: 'linear-gradient(135deg,#6B46C1 0%,#0C5CF4 70%)',
        color: 'white',
        borderRadius: 14,
        padding: '12px 16px',
        boxShadow: '0 18px 40px -12px rgba(15,15,26,.45), 0 4px 12px -4px rgba(107,70,193,.45)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontSize: 13.5,
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'rgba(255,255,255,.18)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 14,
        }}
        aria-hidden
      >
        ✨
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>The new HirePilot UI is here.</div>
        <div style={{ opacity: 0.9, fontSize: 12.5 }}>
          REX coordinates your team, every Skill is one click away. Your leads, candidates & deals come with you.
        </div>
      </div>
      <button
        onClick={() => switchTo('v2')}
        style={{
          background: 'white',
          color: '#6B46C1',
          padding: '7px 14px',
          borderRadius: 9,
          fontWeight: 700,
          fontSize: 12.5,
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: '0 4px 12px -4px rgba(0,0,0,.2)',
        }}
      >
        Try v2 →
      </button>
      <button
        onClick={() => dismissBanner()}
        style={{
          background: 'transparent',
          color: 'rgba(255,255,255,.85)',
          padding: '7px 10px',
          borderRadius: 9,
          fontWeight: 600,
          fontSize: 12.5,
          border: '1px solid rgba(255,255,255,.25)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        title="Hide this banner"
      >
        Maybe later
      </button>
    </div>
  );
}
