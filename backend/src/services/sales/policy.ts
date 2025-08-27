import { supabase } from '../../lib/supabase';

const DEFAULT_POLICY = {
  mode: 'handle',
  reply_style: { tone:'friendly-direct', length:'short', format:'bullet_then_cta', objection_posture:'clarify_then_value' },
  contact_capture: { ask_phone:false, ask_team_size:true, ask_timeline:true, only_if_missing:true },
  scheduling: { provider:'calendly', event_type:'hirepilot/15min-intro', time_window_days:10, work_hours:'9-5', timezone:'America/Chicago' },
  sender: { behavior:'single', email: process.env.DEFAULT_SENDER || '' },
  offers: [],
  assets: { demo_video_url: process.env.DEFAULT_DEMO_URL, pricing_url: process.env.DEFAULT_PRICING_URL },
  limits: { per_thread_daily:1, quiet_hours_local:'20:00-07:00', max_followups:4 }
};

export async function getPolicyForUser(userId: string){
  const { data } = await supabase.from('sales_agent_policies').select('policy').eq('user_id', userId).maybeSingle();
  return { ...DEFAULT_POLICY, ...(data?.policy || {}) };
}
