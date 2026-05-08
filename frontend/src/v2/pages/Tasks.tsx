/**
 * v2 / Tasks
 *
 * Wave 2 wrapper — embeds the legacy <TasksPage /> inside the v2 shell.
 * All the existing task hooks (apiGet('/api/tasks'), comments, statuses,
 * detail panel) keep working unchanged. Users get the v2 sidebar +
 * REX FAB around the proven legacy task UI.
 *
 * Future (Wave 5): port the kanban + REX-drafted-tasks visual from
 * mockups/tasks.html.
 */

import React, { Suspense, lazy } from 'react';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';

const LegacyTasksPage = lazy(() => import('../../pages/tasks/TasksPage'));

export default function V2TasksPage() {
  useV2Theme();
  return (
    <WorkspaceShell autopilot>
      <Suspense
        fallback={
          <div className="px-8 py-12 text-center text-text-muted">
            <i className="fa-solid fa-spinner fa-spin text-primary text-[20px] mb-2" />
            <div>Loading Tasks…</div>
          </div>
        }
      >
        <LegacyTasksPage />
      </Suspense>
    </WorkspaceShell>
  );
}
