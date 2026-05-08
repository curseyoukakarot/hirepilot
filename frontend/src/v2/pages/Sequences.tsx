/**
 * v2 / Sequences — list page
 *
 * Wave 2 — embeds the legacy <SequencesTab /> (which already loads from
 * /api/sequences) inside a v2 shell with a styled header. SequencesTab
 * handles row click → /sequences/:id (legacy detail).
 *
 * Future (Wave 5): port the visual flow canvas + step inspector from
 * mockups/sequences.html.
 */

import React, { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';

const LegacySequencesTab = lazy(() => import('../../components/sequences/SequencesTab'));

export default function V2SequencesPage() {
  useV2Theme();
  const navigate = useNavigate();

  return (
    <WorkspaceShell autopilot>
      <header className="border-b border-gray-100 px-8 h-14 glass flex items-center gap-4 sticky top-0 z-30">
        <div className="font-semibold text-[14.5px] flex items-center gap-2">
          <i className="fa-solid fa-diagram-project text-primary text-xs" />
          Sequences
        </div>
        <div className="status-pill ml-3">
          <i className="fa-solid fa-paper-plane text-secondary text-[10px]" />
          <span>Multi-step outbound flows</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <a href="/sequences" className="btn-outline">
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
            Builder
          </a>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
        </div>
      </header>

      <div className="px-8 py-6 max-w-[1200px] mx-auto">
        <Suspense
          fallback={
            <div className="px-8 py-12 text-center text-text-muted">
              <i className="fa-solid fa-spinner fa-spin text-primary text-[20px] mb-2" />
              <div>Loading sequences…</div>
            </div>
          }
        >
          <LegacySequencesTab
            onEditSequence={(id: string) => navigate(`/sequences/${id}`)}
          />
        </Suspense>
      </div>
    </WorkspaceShell>
  );
}
