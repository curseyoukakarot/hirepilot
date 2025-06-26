import { supabase } from './supabase';

export interface REXContextParams {
  user_id?: string;
  slack_user_id?: string;
  slack_user_email?: string;
}

export interface REXContextResult {
  user_id: string;
  campaign_id: string | null;
}

/**
 * Resolve the correct supabase_user_id and the latest campaign_id for a user.
 * Works with either:
 *  • user_id (supabase UUID) coming from the web-app session
 *  • slack_user_id or slack_user_email coming from Slack events
 */
export async function resolveREXContext({
  user_id,
  slack_user_id,
  slack_user_email
}: REXContextParams): Promise<REXContextResult> {
  // Case 1: web-app supplied the auth ID directly
  if (user_id) {
    const { data, error } = await supabase
      .from('rex_user_context')
      .select('latest_campaign_id')
      .eq('supabase_user_id', user_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found – treat same as null
      throw error;
    }
    return { user_id, campaign_id: data?.latest_campaign_id ?? null };
  }

  // Case 2: resolve via Slack identity
  if (slack_user_id || slack_user_email) {
    const orFilterParts: string[] = [];
    if (slack_user_id) orFilterParts.push(`slack_user_id.eq.${slack_user_id}`);
    if (slack_user_email) orFilterParts.push(`slack_user_email.eq.${slack_user_email}`);

    const { data, error } = await supabase
      .from('rex_user_context')
      .select('supabase_user_id, latest_campaign_id')
      .or(orFilterParts.join(','))
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (data?.supabase_user_id) {
      return {
        user_id: data.supabase_user_id,
        campaign_id: data.latest_campaign_id ?? null
      };
    }
  }

  throw new Error('Unable to resolve REX context for user.');
} 