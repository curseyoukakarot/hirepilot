import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { Response } from 'express';
import { supabaseDb } from '../lib/supabase';

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
      .select('share_leads, share_candidates')
      .eq('team_id', userData.team_id)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      throw settingsError;
    }

    // Return settings or defaults if no settings exist
    const result = {
      share_leads: settings?.share_leads || false,
      share_candidates: settings?.share_candidates || false
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
