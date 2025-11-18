import { supabase } from '../../lib/supabase';

const DEFAULT_POLICY = {
  mode: 'handle', // 'share' | 'handle'
  reply_style: { tone:'friendly-direct', length:'short', format:'bullet_then_cta', objection_posture:'clarify_then_value' },
  contact_capture: { ask_phone:false, ask_team_size:true, ask_timeline:true, only_if_missing:true },
  scheduling: { provider:'calendly', event_type:'hirepilot/15min-intro', time_window_days:10, work_hours:'9-5', timezone:'America/Chicago' },

  // ► Sender & assets are intentionally EMPTY by default and must be provided by user policy.
  sender: { behavior:'single', email:'' }, // empty string means "not configured"
  offers: [],
  assets: {
    demo_video_url: '',
    pricing_url: '',
    deck_url: '',
    one_pager_url: ''
  },
  limits: { per_thread_daily:1, quiet_hours_local:'20:00-07:00', max_followups:4 }
};

// For future: load verified senders from your integrations table if you have one.
async function getUserVerifiedSenders(userId: string): Promise<string[]> {
  // Placeholder: implement against your own data model if available
  // e.g., select from connected_senders where user_id = userId and verified = true
  return [];
}

export async function getPolicyForUser(userId: string){
  const { data } = await supabase.from('sales_agent_policies').select('policy').eq('user_id', userId).maybeSingle();
  // Merge but never inject global defaults for sender/assets.
  const merged: any = { ...DEFAULT_POLICY, ...(data?.policy || {}) };

  // Normalize missing nested objects
  merged.sender ||= { behavior:'single', email:'' };
  merged.assets ||= { demo_video_url:'', pricing_url:'', deck_url:'', one_pager_url:'' };

  return merged;
}

/**
 * Finds the effective "from" email for a user according to policy.
 * - If policy.sender.behavior === 'single', require policy.sender.email.
 * - If 'rotate', attempt to pick from user's verified pool; return '' if none.
 */
export async function getEffectiveSenderEmail(userId: string, policy: any): Promise<string> {
  if (policy?.sender?.behavior === 'single') {
    return policy?.sender?.email || '';
  }
  if (policy?.sender?.behavior === 'rotate') {
    const pool = await getUserVerifiedSenders(userId);
    return pool[0] || ''; // you can later implement round-robin
  }
  return '';
}

export function getEffectiveAssets(policy: any){
  const a = policy?.assets || {};
  return {
    demo: a.demo_video_url || '',
    pricing: a.pricing_url || '',
    deck: a.deck_url || '',
    one_pager: a.one_pager_url || ''
  };
}

export async function getResponseStrategyForUser(userId: string){
  // Prefer dedicated settings
  try {
    const { data } = await supabase
      .from('sales_agent_settings')
      .select('response_strategy')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.response_strategy) return data.response_strategy as any;
  } catch {}
  // Fallback: read from policy JSON
  try {
    const { data } = await supabase
      .from('sales_agent_policies')
      .select('policy')
      .eq('user_id', userId)
      .maybeSingle();
    const p = (data?.policy || {}) as any;
    return p.response_strategy || p.reply_strategy || { tone:'professional', priority:'book', instructions:'' };
  } catch {
    return { tone:'professional', priority:'book', instructions:'' };
  }
}
