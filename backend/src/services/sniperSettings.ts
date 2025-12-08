import { supabase } from '../lib/supabase';

export type DayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7; // Mon=1 ... Sun=7

export interface LinkedInSourceSettings {
  profileViewsPerDay: number;
  connectionInvitesPerDay: number;
  messagesPerDay: number;
  inMailsPerDay: number;
  concurrency: number;
  actionsPerMinute: number;
}

export interface SniperSettings {
  globalActive: boolean;
  timezone: string;
  workingHours: {
    start: string; // HH:mm
    end: string; // HH:mm
    days: DayNumber[];
    runOnWeekends: boolean;
  };
  warmup: {
    enabled: boolean;
    weeks: number;
    currentWeek: number;
    speed: number;
  };
  sources: {
    linkedin: LinkedInSourceSettings;
  };
  creditBudget: {
    dailyMax: number;
  };
  safety: {
    maxTouchesPerPerson: number;
    doNotContactDomains: string[];
  };
  primaryJobBoard?: 'linkedin_jobs' | 'ziprecruiter';
  autoCreateTables?: boolean;
  defaultEnrichment?: 'apollo_only' | 'apollo_brightdata';
}

export interface SniperActivityCounters {
  account_id: string;
  date: string;
  linkedin_profile_views_used: number;
  linkedin_connection_invites_used: number;
  linkedin_messages_used: number;
  linkedin_inmails_used: number;
}

export const DEFAULT_SNIPER_SETTINGS: SniperSettings = {
  globalActive: true,
  timezone: 'America/Chicago',
  workingHours: {
    start: '09:00',
    end: '17:00',
    days: [1, 2, 3, 4, 5],
    runOnWeekends: false
  },
  warmup: {
    enabled: true,
    weeks: 3,
    currentWeek: 1,
    speed: 0.4
  },
  sources: {
    linkedin: {
      profileViewsPerDay: 40,
      connectionInvitesPerDay: 30,
      messagesPerDay: 120,
      inMailsPerDay: 10,
      concurrency: 2,
      actionsPerMinute: 2
    }
  },
  creditBudget: {
    dailyMax: 200
  },
  safety: {
    maxTouchesPerPerson: 3,
    doNotContactDomains: []
  },
  primaryJobBoard: 'linkedin_jobs',
  autoCreateTables: false,
  defaultEnrichment: 'apollo_only'
};

export async function fetchSniperSettings(accountId: string | null | undefined): Promise<SniperSettings> {
  if (!accountId) return DEFAULT_SNIPER_SETTINGS;
  const { data, error } = await supabase
    .from('sniper_settings')
    .select('settings')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error || !data?.settings) return DEFAULT_SNIPER_SETTINGS;
  return { ...DEFAULT_SNIPER_SETTINGS, ...(data.settings as SniperSettings) };
}

export function formatDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export async function getDailyCounters(accountId: string, dateKey: string): Promise<SniperActivityCounters> {
  const { data } = await supabase
    .from('sniper_activity_counters')
    .select('*')
    .eq('account_id', accountId)
    .eq('date', dateKey)
    .maybeSingle();

  if (data) return data as SniperActivityCounters;

  const blank: SniperActivityCounters = {
    account_id: accountId,
    date: dateKey,
    linkedin_profile_views_used: 0,
    linkedin_connection_invites_used: 0,
    linkedin_messages_used: 0,
    linkedin_inmails_used: 0
  };

  await supabase
    .from('sniper_activity_counters')
    .insert(blank);

  return blank;
}

export async function saveCounters(counters: SniperActivityCounters) {
  await supabase
    .from('sniper_activity_counters')
    .upsert(counters, { onConflict: 'account_id,date' });
}


