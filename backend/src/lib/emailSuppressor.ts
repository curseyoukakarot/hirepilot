import { supabase } from './supabase';

const SUPPRESSION_WINDOW_HOURS = 4;

export async function canSendLifecycleEmail(userId: string): Promise<boolean> {
  const { data: lastEmail, error } = await supabase
    .from('email_events')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Be permissive on errors (don't block sends due to read failure)
    return true;
  }

  if (!lastEmail) return true;
  const hoursSince = (Date.now() - new Date((lastEmail as any).created_at).getTime()) / 36e5;
  return hoursSince >= SUPPRESSION_WINDOW_HOURS;
}


