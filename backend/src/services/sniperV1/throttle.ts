import { sniperSupabaseDb } from './supabase';
import type { SniperV1Settings } from './settings';

export type SniperActionType = 'connect' | 'message' | 'profile_visit' | 'job_page';

export function dayStringInTimezone(now: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now);
}

function limitsFor(settings: SniperV1Settings) {
  return {
    userConnects: settings.max_connects_per_day,
    userMessages: settings.max_messages_per_day,
    userProfiles: settings.max_page_interactions_per_day,
    userJobPages: settings.max_page_interactions_per_day,
    workspaceConnects: settings.max_workspace_connects_per_day,
    workspaceMessages: settings.max_workspace_messages_per_day,
    workspaceProfiles: settings.max_workspace_page_interactions_per_day,
    workspaceJobPages: settings.max_workspace_page_interactions_per_day
  };
}

type UsageRow = {
  user_connects: number;
  user_messages: number;
  user_profiles: number;
  user_job_pages: number;
  workspace_connects: number;
  workspace_messages: number;
  workspace_profiles: number;
  workspace_job_pages: number;
  cooldown_until: string | null;
};

async function callReserve(args: {
  userId: string;
  workspaceId: string;
  day: string;
  connectDelta?: number;
  messageDelta?: number;
  profileDelta?: number;
  jobPageDelta?: number;
  settings: SniperV1Settings;
  cooldownUntil?: string | null;
}): Promise<UsageRow> {
  const limits = limitsFor(args.settings);
  const { data, error } = await sniperSupabaseDb.rpc('sniper_reserve_action_usage', {
    p_user_id: args.userId,
    p_workspace_id: args.workspaceId,
    p_day: args.day,
    p_connect_delta: args.connectDelta || 0,
    p_message_delta: args.messageDelta || 0,
    p_profile_delta: args.profileDelta || 0,
    p_job_page_delta: args.jobPageDelta || 0,
    p_connect_limit: limits.userConnects,
    p_message_limit: limits.userMessages,
    p_profile_limit: limits.userProfiles,
    p_job_page_limit: limits.userJobPages,
    p_workspace_connect_limit: limits.workspaceConnects,
    p_workspace_message_limit: limits.workspaceMessages,
    p_workspace_profile_limit: limits.workspaceProfiles,
    p_workspace_job_page_limit: limits.workspaceJobPages,
    p_cooldown_until: args.cooldownUntil || null
  } as any);
  if (error) throw error;
  const row: any = Array.isArray(data) ? data[0] : data;
  return {
    user_connects: Number(row?.user_connects || 0),
    user_messages: Number(row?.user_messages || 0),
    user_profiles: Number(row?.user_profiles || 0),
    user_job_pages: Number(row?.user_job_pages || 0),
    workspace_connects: Number(row?.workspace_connects || 0),
    workspace_messages: Number(row?.workspace_messages || 0),
    workspace_profiles: Number(row?.workspace_profiles || 0),
    workspace_job_pages: Number(row?.workspace_job_pages || 0),
    cooldown_until: row?.cooldown_until ? String(row.cooldown_until) : null
  };
}

export async function getUsageSnapshot(args: {
  userId: string;
  workspaceId: string;
  settings: SniperV1Settings;
}): Promise<UsageRow> {
  const tz = args.settings.timezone || 'UTC';
  const day = dayStringInTimezone(new Date(), tz);
  return await callReserve({ ...args, day });
}

export async function recordActionUsage(args: {
  userId: string;
  workspaceId: string;
  settings: SniperV1Settings;
  actionType: SniperActionType;
}): Promise<UsageRow> {
  const tz = args.settings.timezone || 'UTC';
  const day = dayStringInTimezone(new Date(), tz);
  const deltas = {
    connectDelta: args.actionType === 'connect' ? 1 : 0,
    messageDelta: args.actionType === 'message' ? 1 : 0,
    profileDelta: args.actionType === 'profile_visit' || args.actionType === 'connect' || args.actionType === 'message' ? 1 : 0,
    jobPageDelta: args.actionType === 'job_page' ? 1 : 0
  };
  return await callReserve({ ...args, ...deltas, day });
}

export async function applyCooldown(args: {
  userId: string;
  workspaceId: string;
  settings: SniperV1Settings;
  cooldownUntil: string;
}): Promise<UsageRow> {
  const tz = args.settings.timezone || 'UTC';
  const day = dayStringInTimezone(new Date(), tz);
  return await callReserve({ ...args, day, cooldownUntil: args.cooldownUntil });
}

export function isCooldownActive(cooldownUntil: string | null): boolean {
  if (!cooldownUntil) return false;
  const ts = new Date(cooldownUntil).getTime();
  return Number.isFinite(ts) && ts > Date.now();
}

