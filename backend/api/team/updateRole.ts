import { ApiRequest, ApiHandler, ErrorResponse } from '../../types/api';
import { Response } from 'express';
import { supabaseDb } from '../../lib/supabase';
import { getUserTeamContext } from './teamContext';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId, role } = req.body;

    if (!userId || !role) {
      res.status(400).json({ error: 'Missing userId or role' });
      return;
    }

    const validRoles = ['admin', 'team_admin', 'member'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role. Must be admin, team_admin, or member' });
      return;
    }

    const { teamId: currentTeamId, role: currentRole } = await getUserTeamContext(req.user.id);
    if (!currentTeamId) {
      res.status(403).json({ error: 'Current user not part of a team' });
      return;
    }

    // Check if current user has permission to update roles
    const allowedRoles = ['admin', 'team_admin', 'super_admin'];
    if (!allowedRoles.includes(String(currentRole || ''))) {
      res.status(403).json({ error: 'Insufficient permissions to update user roles' });
      return;
    }

    // Get target user's data
    const { data: targetUserData, error: targetUserError } = await supabaseDb
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUserData) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    // Resolve target user's team (supports both legacy `users.team_id` and newer `team_members`)
    const { teamId: targetTeamId } = await getUserTeamContext(userId);

    // Ensure target user is in the same team
    if (!targetTeamId || targetTeamId !== currentTeamId) {
      res.status(403).json({ error: 'Cannot update role of user from different team' });
      return;
    }

    // Prevent self-demotion if user is the only admin
    if (userId === req.user.id && role !== 'admin' && String(currentRole || '') === 'admin') {
      // Check if there are other admins in the team
      const { data: teamMembers, error: membersError } = await supabaseDb
        .from('team_members')
        .select('user_id')
        .eq('team_id', currentTeamId);

      if (membersError) throw membersError;

      const memberIds = (teamMembers || [])
        .map((m: any) => m.user_id)
        .filter((id: any) => typeof id === 'string' && id.length > 0);

      const otherAdminsQuery =
        memberIds.length > 0
          ? supabaseDb
              .from('users')
              .select('id')
              .in('id', memberIds)
              .eq('role', 'admin')
              .neq('id', req.user.id)
              .limit(1)
          : ({ data: [], error: null } as any);

      const { data: otherAdmins, error: adminCheckError } = await otherAdminsQuery;

      if (adminCheckError) {
        throw adminCheckError;
      }

      if (!otherAdmins || otherAdmins.length === 0) {
        res.status(400).json({ error: 'Cannot demote yourself - you are the only admin in the team' });
        return;
      }
    }

    // Update the user's role
    const { error: updateError } = await supabaseDb
      .from('users')
      .update({ role })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update user role',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
