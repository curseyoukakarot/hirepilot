/**
 * v2 — useAgents
 * React Query hook around /api/v2/agents.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
import type { Agent, AgentRole, TrustLevel } from '../types';

const QK = ['v2', 'agents'] as const;

export function useAgents() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    queryFn: () => apiGet('/api/v2/agents') as Promise<{ agents: Agent[] }>,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const hire = useMutation({
    mutationFn: (input: { role: AgentRole; display_name?: string; trust_level?: TrustLevel }) =>
      apiPost('/api/v2/agents', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; trust_level?: TrustLevel; paused?: boolean; display_name?: string; config?: any }) => {
      const { id, ...rest } = input;
      return apiPatch(`/api/v2/agents/${id}`, rest);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  });

  const fire = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v2/agents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  });

  const installSkill = useMutation({
    mutationFn: (input: { agentId: string; skill_id: string; schedule_cron?: string; config?: any }) =>
      apiPost(`/api/v2/agents/${input.agentId}/skills`, {
        skill_id: input.skill_id,
        schedule_cron: input.schedule_cron,
        config: input.config,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  });

  const updateSkill = useMutation({
    mutationFn: (input: { agentId: string; skillId: string; enabled?: boolean; schedule_cron?: string; config?: any }) => {
      const { agentId, skillId, ...rest } = input;
      return apiPatch(`/api/v2/agents/${agentId}/skills/${skillId}`, rest);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  });

  const uninstallSkill = useMutation({
    mutationFn: (input: { agentId: string; skillId: string }) =>
      apiDelete(`/api/v2/agents/${input.agentId}/skills/${input.skillId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  });

  return {
    agents: query.data?.agents ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    hire,
    update,
    fire,
    installSkill,
    updateSkill,
    uninstallSkill,
  };
}

/** Lookup an agent by role from a result set. */
export function findAgentByRole(agents: Agent[] | undefined, role: AgentRole): Agent | undefined {
  return (agents || []).find((a) => a.role === role);
}
