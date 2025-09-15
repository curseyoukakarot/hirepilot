/**
 * Tool: ViewPipeline
 * Description: Allows REX to access pipeline data for a given Job REQ,
 * including candidates in each stage, their status, and timestamps.
 * Supports filtering by stage, staleness (time in stage), or candidate name.
 *
 * Access: Available to all collaborators (team members + guests) with visibility to the job's pipeline.
 * Filtering order: Stage → Candidate Name → Staleness cutoff
 */

import { z } from "zod";
import { supabaseDb } from "../../backend/lib/supabase";

const ViewPipeline = {
  name: "viewPipeline",
  description: "Get a structured list of candidates in each pipeline stage for a specific job.",
  inputSchema: z.object({
    jobId: z.string().min(1, "jobId is required"),
    stage: z.string().optional(),
    staleDays: z.number().positive().optional(),
    candidateName: z.string().optional(),
  }),
  run: async ({ jobId, stage, staleDays, candidateName }: {
    jobId: string;
    stage?: string;
    staleDays?: number;
    candidateName?: string;
  }) => {
    try {
      // Base query to get candidates with their job associations and stage info
      let query = supabaseDb
        .from("candidate_jobs")
        .select(`
          id,
          stage,
          created_at,
          updated_at,
          candidates (
            id,
            first_name,
            last_name,
            email,
            notes,
            created_at,
            updated_at
          )
        `)
        .eq("job_id", jobId);

      // Stage filter
      if (stage) {
        query = query.eq("stage", stage);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[viewPipeline] Supabase error:', error);
        return { error: `Error fetching pipeline data: ${error.message}` };
      }

      let filteredData = data || [];

      // Candidate name search (case-insensitive)
      if (candidateName) {
        filteredData = filteredData.filter((row: any) => {
          const fullName = `${row.candidates?.first_name || ''} ${row.candidates?.last_name || ''}`.trim();
          return fullName.toLowerCase().includes(candidateName.toLowerCase());
        });
      }

      // Staleness filter (time in stage exceeds staleDays)
      if (staleDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - staleDays);
        filteredData = filteredData.filter(
          (row: any) => new Date(row.updated_at) < cutoff
        );
      }

      if (filteredData.length === 0) {
        return { message: "No matching candidates found in the pipeline." };
      }

      // Return JSON for downstream use
      return {
        candidates: filteredData.map((row: any) => ({
          id: row.candidates?.id,
          name: `${row.candidates?.first_name || ''} ${row.candidates?.last_name || ''}`.trim(),
          email: row.candidates?.email || '',
          stage: row.stage,
          notes: row.candidates?.notes || null,
          createdAt: row.candidates?.created_at,
          updatedAt: row.updated_at,
          lastUpdatedDisplay: new Date(row.updated_at).toLocaleDateString(),
        })),
      };
    } catch (error) {
      console.error('[viewPipeline] Unexpected error:', error);
      return { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
};

export default ViewPipeline;
