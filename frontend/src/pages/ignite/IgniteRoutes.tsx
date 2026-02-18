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
import DashboardPage from '../igniteBackoffice/DashboardPage';
import LedgerPage from '../igniteBackoffice/LedgerPage';
import AllocationsPage from '../igniteBackoffice/AllocationsPage';
import AccountsPage from '../igniteBackoffice/AccountsPage';
import ImportsPage from '../igniteBackoffice/ImportsPage';
import BackofficeLoginPage from '../igniteBackoffice/BackofficeLoginPage';

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
  if (pathname.startsWith('/ignite/backoffice')) return 'ignite-page-backoffice';
  if (pathname.startsWith('/ignite/proposals')) return 'ignite-page-proposals';
  return 'ignite-page-default';
}

function normalizeHost(value: any): string {
  return String(value || '').trim().toLowerCase();
}

export default function IgniteRoutes({ role }: IgniteRoutesProps) {
  const location = useLocation();
  const pageFlavorClass = getIgnitePageFlavor(location.pathname);
  const hostname = typeof window !== 'undefined' ? normalizeHost(window.location.hostname) : '';
  const backofficeHost = normalizeHost((import.meta as any)?.env?.VITE_IGNITE_BACKOFFICE_HOSTNAME || 'backoffice.ignitegtm.com');
  const backofficeHostTypo = normalizeHost((import.meta as any)?.env?.VITE_IGNITE_BACKOFFCE_HOSTNAME || 'backoffce.ignitegtm.com');
  const isBackofficeHost = hostname === backofficeHost || hostname === backofficeHostTypo;

  return (
    <div className={`ignite-theme ${pageFlavorClass}`}>
      <Routes>
        <Route path="/login" element={isBackofficeHost ? <BackofficeLoginPage /> : <IgniteClientLoginPage />} />
        {!isBackofficeHost ? <Route path="/signup" element={<IgniteClientSignupPage />} /> : null}
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
          path="/ignite/backoffice"
          element={
            <RequireIgniteAccess
              role={role}
              allowedRoles={['ignite_backoffice', 'ignite_admin', 'ignite_team']}
              loginPath="/login"
              deniedMessage="Your account does not have Ignite Backoffice access. Ask a super admin to grant the ignite_backoffice role."
            >
              <DashboardPage />
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/backoffice/ledger"
          element={
            <RequireIgniteAccess
              role={role}
              allowedRoles={['ignite_backoffice', 'ignite_admin', 'ignite_team']}
              loginPath="/login"
              deniedMessage="Your account does not have Ignite Backoffice access. Ask a super admin to grant the ignite_backoffice role."
            >
              <LedgerPage />
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/backoffice/allocations"
          element={
            <RequireIgniteAccess
              role={role}
              allowedRoles={['ignite_backoffice', 'ignite_admin', 'ignite_team']}
              loginPath="/login"
              deniedMessage="Your account does not have Ignite Backoffice access. Ask a super admin to grant the ignite_backoffice role."
            >
              <AllocationsPage />
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/backoffice/accounts"
          element={
            <RequireIgniteAccess
              role={role}
              allowedRoles={['ignite_backoffice', 'ignite_admin', 'ignite_team']}
              loginPath="/login"
              deniedMessage="Your account does not have Ignite Backoffice access. Ask a super admin to grant the ignite_backoffice role."
            >
              <AccountsPage />
            </RequireIgniteAccess>
          }
        />
        <Route
          path="/ignite/backoffice/imports"
          element={
            <RequireIgniteAccess
              role={role}
              allowedRoles={['ignite_backoffice', 'ignite_admin', 'ignite_team']}
              loginPath="/login"
              deniedMessage="Your account does not have Ignite Backoffice access. Ask a super admin to grant the ignite_backoffice role."
            >
              <ImportsPage />
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
                to={
                  isBackofficeHost
                    ? '/ignite/backoffice'
                    : String(role || '').toLowerCase().replace(/[\s-]/g, '_') === 'ignite_client'
                      ? '/ignite/client'
                      : '/ignite/proposals'
                }
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
                to={
                  isBackofficeHost
                    ? '/ignite/backoffice'
                    : String(role || '').toLowerCase().replace(/[\s-]/g, '_') === 'ignite_client'
                      ? '/ignite/client'
                      : '/ignite/proposals'
                }
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
