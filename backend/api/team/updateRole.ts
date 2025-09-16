import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { Response } from 'express';
import { supabaseDb } from '../lib/supabase';

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

    // Get current user's role and team_id
    const { data: currentUserData, error: currentUserError } = await supabaseDb
      .from('users')
      .select('team_id, role')
      .eq('id', req.user.id)
      .single();

    if (currentUserError || !currentUserData?.team_id) {
      res.status(404).json({ error: 'Current user not part of a team' });
      return;
    }

    // Check if current user has permission to update roles
    const allowedRoles = ['admin', 'team_admin', 'super_admin'];
    if (!allowedRoles.includes(currentUserData.role)) {
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

    // Ensure target user is in the same team
    if (targetUserData.team_id !== currentUserData.team_id) {
      res.status(403).json({ error: 'Cannot update role of user from different team' });
      return;
    }

    // Prevent self-demotion if user is the only admin
    if (userId === req.user.id && role !== 'admin' && currentUserData.role === 'admin') {
      // Check if there are other admins in the team
      const { data: otherAdmins, error: adminCheckError } = await supabaseDb
        .from('users')
        .select('id')
        .eq('team_id', currentUserData.team_id)
        .eq('role', 'admin')
        .neq('id', req.user.id)
        .limit(1);

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
