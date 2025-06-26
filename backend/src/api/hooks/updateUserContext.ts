import { supabase } from '../../lib/supabase';

export async function updateREXContext({
  supabase_user_id,
  slack_user_id,
  slack_user_email,
  latest_campaign_id
}: {
  supabase_user_id?: string;
  slack_user_id?: string;
  slack_user_email?: string;
  latest_campaign_id?: string;
}) {
  if (!supabase_user_id && !slack_user_id && !slack_user_email) return;

  await supabase
    .from('rex_user_context')
    .upsert(
      {
        supabase_user_id,
        slack_user_id,
        slack_user_email,
        latest_campaign_id,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'supabase_user_id' }
    );
} 