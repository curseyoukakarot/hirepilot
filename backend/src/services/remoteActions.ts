import { supabaseDb } from '../lib/supabase';

const REMOTE_LINKEDIN_ALLOWED_PLANS = ['pro', 'team', 'business', 'scale', 'enterprise'];

export interface RemoteActionEligibility {
  allowed: boolean;
  reason?: string;
  plan?: string | null;
}

export async function canUseRemoteLinkedInActions(userId: string): Promise<RemoteActionEligibility> {
  if (!userId) {
    return { allowed: false, reason: 'Missing user ID' };
  }

  try {
    const [{ data: userRecord }, { data: settingsRecord }] = await Promise.all([
      supabaseDb.from('users').select('plan').eq('id', userId).maybeSingle(),
      supabaseDb.from('user_settings').select('use_remote_linkedin_actions').eq('user_id', userId).maybeSingle()
    ]);

    const plan = userRecord?.plan?.toLowerCase?.() || null;
    const planAllowed = plan ? REMOTE_LINKEDIN_ALLOWED_PLANS.includes(plan) : false;

    if (!planAllowed) {
      return {
        allowed: false,
        plan,
        reason: 'Remote LinkedIn actions require a Pro or Team plan.'
      };
    }

    if (!settingsRecord?.use_remote_linkedin_actions) {
      return {
        allowed: false,
        plan,
        reason: 'Enable remote LinkedIn actions under Settings → LinkedIn.'
      };
    }

    return { allowed: true, plan };
  } catch (err) {
    console.error('[RemoteActions] Eligibility check failed', err);
    return {
      allowed: false,
      reason: 'Unable to verify remote action eligibility right now.'
    };
  }
}

