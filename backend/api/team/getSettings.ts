import { ApiRequest, ApiHandler, ErrorResponse } from '../../types/api';
import { Response } from 'express';
import { supabaseDb } from '../../lib/supabase';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's team_id
    const { data: userData, error: userError } = await supabaseDb
      .from('users')
      .select('team_id')
      .eq('id', req.user.id)
      .single();

    if (userError || !userData?.team_id) {
      res.status(404).json({ error: 'User not part of a team' });
      return;
    }

    // Get team settings
    const { data: settings, error: settingsError } = await supabaseDb
      .from('team_settings')
      .select('share_leads, share_candidates, allow_team_editing, team_admin_view_pool')
      .eq('team_id', userData.team_id)
      .single();

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
