import { ApiRequest, ApiHandler, ErrorResponse } from '../../types/api';
import { Response } from 'express';
import { supabaseDb } from '../../lib/supabase';
import { getUserTeamContext } from './teamContext';

async function resolveTeamAdminId(params: { teamId: string | null; requesterId: string; requesterRole: string | null }) {
  const normalized = String(params.requesterRole || '').toLowerCase();
  if (['admin', 'team_admin', 'super_admin', 'superadmin'].includes(normalized)) return params.requesterId;
  if (!params.teamId) return params.requesterId;
  try {
    const { data } = await supabaseDb
      .from('users')
      .select('id')
      .eq('team_id', params.teamId)
      .in('role', ['admin', 'team_admin', 'super_admin', 'superadmin'] as any)
      .limit(1)
      .maybeSingle();
    return (data as any)?.id || params.requesterId;
  } catch {
    return params.requesterId;
  }
}

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { teamId, role } = await getUserTeamContext(req.user.id);
    if (!teamId) {
      res.status(403).json({ error: 'User not part of a team' });
      return;
    }

    const teamAdminId = await resolveTeamAdminId({
      teamId,
      requesterId: req.user.id,
      requesterRole: String(role || req.user.role || '')
    });

    // Get team settings (support both schemas: keyed by team_id OR team_admin_id)
    let settings: any = null;
    let settingsError: any = null;
    const attemptByTeamId = await supabaseDb
      .from('team_settings')
      .select(
        'share_leads, share_candidates, allow_team_editing, team_admin_view_pool, share_analytics, analytics_admin_view_enabled, analytics_admin_view_user_id, analytics_team_pool'
      )
      .eq('team_id', teamId)
      .maybeSingle();
    settings = attemptByTeamId.data as any;
    settingsError = attemptByTeamId.error as any;
    if (settingsError && (settingsError.code === '42703' || String(settingsError.message || '').includes('team_id'))) {
      // team_id column doesn't exist → try admin-scoped schema
      const attemptByAdmin = await supabaseDb
        .from('team_settings')
        .select(
          'share_leads, share_candidates, allow_team_editing, team_admin_view_pool, share_analytics, analytics_admin_view_enabled, analytics_admin_view_user_id, analytics_team_pool'
        )
        .eq('team_admin_id', teamAdminId)
        .maybeSingle();
      settings = attemptByAdmin.data as any;
      settingsError = attemptByAdmin.error as any;
    }

    if (settingsError && settingsError.code !== 'PGRST116') {
      throw settingsError;
    }

    // Return settings or defaults if no settings exist
    const result = {
      share_leads: settings?.share_leads || false,
      share_candidates: settings?.share_candidates || false,
      allow_team_editing: settings?.allow_team_editing || false,
      team_admin_view_pool:
        settings?.team_admin_view_pool === undefined || settings?.team_admin_view_pool === null
          ? true
          : settings?.team_admin_view_pool,
      share_analytics: settings?.share_analytics || false,
      analytics_admin_view_enabled: settings?.analytics_admin_view_enabled || false,
      analytics_admin_view_user_id: settings?.analytics_admin_view_user_id || null,
      analytics_team_pool: settings?.analytics_team_pool || false
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching team settings:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch team settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
