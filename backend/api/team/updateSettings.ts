import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { Response } from 'express';
import { supabaseDb } from '../lib/supabase';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { shareLeads, shareCandidates } = req.body;

    // Get user's role and team_id
    const { data: userData, error: userError } = await supabaseDb
      .from('users')
      .select('team_id, role')
      .eq('id', req.user.id)
      .single();

    if (userError || !userData?.team_id) {
      res.status(404).json({ error: 'User not part of a team' });
      return;
    }

    // Check if user has permission to update team settings
    const allowedRoles = ['admin', 'team_admin', 'super_admin'];
    if (!allowedRoles.includes(userData.role)) {
      res.status(403).json({ error: 'Insufficient permissions to update team settings' });
      return;
    }

    // Update team settings
    const updateData: any = {
      team_id: userData.team_id
    };

    if (shareLeads !== undefined) {
      updateData.share_leads = shareLeads;
    }
    if (shareCandidates !== undefined) {
      updateData.share_candidates = shareCandidates;
    }

    const { error: updateError } = await supabaseDb
      .from('team_settings')
      .upsert(updateData, { onConflict: 'team_id' });

    if (updateError) {
      throw updateError;
    }

    // Update all existing records to match the new settings
    if (shareLeads !== undefined) {
      await supabaseDb
        .from('leads')
        .update({ shared: shareLeads })
        .eq('user_id', req.user.id);
    }

    if (shareCandidates !== undefined) {
      await supabaseDb
        .from('candidates')
        .update({ shared: shareCandidates })
        .eq('user_id', req.user.id);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating team settings:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update team settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
