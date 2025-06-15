import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function markExpiredCookies() {
  try {
    // Mark expired cookies as stale
    const { error } = await supabase.rpc('mark_expired_cookies');

    if (error) {
      console.error('Error marking expired cookies:', error);
    } else {
      console.log('Successfully checked for expired cookies');
    }
  } catch (error) {
    console.error('Failed to mark expired cookies:', error);
  }
} 