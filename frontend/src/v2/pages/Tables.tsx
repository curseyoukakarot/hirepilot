/**
 * v2 / Tables
 *
 * Wave 2 wrapper — wraps the legacy <Tables /> list page inside the v2
 * WorkspaceShell so the sidebar's Tools → Tables link stays in /v2/* and
 * users get v2 chrome (sidebar + REX FAB) without us rebuilding the
 * Tables data layer.
 *
 * The legacy page renders its own card grid + edit/share/import flows.
 * Inside /v2 routes, the legacy Sidebar/Navbar are auto-suppressed in
 * App.jsx, so we don't get conflicting chrome.
 *
 * Future (Wave 5): port the mockup design from mockups/tables.html and
 * swap to native v2 hooks.
 */

import React, { Suspense, lazy } from 'react';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';

const LegacyTables = lazy(() => import('../../pages/Tables'));

export default function V2TablesPage() {
  useV2Theme();
  return (
    <WorkspaceShell autopilot>
      <Suspense
        fallback={
          <div className="px-8 py-12 text-center text-text-muted">
            <i className="fa-solid fa-spinner fa-spin text-primary text-[20px] mb-2" />
            <div>Loading Tables…</div>
          </div>
        }
      >
        <LegacyTables />
      </Suspense>
    </WorkspaceShell>
  );
}
