/**
 * v2 — useSkills
 * React Query hook around /api/v2/skills (read-only catalog).
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import type { Skill, AgentRole } from '../types';

export function useSkills(role?: AgentRole) {
  const query = useQuery({
    queryKey: ['v2', 'skills', role || 'all'],
    queryFn: () => {
      const url = role ? `/api/v2/skills?role=${encodeURIComponent(role)}` : '/api/v2/skills';
      return apiGet(url) as Promise<{ skills: Skill[] }>;
    },
    staleTime: 5 * 60 * 1000, // catalog rarely changes — cache for 5 min
    refetchOnWindowFocus: false,
  });

  return {
    skills: query.data?.skills ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
