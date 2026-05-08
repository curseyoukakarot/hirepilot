/**
 * v2 — useBillingSummary + openBillingPortal
 *
 * Wraps GET /api/v2/billing/summary (workspace + member count + active
 * Stripe subscription) and GET /api/v2/billing/portal (one-time Customer
 * Portal URL for seat / billing management).
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export interface BillingSummary {
  workspace: {
    id: string;
    name: string | null;
    plan: string | null;
    seat_count: number;
  } | null;
  members_active: number;
  stripe: {
    subscription_id: string;
    status: string;
    current_period_end: string | null;
    quantity: number;
    unit_amount: number | null;
    currency: string;
    interval: string;
    cancel_at_period_end: boolean;
  } | null;
}

export function useBillingSummary() {
  const query = useQuery({
    queryKey: ['v2', 'billing', 'summary'],
    queryFn: () => apiGet('/api/v2/billing/summary') as Promise<BillingSummary>,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** Resolve a fresh Customer Portal URL and redirect the browser to it. */
export async function openBillingPortal(returnUrl?: string) {
  const url = `/api/v2/billing/portal${returnUrl ? `?return_url=${encodeURIComponent(returnUrl)}` : ''}`;
  const resp: any = await apiGet(url);
  if (resp?.url) {
    window.location.href = resp.url;
    return true;
  }
  if (resp?.error === 'no_stripe_customer') {
    alert(resp.message || 'No active subscription. Start one from /workspaces.');
    return false;
  }
  alert('Could not open the billing portal.');
  return false;
}
