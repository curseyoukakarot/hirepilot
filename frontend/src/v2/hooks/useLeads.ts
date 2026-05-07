/**
 * v2 — useLeads
 * Lists leads in the active workspace via the existing /api/leads route
 * (no v2-specific endpoint needed; the legacy route already enforces
 * workspace scoping via the x-workspace-id header set by lib/api.ts).
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export interface Lead {
  id: string;
  user_id: string | null;
  campaign_id: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  location: string | null;
  status: string | null;
  enrichment_data: any;
  enrichment_source: string | null;
  source: string | null;
  created_at: string;
  // Optional fields surfaced by some routes
  score?: number | null;
  is_hot?: boolean | null;
}

export function useLeads(opts: { campaignId?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.campaignId) params.set('campaignId', opts.campaignId);
  const qs = params.toString();
  const url = qs ? `/api/leads?${qs}` : '/api/leads';

  const query = useQuery({
    queryKey: ['v2', 'leads', opts.campaignId || 'all'],
    queryFn: async () => {
      const resp: any = await apiGet(url);
      // Existing route returns either { leads: [...] } or a bare array.
      const leads: Lead[] = Array.isArray(resp) ? resp : (resp?.leads || resp?.data || []);
      return { leads };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    leads: query.data?.leads ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Domain extractor for Skill inputs that need a company domain. */
export function leadDomain(lead: Lead | undefined): string | undefined {
  if (!lead) return undefined;
  const en = lead.enrichment_data;
  const fromEnrichment =
    en?.organization?.website_url ||
    en?.organization?.domain ||
    en?.company?.website ||
    en?.company?.domain;
  if (fromEnrichment) {
    return String(fromEnrichment)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase();
  }
  return undefined;
}
