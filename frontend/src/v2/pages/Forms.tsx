/**
 * v2 / Forms
 *
 * Wave 2 wrapper — embeds the legacy <FormsHome /> inside the v2 shell
 * so /v2/forms is a real, working route instead of a sidebar bounce to
 * legacy /custom-forms. Form builder + responses still reachable via
 * /forms/:id and /forms/:id/responses (those have their own routes in
 * App.jsx; we'll wrap them as Wave 5 polish).
 */

import React, { Suspense, lazy } from 'react';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';

const LegacyFormsHome = lazy(() => import('../../pages/forms/FormsHome'));

export default function V2FormsPage() {
  useV2Theme();
  return (
    <WorkspaceShell autopilot>
      <Suspense
        fallback={
          <div className="px-8 py-12 text-center text-text-muted">
            <i className="fa-solid fa-spinner fa-spin text-primary text-[20px] mb-2" />
            <div>Loading Forms…</div>
          </div>
        }
      >
        <LegacyFormsHome />
      </Suspense>
    </WorkspaceShell>
  );
}
