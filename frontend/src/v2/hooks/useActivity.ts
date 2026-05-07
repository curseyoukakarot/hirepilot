/**
 * v2 — useActivity
 * React Query hook around /api/v2/activity (REX/specialist event feed).
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export type ActivityEvent = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  agent_id: string | null;
  agent_role: string | null;
  event_type:
    | 'skill_executed' | 'skill_held' | 'skill_failed'
    | 'goal_planned' | 'goal_started' | 'goal_step_done' | 'goal_completed' | 'goal_failed'
    | 'decision_resolved' | 'agent_hired' | 'agent_fired' | 'agent_trust_changed';
  goal_id: string | null;
  decision_id: string | null;
  skill_id: string | null;
  summary: string;
  detail: any;
  created_at: string;
};

export function useActivity(opts: { agentId?: string; role?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.agentId) params.set('agent_id', opts.agentId);
  if (opts.role) params.set('role', opts.role);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const url = qs ? `/api/v2/activity?${qs}` : '/api/v2/activity';

  const query = useQuery({
    queryKey: ['v2', 'activity', opts.agentId || 'all', opts.role || 'all', opts.limit || 50],
    queryFn: () => apiGet(url) as Promise<{ activity: ActivityEvent[] }>,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    activity: query.data?.activity ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
