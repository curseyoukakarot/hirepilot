/**
 * v2 — useDeals
 * Lists opportunities (deals) in the active workspace via the existing
 * /api/opportunities route.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export interface Deal {
  id: string;
  title: string;
  value: number | null;
  billing_type: string | null;
  stage: string | null;
  status: string | null;
  owner_id: string | null;
  client_id: string | null;
  created_at: string;
  tag: string | null;
  forecast_date: string | null;
  start_date: string | null;
  term_months: number | null;
  margin: number | null;
  margin_type: string | null;
  client: { id: string; name: string | null; domain: string | null } | null;
  owner: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  reqs: string[];
}

export function useDeals(opts: { stage?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.stage) params.set('status', opts.stage);
  if (opts.search) params.set('search', opts.search);
  const qs = params.toString();
  const url = qs ? `/api/opportunities?${qs}` : '/api/opportunities';

  const query = useQuery({
    queryKey: ['v2', 'deals', opts.stage || 'all', opts.search || ''],
    queryFn: async () => {
      const resp: any = await apiGet(url);
      const deals: Deal[] = Array.isArray(resp) ? resp : (resp?.opportunities || resp?.data || []);
      return { deals };
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    deals: query.data?.deals ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
