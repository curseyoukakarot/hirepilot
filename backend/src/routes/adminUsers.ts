console.log('=== ADMIN USERS ROUTE LOADED ===');
import express, { Request, Response } from 'express';
import * as supabaseLib from '../lib/supabase';
console.log('[DEBUG] supabaseLib:', supabaseLib);
import { requireAuth } from '../../middleware/authMiddleware';
import { sendTeamInviteEmail } from '../../services/emailService';
import { randomUUID } from 'crypto';

const router = express.Router();

const dbClient = supabaseLib.supabase;

// Helper: Check if user is super admin
async function isSuperAdmin(userId: string) {
  const { data, error } = await dbClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'super_admin';
}

// Middleware: Restrict to super admins
async function requireSuperAdmin(req: Request, res: Response, next: Function) {
  const userId = (req as any).auth?.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!(await isSuperAdmin(userId))) {
    return res.status(403).json({ error: 'Forbidden: Super admin only' });
  }
  next();
}

// GET /api/admin/users - List all users
router.get('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  console.log('[ADMIN USERS] Fetching all users from Supabase...');
  const { data, error } = await dbClient.from('users').select('*');
  if (error) {
    console.error('[ADMIN USERS] Error fetching users:', error);
    return res.status(500).json({ error: error.message });
  }
  console.log('[ADMIN USERS] Users fetched:', data);
  res.json(data);
});

// POST /api/admin/users - Create/invite a user
router.post('/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, role } = req.body;
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // 1. Create user in Supabase Auth (invite)
    const { data: authUser, error: authError } = await dbClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, role },
    });
    console.log('[ADMIN USERS] Auth user creation result:', { authUser, authError });
    if (authError) return res.status(500).json({ error: authError.message });
    // 2. Insert into users table
    console.log('[ADMIN USERS] Attempting to insert user into users table:', {
      id: authUser.user.id,
      email,
      firstName,
      lastName,
      role,
      onboardingComplete: false,
    });
    const { data: dbUser, error: dbError } = await dbClient.from('users').insert({
      id: authUser.user.id,
      email,
      firstName,
      lastName,
      role,
      onboardingComplete: false,
    }).select('*').single();
    console.log('[ADMIN USERS] Insert result:', { dbUser, dbError });
    if (dbError) {
      console.error('[ADMIN USERS] DB insert error (full object):', dbError);
      return res.status(500).json({ error: dbError.message || 'Database error creating new user' });
    }
    // 3. If RecruitPro, initialize credits
    if (role === 'RecruitPro') {
      await dbClient.from('user_credits').insert({
        user_id: authUser.user.id,
        total_credits: 1000,
        used_credits: 0,
        remaining_credits: 1000,
      });
    }
    // 4. Send invite email using the same template as team invite
    // Get inviter info
    const inviterId = (req as any).auth?.user?.id;
    const { data: inviter, error: inviterError } = await dbClient.from('users').select('*').eq('id', inviterId).single();
    if (inviterError || !inviter) return res.status(500).json({ error: 'Failed to fetch inviter info' });
    // Generate invite link (use user id as token)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://hirepilot.com';
    const inviteLink = `${appUrl}/join?token=${authUser.user.id}`;
    try {
      await sendTeamInviteEmail({
        to: email,
        firstName,
        lastName,
        inviteLink,
        tempPassword: '',
        invitedBy: {
          firstName: inviter.firstName || 'Super Admin',
          lastName: inviter.lastName || '',
          email: inviter.email
        },
        role
      });
    } catch (emailError) {
      return res.status(500).json({ error: 'Failed to send invite email', details: emailError });
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
  if (!total_credits) return res.status(400).json({ error: 'Missing total_credits' });
  const { data, error } = await dbClient.from('user_credits').upsert({
    user_id: userId,
    total_credits,
    used_credits: 0,
    remaining_credits: total_credits,
  }, { onConflict: 'user_id' }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/admin/users/:id - Edit user
router.patch('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { firstName, lastName, role } = req.body;
  const { data, error } = await dbClient.from('users').update({ firstName, lastName, role }).eq('id', userId).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { error } = await dbClient.from('users').delete().eq('id', userId);
  if (error) return res.status(500).json({ error: error.message });
  // Optionally, delete from Auth as well
  res.json({ success: true });
});

export default router; 