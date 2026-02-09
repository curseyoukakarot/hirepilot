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
  outsideActiveHours: boolean;
};

function secondsUntil(msUntil: number): number {
  if (!Number.isFinite(msUntil)) return 0;
  return Math.max(1, Math.ceil(msUntil / 1000));
}

const ACTIVE_HOURS_GRACE_MINUTES = 60;
const ACTIONS_PER_HOUR_GRACE = 2;
const ACTIONS_PER_DAY_GRACE = 5;

function isWithinActiveHoursWithGrace(now: Date, settings: Awaited<ReturnType<typeof fetchSniperV1Settings>>): boolean {
  if (isWithinActiveHours(now, settings)) return true;
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

  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const day = dayMap[weekdayStr] || 0;
  if (!day) return false;

  const days = Array.isArray(settings.active_hours_json?.days) ? settings.active_hours_json.days : [1, 2, 3, 4, 5];
  const runOnWeekends = Boolean(settings.active_hours_json?.runOnWeekends);
  const isWeekend = day === 6 || day === 7;
  if (isWeekend && !runOnWeekends) return true;
  if (!days.includes(day)) return true;

  const [sh, sm] = String(settings.active_hours_json?.start || '00:00').split(':').map((x) => Number(x));
  const [eh, em] = String(settings.active_hours_json?.end || '23:59').split(':').map((x) => Number(x));
  const startMin = (Number.isFinite(sh) ? sh : 0) * 60 + (Number.isFinite(sm) ? sm : 0);
  const endMin = (Number.isFinite(eh) ? eh : 23) * 60 + (Number.isFinite(em) ? em : 59);
  const grace = ACTIVE_HOURS_GRACE_MINUTES;

  if (endMin < startMin) {
    return localMinutes >= (startMin - grace) || localMinutes <= (endMin + grace);
  }
  return localMinutes >= (startMin - grace) && localMinutes <= (endMin + grace);
}

export async function canAttemptLinkedinConnect(args: { workspaceId: string; userId: string; respectActiveHours?: boolean }): Promise<AttemptResult> {
  const settings = await fetchSniperV1Settings(args.workspaceId);

  if (!settings.cloud_engine_enabled) {
    return { ok: false, cooldownSeconds: 0, reason: 'cloud_engine_disabled', remaining: 0, limit: settings.max_connects_per_day, settings, outsideActiveHours: false };
  }

  const outsideActiveHours = !isWithinActiveHoursWithGrace(new Date(), settings);
  const respectActiveHours = args.respectActiveHours ?? true;
  if (outsideActiveHours && respectActiveHours) {
    return { ok: false, cooldownSeconds: 15 * 60, reason: 'outside_active_hours', remaining: 0, limit: settings.max_connects_per_day, settings, outsideActiveHours };
  }

  const usage = await getUsageSnapshot({ userId: args.userId, workspaceId: args.workspaceId, settings });
  if (isCooldownActive(usage.cooldown_until)) {
    const cooldownSeconds = secondsUntil(new Date(usage.cooldown_until as string).getTime() - Date.now());
    return { ok: false, cooldownSeconds, reason: 'cooldown_active', remaining: 0, limit: settings.max_connects_per_day, settings, outsideActiveHours };
  }

  // Hour/day action guardrails (shared across connect/message)
  const hourSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const daySince = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const usedHour = await countActionsSince(args.workspaceId, hourSince);
  const usedDay = await countActionsSince(args.workspaceId, daySince);
  if (usedHour >= settings.max_actions_per_hour + ACTIONS_PER_HOUR_GRACE) {
    return { ok: false, cooldownSeconds: 60 * 60, reason: 'throttled_actions_per_hour', remaining: 0, limit: settings.max_connects_per_day, settings, outsideActiveHours };
  }
  if (usedDay >= settings.max_actions_per_day + ACTIONS_PER_DAY_GRACE) {
    return { ok: false, cooldownSeconds: 60 * 60, reason: 'throttled_actions_per_day', remaining: 0, limit: settings.max_connects_per_day, settings, outsideActiveHours };
  }

  const remainingUser = Math.max(0, settings.max_connects_per_day - usage.user_connects);
  const remainingWorkspace = Math.max(0, settings.max_workspace_connects_per_day - usage.workspace_connects);
  const remaining = Math.min(remainingUser, remainingWorkspace);
  if (remaining <= 0) {
    const reason = remainingUser <= 0 ? 'daily_connect_limit_exceeded' : 'workspace_daily_connect_limit_exceeded';
    return { ok: false, cooldownSeconds: 60 * 60, reason, remaining: 0, limit: settings.max_connects_per_day, settings, outsideActiveHours };
  }

  return { ok: true, cooldownSeconds: 0, reason: null, remaining, limit: settings.max_connects_per_day, settings, outsideActiveHours };
}
