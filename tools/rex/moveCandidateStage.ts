/**
 * Tool: MoveCandidateStage
 * Description: Allows REX to update the pipeline stage of a candidate.
 * Includes guardrails for role-based access and optional confirmation prompts.
 *
 * Access: Only available to team_admin, pro, or RecruitPro roles.
 */

import { z } from "zod";
import { supabaseDb } from "../../backend/lib/supabase";

const MoveCandidateStage = {
  name: "moveCandidateStage",
  description: "Move a candidate to a different pipeline stage.",
  inputSchema: z.object({
    candidateId: z.string().min(1, "candidateId is required"),
    newStage: z.string().min(1, "newStage is required"),
    requestedByRole: z.enum(["team_admin", "pro", "recruitpro", "guest", "member"]),
    confirm: z.boolean().default(false),
  }),
  run: async ({ candidateId, newStage, requestedByRole, confirm }: {
    candidateId: string;
    newStage: string;
    requestedByRole: "team_admin" | "pro" | "recruitpro" | "guest" | "member";
    confirm: boolean;
  }) => {
    try {
      // Guardrails: Role restriction
      if (!["team_admin", "pro", "recruitpro"].includes(requestedByRole)) {
        return { error: "You do not have permission to move candidates between stages." };
      }

      // Guardrails: Require confirmation
      if (!confirm) {
        return {
          message: `⚠️ Confirm required: Do you want to move candidate ${candidateId} to stage "${newStage}"?`,
          requiresConfirmation: true,
        };
      }

      // First, get the candidate's current job association to update the correct record
      const { data: candidateJob, error: jobError } = await supabaseDb
        .from("candidate_jobs")
        .select(`
          id,
          job_id,
          stage,
          candidates (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("candidate_id", candidateId)
        .single();

      if (jobError || !candidateJob) {
        console.error('[moveCandidateStage] Candidate job lookup failed:', jobError);
        return { error: `Candidate not found or not associated with a job: ${jobError?.message || 'Not found'}` };
      }

      // Execute update on candidate_jobs table (this is where the stage is stored)
      const { data, error } = await supabaseDb
        .from("candidate_jobs")
        .update({ 
          stage: newStage, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", candidateJob.id)
        .select(`
          id,
          stage,
          updated_at,
          candidates (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .single();

      if (error) {
        console.error('[moveCandidateStage] Update error:', error);
        return { error: `Error moving candidate: ${error.message}` };
      }

      const candidateName = `${data.candidates?.first_name || ''} ${data.candidates?.last_name || ''}`.trim();

      return {
        message: `✅ Candidate ${candidateName} successfully moved to stage "${data.stage}".`,
        candidate: {
          id: data.candidates?.id,
          name: candidateName,
          email: data.candidates?.email,
          stage: data.stage,
          updatedAt: data.updated_at
        },
      };
    } catch (error) {
      console.error('[moveCandidateStage] Unexpected error:', error);
      return { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
};

export default MoveCandidateStage;
