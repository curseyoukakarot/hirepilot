import { sniperSupabaseDb } from './supabase';

export type ProviderName = 'airtop' | 'local_playwright';

export type SniperV1Settings = {
  workspace_id: string;
  provider_preference: ProviderName;
  max_actions_per_day: number;
  max_actions_per_hour: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  active_hours_json: {
    days: number[]; // Mon=1 ... Sun=7
    start: string; // HH:mm
    end: string; // HH:mm
    runOnWeekends?: boolean;
  };
  timezone: string;
  safety_mode: boolean;
};

export const DEFAULT_SNIPER_V1_SETTINGS: Omit<SniperV1Settings, 'workspace_id'> = {
  provider_preference: (String(process.env.SNIPER_PROVIDER_DEFAULT || 'airtop').toLowerCase() === 'local_playwright' ? 'local_playwright' : 'airtop'),
  max_actions_per_day: 120,
  max_actions_per_hour: 30,
  min_delay_seconds: 20,
  max_delay_seconds: 60,
  active_hours_json: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', runOnWeekends: false },
  timezone: 'America/Chicago',
  safety_mode: true
};

export async function fetchSniperV1Settings(workspaceId: string): Promise<SniperV1Settings> {
  const { data } = await sniperSupabaseDb
    .from('sniper_settings')
    .select('workspace_id,provider_preference,max_actions_per_day,max_actions_per_hour,min_delay_seconds,max_delay_seconds,active_hours_json,timezone,safety_mode')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const merged = {
    workspace_id: workspaceId,
    ...DEFAULT_SNIPER_V1_SETTINGS,
    ...(data as any)
  } as SniperV1Settings;

  // Clamp sanity
  merged.min_delay_seconds = Math.max(1, Math.min(600, Number(merged.min_delay_seconds || 20)));
  merged.max_delay_seconds = Math.max(merged.min_delay_seconds, Math.min(1800, Number(merged.max_delay_seconds || 60)));
  merged.max_actions_per_hour = Math.max(1, Math.min(500, Number(merged.max_actions_per_hour || 30)));
  merged.max_actions_per_day = Math.max(1, Math.min(5000, Number(merged.max_actions_per_day || 120)));
  return merged;
}

export async function upsertSniperV1Settings(workspaceId: string, patch: Partial<SniperV1Settings>) {
  const row: any = {
    workspace_id: workspaceId,
    provider_preference: patch.provider_preference,
    max_actions_per_day: patch.max_actions_per_day,
    max_actions_per_hour: patch.max_actions_per_hour,
    min_delay_seconds: patch.min_delay_seconds,
    max_delay_seconds: patch.max_delay_seconds,
    active_hours_json: patch.active_hours_json as any,
    timezone: patch.timezone,
    safety_mode: patch.safety_mode
  };
  // Remove undefined so we don't overwrite with nulls accidentally
  Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
  const { data, error } = await sniperSupabaseDb
    .from('sniper_settings')
    .upsert(row, { onConflict: 'workspace_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function isWithinActiveHours(now: Date, settings: SniperV1Settings): boolean {
  const tz = settings.timezone || 'UTC';
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = fmt.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const weekdayStr = String(part('weekday') || '');
  const hour = Number(part('hour') || 0);
  const minute = Number(part('minute') || 0);
  const localMinutes = hour * 60 + minute;

  // Map weekday short → DayNumber (Mon=1..Sun=7)
  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const day = dayMap[weekdayStr] || 0;
  if (!day) return true; // fail-open

  const days = Array.isArray(settings.active_hours_json?.days) ? settings.active_hours_json.days : [1, 2, 3, 4, 5];
  const runOnWeekends = Boolean(settings.active_hours_json?.runOnWeekends);
  const isWeekend = day === 6 || day === 7;
  if (isWeekend && !runOnWeekends) return false;
  if (!days.includes(day)) return false;

  const [sh, sm] = String(settings.active_hours_json?.start || '00:00').split(':').map((x) => Number(x));
  const [eh, em] = String(settings.active_hours_json?.end || '23:59').split(':').map((x) => Number(x));
  const startMin = (Number.isFinite(sh) ? sh : 0) * 60 + (Number.isFinite(sm) ? sm : 0);
  const endMin = (Number.isFinite(eh) ? eh : 23) * 60 + (Number.isFinite(em) ? em : 59);

  // If window crosses midnight, treat as allowed if >= start OR <= end
  if (endMin < startMin) return localMinutes >= startMin || localMinutes <= endMin;
  return localMinutes >= startMin && localMinutes <= endMin;
}

export async function countActionsSince(workspaceId: string, sinceIso: string): Promise<number> {
  const { count } = await sniperSupabaseDb
    .from('sniper_job_items')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'success')
    .in('action_type', ['connect', 'message'])
    .gte('created_at', sinceIso);
  return Number(count || 0);
}


