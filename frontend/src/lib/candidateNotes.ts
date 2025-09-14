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
  // Get author info directly from auth user - most reliable source
  console.log('User data for notes:', { 
    email: user?.email, 
    user_metadata: (user as any)?.user_metadata,
    raw_user: user 
  });
  
  const authorName = (user as any)?.user_metadata?.full_name || 
                     (user as any)?.user_metadata?.name || 
                     user?.email || 
                     'Unknown';
  const authorAvatar = (user as any)?.user_metadata?.avatar_url || null;
  try {
    const { data, error } = await supabase
      .from('candidate_notes')
      .insert([
        {
          candidate_id: candidateId,
          note_text: noteText,
          author_id: user?.id || null,
          author_name: authorName,
          author_avatar_url: authorAvatar,
        },
      ])
      .select('*');
    if (error) throw error;
    return (data || []) as CandidateNote[];
  } catch (e: any) {
    // If RLS blocks, provide clearer message
    if (e?.code === '42501') {
      throw new Error('You do not have permission to add notes for this candidate. Ensure you are a collaborator or guest on this job.');
    }
    throw e;
  }
}

export async function getCandidateNotes(candidateId: string): Promise<CandidateNote[]> {
  try {
    const { data, error } = await supabase
      .from('candidate_notes')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as CandidateNote[];
  } catch (e: any) {
    // Table may not exist yet; return empty to avoid breaking UI
    if (e?.message?.includes('relation') || e?.code === '42P01') return [];
    throw e;
  }
}


