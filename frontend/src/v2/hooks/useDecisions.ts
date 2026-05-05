/**
 * v2 — useDecisions
 * React Query hook around /api/v2/decisions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api';
import type { Decision, DecisionStatus } from '../types';

interface UseDecisionsOpts {
  status?: DecisionStatus;
  goalId?: string;
  assignedTo?: string | 'me';
}

export function useDecisions(opts: UseDecisionsOpts = {}) {
  const queryClient = useQueryClient();
  const { status, goalId, assignedTo } = opts;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (goalId) params.set('goal_id', goalId);
  if (assignedTo) params.set('assigned_to', assignedTo);
  const qs = params.toString();
  const url = qs ? `/api/v2/decisions?${qs}` : '/api/v2/decisions';

  const queryKey = ['v2', 'decisions', status || 'all', goalId || 'all', assignedTo || 'all'] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => apiGet(url) as Promise<{ decisions: Decision[] }>,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['v2', 'decisions'] });

  const approve = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v2/decisions/${id}/approve`),
    onSuccess: invalidate,
  });

  const edit = useMutation({
    mutationFn: (input: { id: string; payload: any; note?: string }) =>
      apiPost(`/api/v2/decisions/${input.id}/edit`, { payload: input.payload, note: input.note }),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: (input: { id: string; reason?: string }) =>
      apiPost(`/api/v2/decisions/${input.id}/reject`, { reason: input.reason }),
    onSuccess: invalidate,
  });

  const snooze = useMutation({
    mutationFn: (input: { id: string; snoozedUntil: string }) =>
      apiPost(`/api/v2/decisions/${input.id}/snooze`, { snoozed_until: input.snoozedUntil }),
    onSuccess: invalidate,
  });

  const graduate = useMutation({
    mutationFn: (input: { id: string; rule: any }) =>
      apiPost(`/api/v2/decisions/${input.id}/graduate`, { rule: input.rule }),
    onSuccess: invalidate,
  });

  return {
    decisions: query.data?.decisions ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    approve,
    edit,
    reject,
    snooze,
    graduate,
  };
}
