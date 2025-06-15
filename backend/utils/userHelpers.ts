import { supabase } from '../lib/supabase';

export async function getUserTokens(userId: string) {
  const { data, error } = await supabase
    .from('user_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new Error('No connected account');
  return data;
}
