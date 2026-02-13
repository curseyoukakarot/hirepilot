import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import IgniteAppLayout from './IgniteAppLayout';
import RequireIgniteAccess from './RequireIgniteAccess';
import IgniteCreateProposalWizard from './wizard/IgniteCreateProposalWizard';
import IgniteTemplatesPage from './IgniteTemplatesPage';
import IgniteVendorRateCardsPage from './IgniteVendorRateCardsPage';
import IgniteClientsPage from './IgniteClientsPage';
import IgniteExportsPage from './IgniteExportsPage';
import IgniteClientLoginPage from './client/IgniteClientLoginPage';
import IgniteClientSignupPage from './client/IgniteClientSignupPage';
import IgniteClientPortalPage from './client/IgniteClientPortalPage';

type IgniteRoutesProps = {
  role?: string | null;
};

export default function IgniteRoutes({ role }: IgniteRoutesProps) {
  return (
    <Routes>
      <Route path="/login" element={<IgniteClientLoginPage />} />
      <Route path="/signup" element={<IgniteClientSignupPage />} />
      <Route
        path="/ignite/client"
        element={
          <RequireIgniteAccess role={role} allowedRoles={['ignite_client']}>
            <IgniteClientPortalPage />
          </RequireIgniteAccess>
        }
      />
      <Route
        path="/ignite/proposals"
        element={
          <RequireIgniteAccess role={role} allowedRoles={['ignite_admin', 'ignite_team']}>
            <IgniteAppLayout>
              <IgniteCreateProposalWizard />
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
  );
}
