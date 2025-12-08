import { supabase as supabaseDb } from '../lib/supabase';

const REMOTE_LINKEDIN_ALLOWED_PLANS = ['pro', 'team', 'business', 'scale', 'enterprise'];

export type LinkedinEngineMode = 'local_browser' | 'brightdata_cloud';

interface UserSettingsRow {
  linkedin_engine_mode?: string | null;
  use_remote_linkedin_actions?: boolean | null;
}

export interface RemoteActionEligibility {
  allowed: boolean;
  reason?: string;
  plan?: string | null;
  engineMode?: LinkedinEngineMode;
}

function normalizeEngineMode(raw?: string | null, fallbackCloud = false): LinkedinEngineMode {
  if (raw === 'brightdata_cloud') return 'brightdata_cloud';
  if (raw === 'local_browser') return 'local_browser';
  return fallbackCloud ? 'brightdata_cloud' : 'local_browser';
}

export async function getLinkedinEngineMode(userId: string): Promise<LinkedinEngineMode> {
  if (!userId) return 'local_browser';

  try {
    const { data } = await supabaseDb
      .from('user_settings')
      .select('linkedin_engine_mode,use_remote_linkedin_actions')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return 'local_browser';
    const fallbackCloud = Boolean(data.use_remote_linkedin_actions);
    return normalizeEngineMode(data.linkedin_engine_mode, fallbackCloud);
  } catch (err) {
    console.warn('[RemoteActions] Failed to load linkedin_engine_mode', err);
    return 'local_browser';
  }
}

export function isCloudEngine(mode: LinkedinEngineMode): boolean {
  return mode === 'brightdata_cloud';
}

export function isPlanEligibleForCloud(plan?: string | null): boolean {
  if (!plan) return false;
  return REMOTE_LINKEDIN_ALLOWED_PLANS.includes(plan.toLowerCase());
}

export async function canUseRemoteLinkedInActions(userId: string): Promise<RemoteActionEligibility> {
  if (!userId) {
    return { allowed: false, reason: 'Missing user ID', engineMode: 'local_browser' };
  }

  try {
    const [{ data: userRecord }, { data: settingsRecord }] = await Promise.all([
      supabaseDb.from('users').select('plan').eq('id', userId).maybeSingle(),
      supabaseDb
        .from('user_settings')
        .select('linkedin_engine_mode,use_remote_linkedin_actions')
        .eq('user_id', userId)
        .maybeSingle()
    ]);

    const plan = userRecord?.plan?.toLowerCase?.() || null;
    const planAllowed = isPlanEligibleForCloud(plan);
    const engineMode = normalizeEngineMode(settingsRecord?.linkedin_engine_mode, Boolean(settingsRecord?.use_remote_linkedin_actions));

    if (!planAllowed) {
      return {
        allowed: false,
        plan,
        engineMode,
        reason: 'Remote LinkedIn actions require a Pro or Team plan.'
      };
    }

    if (!isCloudEngine(engineMode)) {
      return {
        allowed: false,
        plan,
        engineMode,
        reason: 'Switch to Cloud Engine (Bright Data) to run remote LinkedIn actions.'
      };
    }

    return { allowed: true, plan, engineMode };
  } catch (err) {
    console.error('[RemoteActions] Eligibility check failed', err);
    return {
      allowed: false,
      engineMode: 'local_browser',
      reason: 'Unable to verify remote action eligibility right now.'
    };
  }
}

