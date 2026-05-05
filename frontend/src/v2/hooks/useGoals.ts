/**
 * v2 — useGoals
 * React Query hook around /api/v2/goals.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
import type { Goal, GoalStatus, TrustLevel } from '../types';

const QK = (status?: GoalStatus) => ['v2', 'goals', status || 'all'] as const;

export function useGoals(status?: GoalStatus) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK(status),
    queryFn: () => {
      const url = status ? `/api/v2/goals?status=${status}` : '/api/v2/goals';
      return apiGet(url) as Promise<{ goals: Goal[] }>;
    },
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['v2', 'goals'] });

  const create = useMutation({
    mutationFn: (input: {
      title: string;
      prompt?: string;
      plan?: any;
      trust_level?: TrustLevel;
      recurring?: boolean;
      schedule_cron?: string;
      metadata?: any;
    }) => apiPost('/api/v2/goals', input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: { id: string; [k: string]: any }) => {
      const { id, ...rest } = input;
      return apiPatch(`/api/v2/goals/${id}`, rest);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v2/goals/${id}`),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v2/goals/${id}/approve`),
    onSuccess: invalidate,
  });

  const pause = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v2/goals/${id}/pause`),
    onSuccess: invalidate,
  });

  const resume = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v2/goals/${id}/resume`),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v2/goals/${id}/cancel`),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v2/goals/${id}/complete`),
    onSuccess: invalidate,
  });

  return {
    goals: query.data?.goals ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    create,
    update,
    remove,
    approve,
    pause,
    resume,
    cancel,
    complete,
  };
}
