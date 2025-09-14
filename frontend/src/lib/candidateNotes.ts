import { supabase } from './supabase';

export interface CandidateNote {
  id: string;
  candidate_id: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  note_text: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function addCandidateNote(candidateId: string, noteText: string): Promise<CandidateNote[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  const { data, error } = await supabase
    .from('candidate_notes')
    .insert([
      {
        candidate_id: candidateId,
        note_text: noteText,
        author_id: user?.id || null,
        author_name: (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || null,
        author_avatar_url: (user as any)?.user_metadata?.avatar_url || null,
      },
    ])
    .select('*');
  if (error) throw error;
  return (data || []) as CandidateNote[];
}

export async function getCandidateNotes(candidateId: string): Promise<CandidateNote[]> {
  const { data, error } = await supabase
    .from('candidate_notes')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as CandidateNote[];
}


