/**
 * v2 / Settings Wrapper
 *
 * Wave 3 — wraps the legacy <Settings /> screen inside the v2 shell so
 * `/v2/settings/*` (profile, integrations, notifications, credits, api,
 * etc.) stays inside v2 chrome instead of bouncing to legacy `/settings`.
 *
 * The legacy Settings component parses `location.pathname.split('/').pop()`
 * to pick the active tab — works for `/v2/settings/integrations` because
 * the last segment is still the tab name.
 *
 * The team tab is NOT routed here — `/v2/settings/team` is its own native
 * v2 page (V2TeamSettings). This wrapper handles every other tab.
 */

import React, { Suspense, lazy } from 'react';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';

const LegacySettings = lazy(() => import('../../screens/Settings'));

export default function V2SettingsWrapper() {
  useV2Theme();
  return (
    <WorkspaceShell autopilot>
      <Suspense
        fallback={
          <div className="px-8 py-12 text-center text-text-muted">
            <i className="fa-solid fa-spinner fa-spin text-primary text-[20px] mb-2" />
            <div>Loading settings…</div>
          </div>
        }
      >
        <LegacySettings />
      </Suspense>
    </WorkspaceShell>
  );
}
