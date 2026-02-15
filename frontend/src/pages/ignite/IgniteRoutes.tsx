import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import IgniteAppLayout from './IgniteAppLayout';
import RequireIgniteAccess from './RequireIgniteAccess';
import IgniteCreateProposalWizard from './wizard/IgniteCreateProposalWizard';
import IgniteTemplatesPage from './IgniteTemplatesPage';
import IgniteVendorRateCardsPage from './IgniteVendorRateCardsPage';
import IgniteClientsPage from './IgniteClientsPage';
import IgniteExportsPage from './IgniteExportsPage';
import IgniteProposalSelectorPage from './IgniteProposalSelectorPage';
import IgniteClientViewerPage from './IgniteClientViewerPage';
import IgniteProposalViewerPage from './IgniteProposalViewerPage';
import IgniteClientLoginPage from './client/IgniteClientLoginPage';
import IgniteClientSignupPage from './client/IgniteClientSignupPage';
import IgniteClientPortalPage from './client/IgniteClientPortalPage';
import ClientProposalViewPage from './client/ClientProposalViewPage';
import SharedProposalViewPage from './client/SharedProposalViewPage';
import BackofficeProposalPreviewPage from './BackofficeProposalPreviewPage';

type IgniteRoutesProps = {
  role?: string | null;
};

function getIgnitePageFlavor(pathname: string): string {
  if (pathname.startsWith('/login')) return 'ignite-page-login';
  if (pathname.startsWith('/signup')) return 'ignite-page-signup';
  if (pathname.startsWith('/ignite/client')) return 'ignite-page-client-portal';
  if (pathname.startsWith('/ignite/proposals/') && pathname.endsWith('/preview')) return 'ignite-page-preview';
  if (pathname.startsWith('/proposals/')) return 'ignite-page-client-proposal';
  if (pathname.startsWith('/share/')) return 'ignite-page-share';
  if (pathname.startsWith('/ignite/templates')) return 'ignite-page-templates';
  if (pathname.startsWith('/ignite/rate-cards')) return 'ignite-page-rate-cards';
  if (pathname.startsWith('/ignite/clients')) return 'ignite-page-clients';
  if (pathname.startsWith('/ignite/exports')) return 'ignite-page-exports';
  if (pathname.startsWith('/ignite/proposals')) return 'ignite-page-proposals';
  return 'ignite-page-default';
}

export default function IgniteRoutes({ role }: IgniteRoutesProps) {
  const location = useLocation();
  const pageFlavorClass = getIgnitePageFlavor(location.pathname);

  return (
    <div className={`ignite-theme ${pageFlavorClass}`}>
      <Routes>
        <Route path="/login" element={<IgniteClientLoginPage />} />
        <Route path="/signup" element={<IgniteClientSignupPage />} />
        <Route path="/share/:token" element={<SharedProposalViewPage />} />
        <Route
          path="/proposals/:proposalId"
          element={
            <RequireIgniteAccess role={role}>
              <ClientProposalViewPage />
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/client"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_client']}>
              <IgniteClientPortalPage />
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/proposals/:proposalId/preview"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <BackofficeProposalPreviewPage />
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/proposals"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <IgniteAppLayout>
                <IgniteProposalSelectorPage />
              </IgniteAppLayout>
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/proposals/new"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <IgniteAppLayout>
                <IgniteCreateProposalWizard />
              </IgniteAppLayout>
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/proposals/:proposalId"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <IgniteAppLayout>
                <IgniteProposalViewerPage />
              </IgniteAppLayout>
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/clients"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <IgniteAppLayout>
                <IgniteClientsPage />
              </IgniteAppLayout>
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/clients/:clientId"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <IgniteAppLayout>
                <IgniteClientViewerPage />
              </IgniteAppLayout>
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/templates"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <IgniteAppLayout>
                <IgniteTemplatesPage />
              </IgniteAppLayout>
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/rate-cards"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <IgniteAppLayout>
                <IgniteVendorRateCardsPage />
              </IgniteAppLayout>
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/exports"
          element={
            <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
              <IgniteAppLayout>
                <IgniteExportsPage />
              </IgniteAppLayout>
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite"
          element={
            <RequireIgniteAccess role={role}>
              <Navigate
                to={String(role || '').toLowerCase().replace(/[\s-]/g, '_') === 'ignite_client' ? '/ignite/client' : '/ignite/proposals'}
                replace
              />
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/"
          element={
            <RequireIgniteAccess role={role}>
              <Navigate
                to={String(role || '').toLowerCase().replace(/[\s-]/g, '_') === 'ignite_client' ? '/ignite/client' : '/ignite/proposals'}
                replace
              />
            </RequireIgniteAccess>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}
