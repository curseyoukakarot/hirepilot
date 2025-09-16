import { ApiRequest, ApiHandler, ErrorResponse } from '../../types/api';
import { Response } from 'express';
import { supabaseDb } from '../../lib/supabase';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'Missing userId' });
      return;
    }

    // Check if current user is super_admin
    const { data: currentUser, error: currentUserError } = await supabaseDb
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (currentUserError || !currentUser) {
      console.log('Current user error:', currentUserError);
      res.status(404).json({ error: 'Current user not found' });
      return;
    }

    console.log('Current user role:', currentUser.role);
    console.log('User ID:', req.user.id);

    if (currentUser.role !== 'super_admin') {
      res.status(403).json({ 
        error: 'Insufficient permissions. Super admin access required.',
        debug: {
          actualRole: currentUser.role,
          expectedRole: 'super_admin',
          userId: req.user.id
        }
      });
      return;
    }

    // Get target user details
    const { data: targetUser, error: targetUserError } = await supabaseDb
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    // Generate magic link for session impersonation
    const { data, error } = await supabaseDb.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`
      }
    });

    if (error) {
      console.error('Error generating impersonation link:', error);
      res.status(500).json({ error: 'Failed to generate impersonation link' });
      return;
    }

    // Log the impersonation action for audit purposes
    console.log(`[SUPER ADMIN IMPERSONATION] ${req.user.id} is impersonating ${targetUser.email} (${targetUser.id})`);

    res.status(200).json({
      success: true,
      action_link: data.properties?.action_link,
      target_user: {
        id: targetUser.id,
        email: targetUser.email,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error('Error impersonating user:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to impersonate user',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
