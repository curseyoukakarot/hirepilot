import { ApiRequest, ApiHandler, ErrorResponse } from '../../types/api';
import { Response } from 'express';
import { supabaseDb } from '../../lib/supabase';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { shareLeads, shareCandidates, allowTeamEditing, adminViewTeamPool } = req.body;

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

    // Determine role-based permissions
    const normalizedRole = String(userData.role || '').toLowerCase();
    const adminRoles = ['admin', 'team_admin', 'team_admins', 'super_admin', 'superadmin'];
    const memberRoles = [...adminRoles, 'member', 'recruitpro', 'recruit_pro'];
    const isAdminRole = adminRoles.includes(normalizedRole);
    const canUpdateSharing = memberRoles.includes(normalizedRole);

    if (!canUpdateSharing) {
      res.status(403).json({ error: 'Insufficient permissions to update team settings' });
      return;
    }

    // Build update payload (write both keys for compatibility with mixed schema)
    const updateData: any = {
      team_id: userData.team_id,
      team_admin_id: req.user.id,
      updated_at: new Date().toISOString()
    };

    if (shareLeads !== undefined) updateData.share_leads = shareLeads;
    if (shareCandidates !== undefined) updateData.share_candidates = shareCandidates;
    if (allowTeamEditing !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can change shared editing settings' });
        return;
      }
      updateData.allow_team_editing = allowTeamEditing;
    } else if (shareLeads === false) {
      updateData.allow_team_editing = false;
    }

    if (adminViewTeamPool !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can control team visibility' });
        return;
      }
      updateData.team_admin_view_pool = !!adminViewTeamPool;
    }

    // Try upsert using newer schema (PK team_admin_id). If the constraint/column
    // doesn't exist, fall back to legacy schema (PK team_id).
    let { error: updateError } = await supabaseDb
      .from('team_settings')
      .upsert(updateData, { onConflict: 'team_admin_id' });
    if (updateError && (updateError.code === '42P10' || updateError.code === '42703')) {
      // 42P10: no matching unique/exclusion constraint; 42703: column does not exist
      const retry = await supabaseDb
        .from('team_settings')
        .upsert(updateData, { onConflict: 'team_id' });
      updateError = retry.error as any;
    }

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
