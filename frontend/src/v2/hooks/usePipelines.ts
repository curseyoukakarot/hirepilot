/**
 * v2 — useJobs + useJobPipeline
 *
 * Two hooks to drive the Pipelines surface:
 *   - useJobs() — list job_requisitions in the active workspace.
 *   - useJobPipeline(jobId) — fetch the kanban shape (stages + candidates
 *     grouped by stage_id) for a specific job.
 *
 * Both wrap existing routes:
 *   GET /api/jobs (legacy listing)
 *   GET /api/pipelines/:pipelineId/stages?jobId=...
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export interface Job {
  id: string;
  title: string;
  department: string | null;
  status: string | null;
  pipeline_id: string | null;
  created_at: string;
  // Backend may send some of these; we tolerate missing fields.
  candidate_count?: number;
  description?: string | null;
}

export interface PipelineStage {
  id: string;
  pipeline_id?: string | null;
  job_id?: string | null;
  title: string;
  position: number;
  color?: string | null;
}

export interface PipelineCandidate {
  id: string;             // candidate_jobs.id
  candidate_id: string;
  name: string;
  email: string;
  avatar_url: string;
}

export function useJobs() {
  const query = useQuery({
    queryKey: ['v2', 'jobs'],
    queryFn: async () => {
      const resp: any = await apiGet('/api/jobs');
      const jobs: Job[] = Array.isArray(resp) ? resp : (resp?.jobs || resp?.data || []);
      return { jobs };
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    jobs: query.data?.jobs ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/**
 * Fetch the kanban shape for one job. Returns:
 *   { stages: PipelineStage[], candidates: Record<stage_id, PipelineCandidate[]> }
 */
export function useJobPipeline(jobId: string | undefined, pipelineId: string | undefined) {
  const enabled = !!jobId && !!pipelineId;
  const url = enabled ? `/api/pipelines/${pipelineId}/stages?jobId=${jobId}` : '';

  const query = useQuery({
    queryKey: ['v2', 'pipeline', jobId, pipelineId],
    queryFn: async () => {
      const resp: any = await apiGet(url);
      return {
        stages: (resp?.stages || []) as PipelineStage[],
        candidates: (resp?.candidates || {}) as Record<string, PipelineCandidate[]>,
      };
    },
    enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    stages: query.data?.stages ?? [],
    candidates: query.data?.candidates ?? {},
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
