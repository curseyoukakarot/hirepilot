import { fetchSniperV1Settings, isWithinActiveHours } from './settings';
import { countActionsSince } from './settings';
import { getUsageSnapshot, isCooldownActive } from './throttle';

type AttemptResult = {
  ok: boolean;
  cooldownSeconds: number;
  reason: string | null;
  remaining: number;
  limit: number;
  settings: Awaited<ReturnType<typeof fetchSniperV1Settings>>;
};

function secondsUntil(msUntil: number): number {
  if (!Number.isFinite(msUntil)) return 0;
  return Math.max(1, Math.ceil(msUntil / 1000));
}

export async function canAttemptLinkedinConnect(args: { workspaceId: string; userId: string }): Promise<AttemptResult> {
  const settings = await fetchSniperV1Settings(args.workspaceId);

  if (!settings.cloud_engine_enabled) {
    return { ok: false, cooldownSeconds: 0, reason: 'cloud_engine_disabled', remaining: 0, limit: settings.max_connects_per_day, settings };
  }

  if (!isWithinActiveHours(new Date(), settings)) {
    return { ok: false, cooldownSeconds: 15 * 60, reason: 'outside_active_hours', remaining: 0, limit: settings.max_connects_per_day, settings };
  }

  const usage = await getUsageSnapshot({ userId: args.userId, workspaceId: args.workspaceId, settings });
  if (isCooldownActive(usage.cooldown_until)) {
    const cooldownSeconds = secondsUntil(new Date(usage.cooldown_until as string).getTime() - Date.now());
    return { ok: false, cooldownSeconds, reason: 'cooldown_active', remaining: 0, limit: settings.max_connects_per_day, settings };
  }

  // Hour/day action guardrails (shared across connect/message)
  const hourSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const daySince = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const usedHour = await countActionsSince(args.workspaceId, hourSince);
  const usedDay = await countActionsSince(args.workspaceId, daySince);
  if (usedHour >= settings.max_actions_per_hour) {
    return { ok: false, cooldownSeconds: 60 * 60, reason: 'throttled_actions_per_hour', remaining: 0, limit: settings.max_connects_per_day, settings };
  }
  if (usedDay >= settings.max_actions_per_day) {
    return { ok: false, cooldownSeconds: 60 * 60, reason: 'throttled_actions_per_day', remaining: 0, limit: settings.max_connects_per_day, settings };
  }

  const remainingUser = Math.max(0, settings.max_connects_per_day - usage.user_connects);
  const remainingWorkspace = Math.max(0, settings.max_workspace_connects_per_day - usage.workspace_connects);
  const remaining = Math.min(remainingUser, remainingWorkspace);
  if (remaining <= 0) {
    const reason = remainingUser <= 0 ? 'daily_connect_limit_exceeded' : 'workspace_daily_connect_limit_exceeded';
    return { ok: false, cooldownSeconds: 60 * 60, reason, remaining: 0, limit: settings.max_connects_per_day, settings };
  }

  return { ok: true, cooldownSeconds: 0, reason: null, remaining, limit: settings.max_connects_per_day, settings };
}
