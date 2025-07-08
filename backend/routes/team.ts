import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { sendTeamInviteEmail } from '../services/emailService';
import { sendTeamNotify } from '../lib/notifications';
import Stripe from 'stripe';
import { CreditService } from '../services/creditService';

const router = Router();

interface TeamInviteRequest {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  role: 'admin' | 'member' | 'team_admin' | 'RecruitPro';
}

interface AuthenticatedRequest extends Request {
  auth?: {
    user?: User;
  };
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' });

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
      res.status(500).json({ message: 'Failed to connect to Supabase', error });
      return;
    }
    
    return res.json({ message: 'Supabase connection successful', data });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ message: 'Connection test failed', error });
    return;
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
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { firstName, lastName, email, company, role } = req.body as TeamInviteRequest;
    const currentUser = req.auth?.user;

    // If current user is a super admin, bypass seat-limit checks entirely
    const { data: currentUserRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    const isSuperAdmin = currentUserRow?.role === 'super_admin' || currentUserRow?.role === 'SuperAdmin';

    if (!isSuperAdmin) {
      // ===== Seat-limit enforcement =====
      // Fetch the subscription of the current user (assumed team owner / admin)
      const { data: subRow, error: subErr } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (subErr) {
        console.error('Failed to fetch subscription for seat check', subErr);
        return res.status(500).json({ message: 'Failed to validate seat limits', error: subErr });
      }

      if (!subRow) {
        return res.status(400).json({ message: 'No active subscription found. Please subscribe before inviting team members.' });
      }

      const {
        plan_tier: planTier,
        seat_count: seatCount = 0,
        included_seats: includedSeats = 1,
        stripe_subscription_id: stripeSubId
      } = subRow as any;

      // Block invite for Starter / Pro if seat limit reached
      if (['starter', 'pro'].includes(planTier) && seatCount >= includedSeats) {
        return res.status(403).json({ message: 'Seat limit reached for your plan. Upgrade to the Team plan to add additional members.' });
      }

      // For Team plan – if we are at limit we automatically add a paid seat in Stripe & DB
      let updatedSeatCount = seatCount;
      if (planTier === 'team') {
        updatedSeatCount = seatCount + 1; // optimistic increment, will update later
        if (updatedSeatCount > includedSeats) {
          try {
            // Retrieve subscription to get item id
            const subscription = await stripe.subscriptions.retrieve(stripeSubId, { expand: ['items'] });
            const itemId = subscription.items.data[0]?.id;
            if (!itemId) throw new Error('Unable to find Stripe subscription item');

            // Update the quantity (seat count) on the subscription item
            await stripe.subscriptionItems.update(itemId, { quantity: updatedSeatCount });

            // Reflect the change in our DB
            await supabase
              .from('subscriptions')
              .update({ seat_count: updatedSeatCount })
              .eq('stripe_subscription_id', stripeSubId);
          } catch (stripeErr) {
            console.error('Failed to auto-add seat in Stripe', stripeErr);
            return res.status(500).json({ message: 'Failed to increase seat count in Stripe', error: stripeErr });
          }
        }
      }
      // ===== End seat-limit logic =====
    }

    // Get current user's details for the invite
    const { data: inviter, error: inviterError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (inviterError) {
      console.error('Error fetching inviter details:', inviterError);
      res.status(500).json({ message: 'Error fetching inviter details', error: inviterError });
      return;
    }

    // Generate a unique token for the invite
    const inviteToken = uuidv4();

    // Generate the invite link with token
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/join?token=${inviteToken}`;

    console.log('Checking if user exists in auth system:', email);
    const { data: authUsers, error: authCheckError } = await supabase.auth.admin.listUsers();
    const users = authUsers?.users as { id: string; email: string }[];
    const existingAuthUser = users.find(user => user.email === email);

    if (authCheckError) {
      console.error('Error checking auth system:', authCheckError);
      res.status(500).json({ message: 'Error checking auth system', error: authCheckError });
      return;
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
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        team_id: (req as any).teamId
      }])
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating team invite:', inviteError);
      res.status(500).json({ message: 'Failed to create team invite', error: inviteError });
      return;
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
          onboarding_complete: false,
          team_id: (req as any).teamId
        }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        // Update invite status to failed
        await supabase
          .from('team_invites')
          .update({ status: 'failed' })
          .eq('id', inviteToken);
        res.status(503).json({ 
          message: 'Failed to create user account', 
          error: createError
        });
        return;
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
          is_in_cooldown: false,
          team_id: (req as any).teamId
        }])
        .select()
        .single();

      if (publicUserError) {
        console.error('Error creating public user record:', publicUserError);
        // Clean up the auth user since we couldn't create the public record
        await supabase.auth.admin.deleteUser(userData.user.id);
        res.status(503).json({ 
          message: 'Failed to create user record', 
          error: publicUserError
        });
        return;
      }

      // Initialize credits based on role for new team member
      try {
        await CreditService.allocateCreditsBasedOnRole(userData.user.id, role, 'admin_grant');
        console.log(`[TEAM INVITE] Credits allocated for ${role} role`);
      } catch (creditError) {
        console.error('[TEAM INVITE] Error allocating credits:', creditError);
        // Continue execution even if credit allocation fails
      }

      // seat count increment will be handled in separate service to avoid linter issues
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
      res.status(503).json({ 
        message: 'Failed to send invite email', 
        error: emailError
      });
      return;
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
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get the invite details
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      console.error('Error fetching invite:', inviteError);
      res.status(404).json({ message: 'Invite not found' });
      return;
    }

    // Get current user's details for the invite
    const { data: inviter, error: inviterError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (inviterError) {
      console.error('Error fetching inviter details:', inviterError);
      res.status(500).json({ message: 'Error fetching inviter details', error: inviterError });
      return;
    }

    console.log('Found invite:', { email: invite.email, id: invite.id });

    // Check if user exists in auth system
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    const users = authUsers?.users as { id: string; email: string }[];
    const existingAuthUser = users.find(u => u.email === invite.email);

    if (authError) {
      console.error('Error checking auth user:', authError);
      res.status(500).json({ message: 'Error checking user existence', error: authError });
      return;
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
          onboarding_complete: false,
          team_id: (req as any).teamId
        }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        res.status(503).json({ 
          message: 'Failed to create user account', 
          error: createError
        });
        return;
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
          is_in_cooldown: false,
          team_id: (req as any).teamId
        }]);

      if (publicUserError) {
        console.error('Error creating public user record:', publicUserError);
        // Clean up the auth user since we couldn't create the public record
        await supabase.auth.admin.deleteUser(userData.user.id);
        res.status(503).json({ 
          message: 'Failed to create user record', 
          error: publicUserError
        });
        return;
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
      res.status(503).json({ 
        message: 'Failed to send invite email', 
        error: emailError
      });
      return;
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
      res.status(500).json({ message: 'Error fetching invite', error: inviteError });
      return;
    }

    if (!invite) {
      res.status(404).json({ message: 'Invite not found' });
      return;
    }

    // Find the user in auth system by email
    const { data: authUsers, error: authCheckError } = await supabase.auth.admin.listUsers();
    const users = authUsers?.users as { id: string; email: string }[];
    const userToDelete = users.find(user => user.email === invite.email);

    if (authCheckError) {
      console.error('Error checking auth system:', authCheckError);
      res.status(500).json({ message: 'Error checking auth system', error: authCheckError });
      return;
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
        res.status(500).json({ message: 'Error deleting public user', error: publicDeleteError });
        return;
      }

      // Delete from auth.users
      console.log('Deleting auth user...');
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userToDelete.id);
      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
        res.status(500).json({ message: 'Error deleting auth user', error: authDeleteError });
        return;
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
      res.status(500).json({ message: 'Error deleting invite', error: deleteError });
      return;
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