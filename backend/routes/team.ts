import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { sendTeamInviteEmail } from '../services/emailService';
import { sendTeamNotify } from '../lib/notifications';

const router = Router();

interface TeamInviteRequest {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  role: 'admin' | 'member' | 'viewer';
}

interface AuthenticatedRequest extends Request {
  auth?: {
    user?: User;
  };
}

// Test endpoint to verify Supabase connection
router.get('/test-connection', async (req: Request, res: Response) => {
  try {
    console.log('Testing Supabase connection...');
    
    // Log environment configuration
    console.log('Environment check:', {
      hasUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      frontendUrl: process.env.FRONTEND_URL
    });
    
    // Try a simple query
    const { data, error } = await supabase
      .from('team_invites')
      .select('count')
      .limit(1);
      
    if (error) {
      console.error('Supabase connection test failed:', error);
      return res.status(500).json({ message: 'Failed to connect to Supabase', error });
    }
    
    return res.json({ message: 'Supabase connection successful', data });
  } catch (error) {
    console.error('Test connection error:', error);
    return res.status(500).json({ message: 'Connection test failed', error });
  }
});

// POST /api/team/invite
router.post('/invite', async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Starting invite process with request:', {
      body: req.body,
      user: req.auth?.user?.id,
      headers: req.headers,
      supabaseConfig: {
        hasUrl: !!process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });

    if (!req.auth?.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { firstName, lastName, email, company, role } = req.body as TeamInviteRequest;
    const currentUser = req.auth?.user;

    // Get current user's details for the invite
    const { data: inviter, error: inviterError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (inviterError) {
      console.error('Error fetching inviter details:', inviterError);
      return res.status(500).json({ message: 'Error fetching inviter details', error: inviterError });
    }

    // Generate a unique token for the invite
    const inviteToken = uuidv4();

    // Generate the invite link with token
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/join?token=${inviteToken}`;

    console.log('Checking if user exists in auth system:', email);
    const { data: authUsers, error: authCheckError } = await supabase.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users.find(user => user.email === email);

    if (authCheckError) {
      console.error('Error checking auth system:', authCheckError);
      return res.status(500).json({ message: 'Error checking auth system', error: authCheckError });
    }

    // Create team invite record first
    console.log('Creating team invite for:', email);
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .insert([{
        id: inviteToken,
        invited_by: currentUser.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        company: company || null,
        role: role,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      }])
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating team invite:', inviteError);
      return res.status(500).json({ message: 'Failed to create team invite', error: inviteError });
    }

    console.log('Team invite created successfully:', invite);

    // Create a temporary password for new users
    const tempPassword = existingAuthUser ? undefined : randomUUID();

    // If user doesn't exist, create their account
    if (!existingAuthUser) {
      console.log('Creating user account for:', email);
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: tempPassword!,
        email_confirm: false,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          company: company,
          role: role,
          invite_id: inviteToken,
          invited_by: currentUser.id,
          onboarding_complete: false
        }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        // Update invite status to failed
        await supabase
          .from('team_invites')
          .update({ status: 'failed' })
          .eq('id', inviteToken);
        return res.status(503).json({ 
          message: 'Failed to create user account', 
          error: createError
        });
      }

      // Create a record in the public.users table
      console.log('Creating public user record for:', email);
      const { data: publicUserData, error: publicUserError } = await supabase
        .from('users')
        .insert([{
          id: userData.user.id,
          email: email,
          role: role,
          onboarding_complete: false,
          credits_used: 0,
          credits_available: 0,
          is_in_cooldown: false
        }])
        .select()
        .single();

      if (publicUserError) {
        console.error('Error creating public user record:', publicUserError);
        // Clean up the auth user since we couldn't create the public record
        await supabase.auth.admin.deleteUser(userData.user.id);
        return res.status(503).json({ 
          message: 'Failed to create user record', 
          error: publicUserError
        });
      }
    }

    // Send invite email using SendGrid
    console.log('Sending invite email via SendGrid...');
    try {
      await sendTeamInviteEmail({
        to: email,
        firstName: firstName,
        lastName: lastName,
        inviteLink: inviteLink,
        tempPassword: tempPassword,
        invitedBy: {
          firstName: inviter.first_name || 'Team Member',
          lastName: inviter.last_name || '',
          email: inviter.email
        },
        company: company,
        role: role
      });
    } catch (emailError) {
      console.error('Error sending invite email:', emailError);
      return res.status(503).json({ 
        message: 'Failed to send invite email', 
        error: emailError
      });
    }

    // Send notification
    await sendTeamNotify('member_joined', invite.invited_by, {
      memberName: `${invite.first_name} ${invite.last_name}`
    });

    console.log('Invitation process completed successfully');
    res.json({ 
      message: 'Invitation sent successfully',
      data: {
        invite_id: inviteToken,
        status: 'email_sent'
      }
    });
  } catch (error) {
    console.error('Unexpected error in invite process:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});

// POST /api/team/invite/resend
router.post('/invite/resend', async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Starting resend invite process...');
    const { inviteId } = req.body;
    const currentUser = req.auth?.user;

    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get the invite details
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      console.error('Error fetching invite:', inviteError);
      return res.status(404).json({ message: 'Invite not found' });
    }

    // Get current user's details for the invite
    const { data: inviter, error: inviterError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (inviterError) {
      console.error('Error fetching inviter details:', inviterError);
      return res.status(500).json({ message: 'Error fetching inviter details', error: inviterError });
    }

    console.log('Found invite:', { email: invite.email, id: invite.id });

    // Check if user exists in auth system
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
    const users = authUser?.users as { email: string }[];
    const existingAuthUser = users.find(u => u.email === invite.email);

    if (authError) {
      console.error('Error checking auth user:', authError);
      return res.status(500).json({ message: 'Error checking user existence', error: authError });
    }

    // Generate invite URL
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/join?token=${invite.id}`;
    console.log('Generated invite link:', inviteLink);

    // Create a temporary password for new users
    const tempPassword = existingAuthUser ? undefined : randomUUID();

    // If user doesn't exist, create their account
    if (!existingAuthUser) {
      console.log('Creating user account for:', invite.email);
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: invite.email,
        password: tempPassword!,
        email_confirm: false,
        user_metadata: {
          first_name: invite.first_name,
          last_name: invite.last_name,
          company: invite.company,
          role: invite.role,
          invite_id: invite.id,
          invited_by: currentUser.id,
          onboarding_complete: false
        }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return res.status(503).json({ 
          message: 'Failed to create user account', 
          error: createError
        });
      }

      // Create a record in the public.users table
      console.log('Creating public user record for:', invite.email);
      const { error: publicUserError } = await supabase
        .from('users')
        .insert([{
          id: userData.user.id,
          email: invite.email,
          role: invite.role,
          onboarding_complete: false,
          credits_used: 0,
          credits_available: 0,
          is_in_cooldown: false
        }]);

      if (publicUserError) {
        console.error('Error creating public user record:', publicUserError);
        // Clean up the auth user since we couldn't create the public record
        await supabase.auth.admin.deleteUser(userData.user.id);
        return res.status(503).json({ 
          message: 'Failed to create user record', 
          error: publicUserError
        });
      }
    }

    // Send invite email using SendGrid
    console.log('Sending invite email via SendGrid...');
    try {
      await sendTeamInviteEmail({
        to: invite.email,
        firstName: invite.first_name,
        lastName: invite.last_name,
        inviteLink: inviteLink,
        tempPassword: tempPassword,
        invitedBy: {
          firstName: inviter.first_name || 'Team Member',
          lastName: inviter.last_name || '',
          email: inviter.email
        },
        company: invite.company || undefined,
        role: invite.role
      });
    } catch (emailError) {
      console.error('Error sending invite email:', emailError);
      return res.status(503).json({ 
        message: 'Failed to send invite email', 
        error: emailError
      });
    }

    // Update invite status and timestamp
    console.log('Updating invite status...');
    await supabase
      .from('team_invites')
      .update({ 
        updated_at: new Date().toISOString(),
        status: 'pending'
      })
      .eq('id', inviteId);

    // Send notification
    await sendTeamNotify('member_joined', invite.invited_by, {
      memberName: `${invite.first_name} ${invite.last_name}`
    });

    console.log('Invite process completed successfully');
    res.json({ 
      message: 'Invitation sent successfully',
      data: {
        invite_id: inviteId,
        status: 'email_sent'
      }
    });
  } catch (error) {
    console.error('Unexpected error in resend invite:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});

// Delete team member invite
router.delete('/invite/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get the invite details first
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*')
      .eq('id', id)
      .single();

    if (inviteError) {
      console.error('Error fetching invite:', inviteError);
      return res.status(500).json({ message: 'Error fetching invite', error: inviteError });
    }

    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' });
    }

    // Find the user in auth system by email
    const { data: authUsers, error: authCheckError } = await supabase.auth.admin.listUsers();
    const users = authUsers?.users as { email: string }[];
    const userToDelete = users.find(user => user.email === invite.email);

    if (authCheckError) {
      console.error('Error checking auth system:', authCheckError);
      return res.status(500).json({ message: 'Error checking auth system', error: authCheckError });
    }

    // Delete from public.users first if exists
    if (userToDelete) {
      console.log('Deleting public user record...');
      const { error: publicDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userToDelete.id);

      if (publicDeleteError) {
        console.error('Error deleting public user:', publicDeleteError);
        return res.status(500).json({ message: 'Error deleting public user', error: publicDeleteError });
      }

      // Delete from auth.users
      console.log('Deleting auth user...');
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userToDelete.id);
      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
        return res.status(500).json({ message: 'Error deleting auth user', error: authDeleteError });
      }
    }

    // Finally delete the invite
    console.log('Deleting team invite...');
    const { error: deleteError } = await supabase
      .from('team_invites')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting invite:', deleteError);
      return res.status(500).json({ message: 'Error deleting invite', error: deleteError });
    }

    // Send notification
    await sendTeamNotify('member_left', invite.invited_by, {
      memberName: `${invite.first_name} ${invite.last_name}`
    });

    console.log('Successfully deleted invite and associated user records');
    res.json({ message: 'Invite and associated user records deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in delete process:', error);
    res.status(500).json({ message: 'Unexpected error in delete process', error });
  }
});

// Inside the route where a team member's role is updated:
router.put('/member/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Update the user's role
    const { data: user, error: userError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select('first_name, last_name')
      .single();

    if (userError) throw userError;

    // Get the admin user's ID from the auth token
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('No authorization header');
    
    const token = authHeader.split(' ')[1];
    const { data: { user: admin }, error: adminError } = await supabase.auth.getUser(token);
    if (adminError || !admin) throw new Error('Failed to get admin user');

    // Send notification
    await sendTeamNotify('role_changed', admin.id, {
      memberName: `${user.first_name} ${user.last_name}`,
      role
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

export default router; 