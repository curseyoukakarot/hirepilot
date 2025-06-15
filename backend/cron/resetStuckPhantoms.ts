import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function resetStuckPhantoms() {
  try {
    // Reset any phantoms that have been running for more than 20 minutes
    const { error } = await supabase
      .from('phantoms')
      .update({ status: 'idle' })
      .lt('last_run_at', new Date(Date.now() - 20 * 60 * 1000).toISOString())
      .eq('status', 'running');

    if (error) {
      console.error('Error resetting stuck phantoms:', error);
    } else {
      console.log('Successfully checked for stuck phantoms');
    }
  } catch (error) {
    console.error('Failed to reset stuck phantoms:', error);
  }
} 