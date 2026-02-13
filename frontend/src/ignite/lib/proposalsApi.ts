import { apiGet } from '../../lib/api';
import { IgniteProposalComputed } from '../types/proposals';

export async function fetchClientProposal(proposalId: string): Promise<IgniteProposalComputed> {
  const response = await apiGet(`/api/ignite/client/proposals/${proposalId}`);
  return response?.proposal as IgniteProposalComputed;
}

export async function fetchSharedProposal(token: string): Promise<IgniteProposalComputed> {
  const response = await apiGet(`/api/ignite/share/${token}`, { requireAuth: false });
  return (response?.computed || response?.proposal?.computed_json?.client_payload) as IgniteProposalComputed;
}

export function buildProposalPdfUrl(proposalId: string, optionId?: string | null): string {
  const suffix = optionId ? `?optionId=${encodeURIComponent(optionId)}` : '';
  return `/api/ignite/client/proposals/${proposalId}/pdf${suffix}`;
}
