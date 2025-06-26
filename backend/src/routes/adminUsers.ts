console.log('=== ADMIN USERS ROUTE LOADED ===');
import express, { Request, Response } from 'express';
import { supabase as dbClient, supabaseDb } from '../../lib/supabase';
console.log('[DEBUG] supabaseLib:', dbClient);
import { requireAuth } from '../../middleware/authMiddleware';
import { sendTeamInviteEmail } from '../../services/emailService';
import { randomUUID } from 'crypto';
import { ApiRequest } from '../../types/api';

const router = express.Router();

const supabase = dbClient;

// Helper: Check if user is super admin
async function isSuperAdmin(userId: string) {
  const { data, error } = await supabaseDb
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'super_admin';
}

// Middleware: Restrict to super admins
async function requireSuperAdmin(req: Request, res: Response, next: Function) {
  const userData = (req as any).user;
  if (!userData?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (userData.role !== 'super_admin' && !(await isSuperAdmin(userData.id))) {
    res.status(403).json({ error: 'Forbidden: Super admin only' });
    return;
  }
  next();
}

// GET /api/admin/users - List all users
router.get('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  console.log('[ADMIN USERS] Fetching all users from Supabase...');
  const { data, error } = await supabaseDb.from('users').select('*');
  if (error) {
    console.error('[ADMIN USERS] Error fetching users:', error);
    res.status(500).json({ error: error.message });
    return;
  }
  console.log('[ADMIN USERS] Users fetched:', data);
  res.json(data);
});

// GET /api/admin/users/:id  – fetch a single user record
router.get('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabaseDb.from('users').select('*').eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// POST /api/admin/users - Create/invite a user
router.post('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, role } = req.body;
    if (!email || !firstName || !lastName || !role) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    // 1. Create user in Supabase Auth (invite)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { firstName, lastName, role },
    });
    console.log('[ADMIN USERS] Auth user creation result:', { authUser, authError });

    let userId = authUser?.user?.id;

    if (authError) {
      if ((authError as any).code === 'email_exists') {
        // fetch existing user id
        const { data: existingDbUser } = await supabase.from('users').select('*').eq('email', email).single();
        if (existingDbUser?.id) {
          // Already onboarded in DB – return that record
          res.status(200).json({ success: true, user: existingDbUser, message: 'User already exists' });
          return;
        }
        // if not in DB, bubble duplicate
        res.status(409).json({ error: 'User already registered' });
        return;
      } else {
        res.status(500).json({ error: authError.message });
        return;
      }
    }

    if (!userId) {
      res.status(500).json({ error: 'Failed to determine user id' });
      return;
    }

    // 2. Insert into users table
    console.log('[ADMIN USERS] Attempting to insert user into users table:', {
      id: userId,
      email,
      firstName,
      lastName,
      role,
      onboardingComplete: false,
    });
    const { data: dbUser, error: dbError } = await supabase.from('users').upsert({
      id: userId,
      email,
      firstName,
      lastName,
      role,
      onboardingComplete: false,
    }, { onConflict: 'id' }).select('*').single();
    console.log('[ADMIN USERS] Insert result:', { dbUser, dbError });
    if (dbError) {
      console.error('[ADMIN USERS] DB insert error (full object):', dbError);
      res.status(500).json({ error: dbError.message || 'Database error creating new user' });
      return;
    }
    // 3. If RecruitPro, initialize credits
    if (role === 'RecruitPro') {
      await supabase.from('user_credits').insert({
        user_id: userId,
        total_credits: 1000,
        used_credits: 0,
      });
    }
    // 4. Send invite email using the same template as team invite
    // Get inviter info
    const inviterId = (req as any).user?.id;
    const { data: inviter, error: inviterError } = await supabase.from('users').select('*').eq('id', inviterId).single();
    const inviterInfo = inviter || { firstName: 'Super', lastName: 'Admin', email: 'admin@hirepilot.com' };
    // Generate invite link (use user id as token)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://hirepilot.com';
    const inviteLink = `${appUrl}/join?token=${userId}`;
    try {
      await sendTeamInviteEmail({
        to: email,
        firstName,
        lastName,
        inviteLink,
        tempPassword: '',
        invitedBy: {
          firstName: inviterInfo.firstName || 'Super Admin',
          lastName: inviterInfo.lastName || '',
          email: inviterInfo.email
        },
        role
      });
    } catch (emailError) {
      res.status(500).json({ error: 'Failed to send invite email', details: emailError });
      return;
    }
    res.json({ success: true, user: dbUser });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /api/admin/users/:id/credits - Assign credits
router.patch('/users/:id/credits', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { total_credits } = req.body;
  if (!total_credits) {
    res.status(400).json({ error: 'Missing total_credits' });
    return;
  }
  const { error } = await supabaseDb.from('user_credits').upsert({
    user_id: userId,
    balance: total_credits,
  }, { onConflict: 'user_id' });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true, user_id: userId, total_credits });
});

// PATCH /api/admin/users  – update user when body contains id (fallback for UI)
router.patch('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id, firstName, lastName, role } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id required' });
  }

  const updatePayload: any = { role };
  if (firstName !== undefined) updatePayload.firstName = firstName;
  if (lastName !== undefined) updatePayload.lastName = lastName;

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ---------------------------------------------
// PATCH /api/admin/users/:id  – edit user by URL param (original front-end call)
// ---------------------------------------------
router.patch('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, role } = req.body;

  const updatePayload: any = { role };
  if (firstName !== undefined) updatePayload.firstName = firstName;
  if (lastName !== undefined) updatePayload.lastName = lastName;

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  // Optionally, delete from Auth as well
  res.json({ success: true });
});

// GET /api/admin/latest-users - List the most recently created users
router.get('/latest-users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /api/admin/users/:id/password - Set password (Super Admin)
router.patch('/users/:id/password', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { password } = req.body;

  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    // Use service role client for admin operations
    const adminClient = supabaseDb;

    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
      password
    });

    if (error) {
      console.error('[ADMIN USERS] Password update error:', error);
      res.status(500).json({ error: error.message || 'Failed to update password' });
      return;
    }

    res.json({ success: true, user: data?.user });
  } catch (err) {
    console.error('[ADMIN USERS] Unexpected error updating password:', err);
    res.status(500).json({ error: (err as Error).message || 'Internal server error' });
  }
});

export const getAdminUsers = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'admin');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
    return;
  }
};

export const createAdminUser = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, password, firstName, lastName } = req.body;

    const { data: userData, error: userError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          firstName,
          lastName,
          role: 'admin'
        }
      }
    });

    if (userError) {
      res.status(500).json({ error: userError.message });
      return;
    }

    res.status(201).json(userData);
    return;
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
    return;
  }
};

export const inviteTeamMember = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, firstName, lastName, role, company } = req.body;

    const inviteData = {
      to: email,
      firstName,
      lastName,
      inviteLink: `${process.env.FRONTEND_URL}/invite?token=${Math.random().toString(36).substring(7)}`,
      invitedBy: {
        firstName: req.user.first_name || '',
        lastName: req.user.last_name || '',
        email: req.user.email
      },
      company,
      role
    };

    await sendTeamInviteEmail(inviteData);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error inviting team member:', error);
    res.status(500).json({ error: 'Failed to invite team member' });
    return;
  }
};

export default router; 