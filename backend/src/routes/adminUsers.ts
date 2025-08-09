console.log('=== ADMIN USERS ROUTE LOADED ===');
import express, { Request, Response } from 'express';
import { supabase as dbClient, supabaseDb } from '../../lib/supabase';
console.log('[DEBUG] supabaseLib:', dbClient);
import { requireAuth } from '../../middleware/authMiddleware';
import { sendTeamInviteEmail } from '../../services/emailService';
import { randomUUID } from 'crypto';
import { ApiRequest } from '../../types/api';
import { CreditService } from '../../services/creditService';

const router = express.Router();

const supabase = supabaseDb; // Use service role client for admin operations

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
  const { data: users, error: userErr } = await supabaseDb.from('users').select('*');
  if (userErr) {
    console.error('[ADMIN USERS] Error fetching users:', userErr);
    return res.status(500).json({ error: userErr.message });
  }

  // fetch credits for these users
  const ids = users.map(u => u.id);
  const { data: credits } = await supabaseDb.from('user_credits').select('user_id,remaining_credits').in('user_id', ids);
  const creditMap: Record<string, number> = {};
  (credits || []).forEach(c => { creditMap[c.user_id] = c.remaining_credits; });

  const enriched = users.map(u => ({ ...u, balance: creditMap[u.id] || 0 }));
  res.json(enriched);
});

// GET /api/admin/users/:id  – fetch a single user record
router.get('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabaseDb.from('users').select('*').eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// GET /api/admin/users/:id/features - Get feature flags (rex, zapier)
router.get('/users/:id/features', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Use integrations table as source of truth
    const { data: integ, error: integErr } = await supabaseDb
      .from('integrations')
      .select('provider,status')
      .eq('user_id', id);
    if (integErr) return res.status(500).json({ error: integErr.message });

    const rexRow = (integ || []).find((r: any) => r.provider === 'rex');
    const zapRow = (integ || []).find((r: any) => r.provider === 'zapier');
    const enabledStatuses = new Set(['enabled','connected','on','true']);
    res.json({
      rex_enabled: enabledStatuses.has((rexRow?.status || '').toLowerCase()),
      zapier_enabled: enabledStatuses.has((zapRow?.status || '').toLowerCase())
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load feature flags' });
  }
});

// PATCH /api/admin/users/:id/features - Update feature flags (rex, zapier)
router.patch('/users/:id/features', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rex_enabled, zapier_enabled } = req.body || {};
  try {
    // Store feature flags in integrations table
    const rows: any[] = [];
    if (typeof rex_enabled === 'boolean') rows.push({ user_id: id, provider: 'rex', status: rex_enabled ? 'enabled' : 'disabled' });
    if (typeof zapier_enabled === 'boolean') rows.push({ user_id: id, provider: 'zapier', status: zapier_enabled ? 'enabled' : 'disabled' });
    if (rows.length > 0) {
      const { error: upErr } = await supabaseDb.from('integrations').upsert(rows, { onConflict: 'user_id,provider' });
      if (upErr) return res.status(500).json({ error: upErr.message });
    }

    res.json({ success: true, user_id: id, rex_enabled, zapier_enabled });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update feature flags' });
  }
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
    // 3. Initialize credits based on role
    try {
      await CreditService.allocateCreditsBasedOnRole(userId, role, 'admin_grant');
      console.log(`[ADMIN USERS] Credits allocated for ${role} role`);
    } catch (creditError) {
      console.error('[ADMIN USERS] Error allocating credits:', creditError);
      // Continue execution even if credit allocation fails
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
        tempPassword: undefined, // No temp password for admin-created users
        invitedBy: {
          firstName: inviterInfo.firstName || 'Super Admin',
          lastName: inviterInfo.lastName || '',
          email: inviterInfo.email
        },
        company: undefined, // No company specified for admin users
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
    total_credits: total_credits,
    used_credits: 0,
    remaining_credits: total_credits,
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

  const { data, error } = await supabaseDb
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

  const { data, error } = await supabaseDb
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

// POST /api/admin/users/backfill-credits - Backfill credits for existing users
router.post('/users/backfill-credits', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN] Starting credit backfill...');
    
    // Get all users from the public.users table
    const { data: users, error: usersError } = await supabaseDb
      .from('users')
      .select('id, email, role, firstName, lastName');

    if (usersError) {
      console.error('[ADMIN] Error fetching users:', usersError);
      res.status(500).json({ error: usersError.message });
      return;
    }

    if (!users || users.length === 0) {
      res.json({ message: 'No users found in the database.', processed: 0, errors: 0 });
      return;
    }

    // Get existing credit records to avoid duplicates
    const { data: existingCredits, error: creditsError } = await supabaseDb
      .from('user_credits')
      .select('user_id');

    if (creditsError) {
      console.error('[ADMIN] Error fetching existing credits:', creditsError);
      res.status(500).json({ error: creditsError.message });
      return;
    }

    const existingCreditUserIds = new Set(
      (existingCredits || []).map(c => c.user_id)
    );

    // Filter users who don't have credits yet
    const usersWithoutCredits = users.filter(user => !existingCreditUserIds.has(user.id));

    console.log(`[ADMIN] Found ${usersWithoutCredits.length} users without credits`);

    if (usersWithoutCredits.length === 0) {
      res.json({ 
        message: 'All users already have credits assigned.', 
        totalUsers: users.length,
        processed: 0, 
        errors: 0 
      });
      return;
    }

    // Process each user
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const user of usersWithoutCredits) {
      try {
        const role = user.role || 'member'; // Default to member if no role
        
        await CreditService.allocateCreditsBasedOnRole(user.id, role, 'admin_grant');
        
        successCount++;
        console.log(`[ADMIN] Assigned credits to ${user.email} (${role})`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to assign credits to ${user.email}: ${error}`;
        console.error(`[ADMIN] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Return results
    res.json({
      message: 'Credit backfill completed',
      totalUsers: users.length,
      usersProcessed: usersWithoutCredits.length,
      successful: successCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined
    });
    
  } catch (err) {
    console.error('[ADMIN] Fatal error during backfill:', err);
    res.status(500).json({ error: (err as Error).message });
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