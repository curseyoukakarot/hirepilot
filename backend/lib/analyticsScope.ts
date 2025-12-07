import { supabaseDb } from './supabase';

const ADMIN_ROLE_SET = new Set(['admin', 'team_admin', 'team_admins', 'super_admin', 'superadmin']);

type RawTeamSettings = {
  share_analytics: boolean;
  analytics_admin_view_enabled: boolean;
  analytics_admin_view_user_id: string | null;
  analytics_team_pool: boolean;
};

const DEFAULT_ANALYTICS_SETTINGS: RawTeamSettings = {
  share_analytics: false,
  analytics_admin_view_enabled: false,
  analytics_admin_view_user_id: null,
  analytics_team_pool: false
};

export type AnalyticsScope =
  | { allowed: false; code: string }
  | {
      allowed: true;
      targetUserIds: string[];
      viewerId: string;
      isAdmin: boolean;
      teamId?: string | null;
      settings: RawTeamSettings;
      scopeType: 'self' | 'member' | 'team';
    };

async function fetchTeamSettings(teamId?: string | null): Promise<RawTeamSettings> {
  if (!teamId) return DEFAULT_ANALYTICS_SETTINGS;
  const { data } = await supabaseDb
    .from('team_settings')
    .select('share_analytics, analytics_admin_view_enabled, analytics_admin_view_user_id, analytics_team_pool')
    .eq('team_id', teamId)
    .maybeSingle();
  return {
    share_analytics: !!data?.share_analytics,
    analytics_admin_view_enabled: !!data?.analytics_admin_view_enabled,
    analytics_admin_view_user_id: data?.analytics_admin_view_user_id || null,
    analytics_team_pool: !!data?.analytics_team_pool
  };
}

export async function resolveAnalyticsScope(viewerId?: string | null): Promise<AnalyticsScope> {
  if (!viewerId) return { allowed: false, code: 'missing_viewer' };

  const { data: viewer, error } = await supabaseDb
    .from('users')
    .select('id, role, team_id')
    .eq('id', viewerId)
    .maybeSingle();

  if (error || !viewer) {
    return { allowed: false, code: 'viewer_not_found' };
  }

  const settings = await fetchTeamSettings(viewer.team_id || null);
  const role = String(viewer.role || '').toLowerCase();
  const isAdmin = ADMIN_ROLE_SET.has(role);

  if (!isAdmin && !settings.share_analytics) {
    return { allowed: false, code: 'analytics_sharing_disabled' };
  }

  let targetUserIds: string[] = [viewer.id];
  let scopeType: 'self' | 'member' | 'team' = 'self';

  if (isAdmin) {
    if (settings.analytics_team_pool && viewer.team_id) {
      const { data: teamUsers } = await supabaseDb.from('users').select('id').eq('team_id', viewer.team_id);
      const ids = (teamUsers || []).map((u: any) => u.id).filter(Boolean);
      if (ids.length) {
        targetUserIds = ids;
        scopeType = 'team';
      }
    } else if (settings.analytics_admin_view_enabled && settings.analytics_admin_view_user_id) {
      targetUserIds = [settings.analytics_admin_view_user_id];
      scopeType = 'member';
    }
  }

  return {
    allowed: true,
    targetUserIds,
    viewerId: viewer.id,
    isAdmin,
    teamId: viewer.team_id || null,
    settings,
    scopeType
  };
}

