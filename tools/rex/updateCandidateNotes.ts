/**
 * Tool: UpdateCandidateNotes
 * Description: Allows REX (or collaborators) to add notes on a candidate.
 * Each note is stored as a separate row for better collaboration and history tracking.
 *
 * Access: team_admin, pro, recruitpro, and guest collaborators with comment rights.
 */

import { z } from "zod";
import { supabaseDb } from "../../backend/lib/supabase";

const UpdateCandidateNotes = {
  name: "updateCandidateNotes",
  description: "Add a note for a candidate (stored with timestamp and author).",
  inputSchema: z.object({
    candidateId: z.string().min(1, "candidateId is required"),
    note: z.string().min(1, "Note cannot be empty"),
    author: z.string().min(1, "Author is required (name or ID)"),
  }),
  run: async ({ candidateId, note, author }: {
    candidateId: string;
    note: string;
    author: string;
  }) => {
    try {
      // First, verify the candidate exists
      const { data: candidate, error: candidateError } = await supabaseDb
        .from("candidates")
        .select("id, first_name, last_name")
        .eq("id", candidateId)
        .single();

      if (candidateError || !candidate) {
        console.error('[updateCandidateNotes] Candidate not found:', candidateError);
        return { error: `Candidate not found: ${candidateError?.message || 'Not found'}` };
      }

      // Insert the note
      const { data, error } = await supabaseDb
        .from("candidate_notes")
        .insert([{ 
          candidate_id: candidateId, 
          author_id: null, // REX doesn't have a user ID, so we'll use author_name
          author_name: author, 
          note_text: note,
          created_at: new Date().toISOString()
        }])
        .select("id, candidate_id, author_id, author_name, note_text, created_at")
        .single();

      if (error) {
        console.error('[updateCandidateNotes] Supabase error:', error);
        return { error: `Error adding note: ${error.message}` };
      }

      const candidateName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

      return {
        message: `📝 Note added for candidate ${candidateName}`,
        note: {
          id: data.id,
          candidateId: data.candidate_id,
          candidateName,
          author: data.author_name,
          note: data.note_text,
          createdAt: data.created_at,
          createdDisplay: new Date(data.created_at).toLocaleDateString(),
        },
      };
    } catch (error) {
      console.error('[updateCandidateNotes] Unexpected error:', error);
      return { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
};

export default UpdateCandidateNotes;
