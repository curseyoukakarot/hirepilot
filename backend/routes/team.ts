import { Router, Request, Response } from 'express';
import { supabase, supabaseDb } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { sendTeamInviteEmail } from '../services/emailService';
import { sendTeamNotify } from '../lib/notifications';
import Stripe from 'stripe';
import { CreditService } from '../services/creditService';
import { notifySlack } from '../lib/slack';

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
const TEAM_INVITE_EXPIRATION_HOURS = Number(process.env.TEAM_INVITE_EXPIRATION_HOURS || '24');

const NON_PAID_PLAN_LABELS = new Set(['free', 'free_trial', 'trial', 'trial_free', 'guest', 'guest_collaborator', 'starter_free']);

function normalizePaidPlan(plan?: string | null): string | null {
  const trimmed = (plan || '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (NON_PAID_PLAN_LABELS.has(lower)) return null;
  return lower;
}

function resolvePaidPlanLabel(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const normalized = normalizePaidPlan(candidate);
    if (normalized) return normalized;
  }
  return 'team';
}

async function ensureTeamIdForTeamAdmin(userId: string, inviter: any): Promise<string | null> {
  const existingTeamId = inviter?.team_id || null;
  if (existingTeamId) return existingTeamId;
  try {
    const displayNameCandidate = [inviter?.first_name, inviter?.last_name].filter(Boolean).join(' ').trim();
    const emailHandle = (inviter?.email || '').split('@')?.[0];
    const teamName =
      (inviter?.company || '').trim() ||
      (displayNameCandidate ? `${displayNameCandidate}'s Team` : null) ||
      (emailHandle ? `${emailHandle}'s Team` : null) ||
      `Team ${String(userId).slice(0, 8)}`;

    const { data, error } = await supabaseDb
      .from('teams')
      .insert({ name: teamName })
      .select('id')
      .single();

    if (error) {
      console.error('[team invite] failed to create team for inviter', userId, error);
      return null;
    }

    const newTeamId = (data as any)?.id || null;
    if (!newTeamId) return null;

    await supabaseDb.from('users').update({ team_id: newTeamId }).eq('id', userId);
    await syncAuthMetadata(userId, null, null, { team_id: newTeamId });
    return newTeamId;
  } catch (err) {
    console.error('[team invite] ensureTeamIdForTeamAdmin error', err);
    return null;
  }
}

async function syncAuthMetadata(userId: string | null, role?: string | null, plan?: string | null, extraMeta: Record<string, any> = {}) {
  if (!userId) return;
  try {
    const { data } = await supabaseDb.auth.admin.getUserById(userId);
    const authUser = data?.user;
    const nextApp: Record<string, any> = { ...(authUser?.app_metadata || {}) };
    const nextMeta: Record<string, any> = { ...(authUser?.user_metadata || {}) };
    if (role) {
      nextApp.role = role;
      nextMeta.role = role;
      nextMeta.account_type = role;
    }
    if (plan) {
      nextMeta.plan = plan;
    }
    Object.assign(nextMeta, extraMeta || {});
    await supabaseDb.auth.admin.updateUserById(userId, {
      app_metadata: nextApp,
      user_metadata: nextMeta
    } as any);
  } catch (err) {
    console.warn('[team] Failed to sync auth metadata', err);
  }
}

async function upsertUserPlanRecord(params: {
  userId: string;
  email: string;
  role: string;
  plan: string;
  teamId?: string | null;
  seedDefaults?: boolean;
  returnRow?: boolean;
}) {
  const payload: Record<string, any> = {
    id: params.userId,
    email: params.email,
    role: params.role,
    team_id: params.teamId ?? null,
    plan: params.plan,
    plan_updated_at: new Date().toISOString()
  };

  if (params.seedDefaults) {
    payload.onboarding_complete = false;
    payload.credits_used = 0;
    payload.credits_available = 0;
    payload.is_in_cooldown = false;
  }

  const query = supabaseDb
    .from('users')
    .upsert(payload, { onConflict: 'id' });

  return params.returnRow ? query.select().single() : query;
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

// Helper to resolve current user from multiple possible middleware styles
async function resolveCurrentUser(req: Request): Promise<User | null> {
  try {
    const authUser = (req as any).auth?.user as User | undefined;
    if (authUser) return authUser;
    const plainUser = (req as any).user as { id: string; email?: string } | undefined;
    if (plainUser && plainUser.id) {
      // Build a minimal User-like object for downstream usage
      return {
        id: plainUser.id,
        email: (plainUser as any).email || undefined,
      } as unknown as User;
    }
    const bearer = req.headers.authorization?.split(' ')[1];
    if (bearer) {
      const { data, error } = await supabase.auth.getUser(bearer);
      if (error) {
        console.warn('[team] resolveCurrentUser getUser error', error);
        return null;
      }
      return (data as any)?.user || null;
    }
    return null;
  } catch (e) {
    console.warn('[team] resolveCurrentUser exception', e);
    return null;
  }
}

function isInviteExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  return expires < Date.now();
}

// Public: GET /api/team/invite/:token → used by join page to display invite metadata
router.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    if (!token) {
      res.status(400).json({ message: 'Invite token is required' });
      return;
    }

    const { data: invite, error: inviteError } = await supabaseDb
      .from('team_invites')
      .select('id, invited_by, first_name, last_name, email, company, role, status, expires_at, created_at')
      .eq('id', token)
      .maybeSingle();

    if (inviteError || !invite) {
      res.status(404).json({ message: 'Invite not found' });
      return;
    }

    let currentStatus = invite.status;
    if (invite.status === 'pending' && isInviteExpired(invite.expires_at)) {
      currentStatus = 'expired';
      try {
        await supabaseDb
          .from('team_invites')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', token);
      } catch (expireErr) {
        console.warn('[team invite] failed to auto-expire invite', expireErr);
      }
    }

    const { data: inviter } = await supabaseDb
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', invite.invited_by)
      .maybeSingle();

    res.json({
      token: invite.id,
      email: invite.email,
      firstName: invite.first_name,
      lastName: invite.last_name,
      company: invite.company,
      role: invite.role,
      status: currentStatus,
      expiresAt: invite.expires_at,
      invitedAt: invite.created_at,
      invitedBy: {
        firstName: inviter?.first_name || null,
        lastName: inviter?.last_name || null,
        email: inviter?.email || null,
      },
      isExpired: currentStatus === 'expired',
    });
  } catch (error) {
    console.error('Error loading invite:', error);
    res.status(500).json({ message: 'Failed to load invite', error });
  }
});

// POST /api/team/invite
router.post('/invite', async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Starting invite process...');

    const currentUserResolved = await resolveCurrentUser(req as Request);
    if (!currentUserResolved) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { firstName, lastName, email, company, role } = req.body as TeamInviteRequest;
    const permissions = (req.body as any).permissions || { rexAccess: true, zapierAccess: true };
    const currentUser = currentUserResolved;
    let teamId = (req as any).teamId || null;

    // If current user is a super admin, bypass seat-limit checks entirely
    const { data: currentUserRow, error: currentUserRowError } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (currentUserRowError) {
      console.error('[team invite] failed to load inviter user row', currentUserRowError);
      res.status(500).json({ message: 'Failed to load inviter', error: currentUserRowError });
      return;
    }

    const inviterRole = currentUserRow?.role || null;
    const normalizedInviterRole = String(inviterRole || '').toLowerCase();
    const isSuperAdmin = normalizedInviterRole === 'super_admin' || normalizedInviterRole === 'superadmin';
    let subscriptionPlanTier: string | null = null;

    // Permission: only team_admin or super_admin can invite members
    if (!['team_admin', 'super_admin', 'superadmin'].includes(normalizedInviterRole)) {
      res.status(403).json({ message: 'Only team administrators or super admins can invite team members' });
      return;
    }

    if (!isSuperAdmin) {
      // ===== Seat-limit enforcement =====
      // Fetch the subscription of the current user (assumed team owner / admin)
      const { data: subRow, error: subErr } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      // Ignore PGRST116 (no rows) and allow invite to proceed without seat checks
      if (subErr && (subErr as any).code !== 'PGRST116') {
        console.error('Failed to fetch subscription for seat check', subErr);
        return res.status(500).json({ message: 'Failed to validate seat limits', error: subErr });
      }
      // If there is no subscription row, allow inviting without seat checks.
      if (subRow) {
        subscriptionPlanTier = ((subRow as any)?.plan_tier || null);
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
      }
      // ===== End seat-limit logic =====
    }

    // Get current user's details for the invite
    const { data: inviter, error: inviterError } = await supabaseDb
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (inviterError) {
      console.error('Error fetching inviter details:', inviterError);
      res.status(500).json({ message: 'Error fetching inviter details', error: inviterError });
      return;
    }

    if (!teamId) {
      teamId = (inviter as any)?.team_id || null;
    }
    // If a team_admin somehow has no team yet, create one on first invite.
    if (!teamId && normalizedInviterRole === 'team_admin') {
      teamId = await ensureTeamIdForTeamAdmin(currentUser.id, inviter);
    }
    if (!teamId && normalizedInviterRole === 'team_admin') {
      res.status(409).json({ message: 'Team not initialized yet. Please refresh and try again.' });
      return;
    }

    const resolvedPaidPlan = resolvePaidPlanLabel(subscriptionPlanTier, (inviter as any)?.plan);

    // Generate a unique token for the invite
    const inviteToken = uuidv4();

    // Generate the invite link with token
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com';
    const inviteLink = `${appUrl}/join?token=${inviteToken}`;

    console.log('Checking if user exists in auth system:', email);
    const { data: authUsers, error: authCheckError } = await supabaseDb.auth.admin.listUsers();
    const users = authUsers?.users as { id: string; email: string }[];
    const existingAuthUser = users.find(user => user.email === email);

    if (authCheckError) {
      console.error('Error checking auth system:', authCheckError);
      res.status(500).json({ message: 'Error checking auth system', error: authCheckError });
      return;
    }

    // Create team invite record first
    console.log('Creating team invite for:', email);
    const inviteExpiresAt = new Date(Date.now() + TEAM_INVITE_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString();
    const { data: invite, error: inviteError } = await supabaseDb
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
        expires_at: inviteExpiresAt,
        team_id: teamId
      }])
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating team invite:', inviteError);
      res.status(500).json({ message: 'Failed to create team invite', error: inviteError });
      return;
    }

    console.log('Team invite created successfully:', invite);

    // Always generate a temporary password; update for existing users too
    const tempPassword = randomUUID();

    // If user doesn't exist, create their account; otherwise confirm + set temp password
    if (!existingAuthUser) {
      console.log('Creating user account for:', email);
      const { data: userData, error: createError } = await supabaseDb.auth.admin.createUser({
        email: email,
        password: tempPassword!,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          company: company,
          role: role,
          invite_id: inviteToken,
          invited_by: currentUser.id,
          onboarding_complete: false,
          team_id: teamId,
          plan: resolvedPaidPlan
        },
        app_metadata: { role } as any
      } as any);

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

      await syncAuthMetadata(userData.user.id, role, resolvedPaidPlan, { team_id: teamId });

      // Create a record in the public.users table
      console.log('Ensuring public user record for:', email);
      const { data: publicUserData, error: publicUserError } = await upsertUserPlanRecord({
        userId: userData.user.id,
        email,
        role,
        plan: resolvedPaidPlan,
        teamId,
        seedDefaults: true,
        returnRow: true
      });

      if (publicUserError) {
        console.error('Error ensuring public user record:', publicUserError);
        // Clean up the auth user since we couldn't persist the public record
        await supabaseDb.auth.admin.deleteUser(userData.user.id);
        res.status(503).json({ 
          message: 'Failed to persist user record', 
          error: publicUserError
        });
        return;
      }

      // Create default user_settings row for the new user
      try {
        // Initialize integrations table flags as well
        await supabaseDb.from('integrations').upsert([
          { user_id: userData.user.id, provider: 'rex', status: 'enabled' },
          { user_id: userData.user.id, provider: 'zapier', status: permissions.zapierAccess ? 'enabled' : 'disabled' }
        ], { onConflict: 'user_id,provider' });
      } catch (settingsErr) {
        console.warn('[TEAM INVITE] Failed to create default user_settings', settingsErr);
        // do not fail the whole flow on settings init error
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
    } else {
      console.log('User already exists; confirming email and setting temp password');
      const { error: updateErr } = await supabaseDb.auth.admin.updateUserById((existingAuthUser as any).id, {
        email_confirm: true,
        password: tempPassword
      } as any);
      if (updateErr) {
        console.error('Error updating existing auth user:', updateErr);
        res.status(503).json({ message: 'Failed to update existing user account', error: updateErr });
        return;
      }
      const { error: existingPlanError } = await upsertUserPlanRecord({
        userId: (existingAuthUser as any).id,
        email,
        role,
        plan: resolvedPaidPlan,
        teamId,
      } as any);
      if (existingPlanError) {
        console.error('Error syncing plan for existing user:', existingPlanError);
        res.status(503).json({ message: 'Failed to sync user plan record', error: existingPlanError });
        return;
      }

      await syncAuthMetadata((existingAuthUser as any).id, role, resolvedPaidPlan, { team_id: teamId });
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
        role: role,
        expiresInHours: TEAM_INVITE_EXPIRATION_HOURS
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

    // Slack alert to super_admin channel/webhook (global)
    try {
      await notifySlack(`👥 New team invite sent by ${inviter.email} → ${invite.email} (${invite.role})`);
    } catch (e) {
      console.warn('Slack notify failed', e);
    }

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
    const currentUser = await resolveCurrentUser(req as Request);

    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    let teamId = (req as any).teamId || null;
    const resendExpiresAt = new Date(Date.now() + TEAM_INVITE_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString();
    let resendPlanTier: string | null = null;
    try {
      const { data: resendSubRow } = await supabase
        .from('subscriptions')
        .select('plan_tier')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      resendPlanTier = ((resendSubRow as any)?.plan_tier || null);
    } catch (planErr) {
      console.warn('[team invite][resend] failed to load subscription plan', planErr);
    }

    // Get the invite details
    const { data: invite, error: inviteError } = await supabaseDb
      .from('team_invites')
      .select('*')
      .eq('id', inviteId)
      .maybeSingle();

    if (inviteError || !invite) {
      console.error('Error fetching invite:', inviteError);
      res.status(404).json({ message: 'Invite not found' });
      return;
    }

    // Get current user's details for the invite
    const { data: inviter, error: inviterError } = await supabaseDb
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (inviterError) {
      console.error('Error fetching inviter details:', inviterError);
      res.status(500).json({ message: 'Error fetching inviter details', error: inviterError });
      return;
    }

    if (!teamId) {
      teamId = (inviter as any)?.team_id || null;
    }
    // If a team_admin somehow has no team yet, create one on resend.
    if (!teamId && String((inviter as any)?.role || '').toLowerCase() === 'team_admin') {
      teamId = await ensureTeamIdForTeamAdmin(currentUser.id, inviter);
    }

    const resolvedResendPlan = resolvePaidPlanLabel(resendPlanTier, (inviter as any)?.plan);

    console.log('Found invite:', { email: invite.email, id: invite.id });

    // Resolve if user already exists (prefer public.users, then auth admin list)
    let existingAuthUser: { id: string; email?: string } | null = null;
    try {
      const { data: existingPublicUser } = await supabaseDb
        .from('users')
        .select('id, email')
        .eq('email', invite.email)
        .maybeSingle();
      if (existingPublicUser) existingAuthUser = { id: (existingPublicUser as any).id, email: invite.email };
    } catch {}
    if (!existingAuthUser) {
      const { data: authUsers, error: authError } = await supabaseDb.auth.admin.listUsers({ page: 1, perPage: 1000 } as any);
      if (authError) {
        console.error('Error checking auth user:', authError);
        res.status(500).json({ message: 'Error checking user existence', error: authError });
        return;
      }
      const users = (authUsers?.users || []) as { id: string; email?: string }[];
      const found = users.find(u => (u.email || '').toLowerCase() === invite.email.toLowerCase());
      if (found) existingAuthUser = { id: found.id, email: found.email };
    }

    // Generate invite URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com';
    const inviteLink = `${appUrl}/join?token=${invite.id}`;
    console.log('Generated invite link:', inviteLink);

    // Create a temporary password for new users
      const tempPassword = randomUUID();

    // If user doesn't exist, create their account; otherwise confirm + set temp password
    if (!existingAuthUser) {
      console.log('Creating user account for:', invite.email);
      const { data: userData, error: createError } = await supabaseDb.auth.admin.createUser({
        email: invite.email,
        password: tempPassword!,
        email_confirm: true,
        user_metadata: {
          first_name: invite.first_name,
          last_name: invite.last_name,
          company: invite.company,
          role: invite.role,
          invite_id: invite.id,
          invited_by: currentUser.id,
          onboarding_complete: false,
          team_id: teamId,
          plan: resolvedResendPlan
        }
      });

      if (createError) {
        // If email already exists in auth, switch to update flow
        if ((createError as any)?.code === 'email_exists') {
          try {
            const targetId = existingAuthUser?.id || (async () => {
              const { data: page } = await supabaseDb.auth.admin.listUsers({ page: 1, perPage: 1000 } as any);
              const found = ((page?.users || []) as { id: string; email?: string }[])
                .find(u => (u.email || '').toLowerCase() === invite.email.toLowerCase());
              return found?.id;
            })();
            const resolvedId = typeof targetId === 'string' ? targetId : await targetId;
            if (resolvedId) {
              const { error: updErr } = await supabaseDb.auth.admin.updateUserById(resolvedId, {
                email_confirm: true,
                password: tempPassword
              } as any);
              if (updErr) throw updErr;
              existingAuthUser = { id: resolvedId, email: invite.email };
            } else {
              throw createError;
            }
          } catch (err) {
            console.error('Error resolving existing auth user for update:', err);
            res.status(503).json({ message: 'Failed to create user account', error: createError });
            return;
          }
        } else {
          console.error('Error creating user:', createError);
          res.status(503).json({ 
            message: 'Failed to create user account', 
            error: createError
          });
          return;
        }
      }

      // Create a record in the public.users table
      if (userData?.user?.id) {
        console.log('Creating public user record for:', invite.email);
        const { error: publicUserError } = await upsertUserPlanRecord({
          userId: userData.user.id,
          email: invite.email,
          role: invite.role,
          plan: resolvedResendPlan,
          teamId,
          seedDefaults: true
        } as any);

        if (publicUserError) {
          console.error('Error creating public user record:', publicUserError);
          // Clean up the auth user since we couldn't create the public record
          await supabaseDb.auth.admin.deleteUser(userData.user.id);
          res.status(503).json({ 
            message: 'Failed to create user record', 
            error: publicUserError
          });
          return;
        }
      }

      // Create default user_settings for the new user
      try {
        await supabaseDb
          .from('user_settings')
          .insert([{ user_id: userData.user.id, email: invite.email, zapier_enabled: true, rex_enabled: true }]);
      } catch (settingsErr) {
        console.warn('[TEAM INVITE][RESEND] Failed to create default user_settings', settingsErr);
      }
    } else {
      console.log('User already exists; confirming email and setting temp password (resend)');
      const { error: updateErr } = await supabaseDb.auth.admin.updateUserById((existingAuthUser as any).id, {
        email_confirm: true,
        password: tempPassword
      } as any);
      if (updateErr) {
        console.error('Error updating existing auth user (resend):', updateErr);
        res.status(503).json({ message: 'Failed to update existing user account', error: updateErr });
        return;
      }
      const { error: ensurePlanError } = await upsertUserPlanRecord({
        userId: (existingAuthUser as any).id,
        email: invite.email,
        role: invite.role,
        plan: resolvedResendPlan,
        teamId,
      } as any);
      if (ensurePlanError) {
        console.error('Error syncing plan for existing user (resend):', ensurePlanError);
        res.status(503).json({ message: 'Failed to sync user plan record', error: ensurePlanError });
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
        role: invite.role,
        expiresInHours: TEAM_INVITE_EXPIRATION_HOURS
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
    await supabaseDb
      .from('team_invites')
      .update({ 
        updated_at: new Date().toISOString(),
        status: 'pending',
        expires_at: resendExpiresAt
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

// Public: Accept invite via token and set password
router.post('/invite/:token/accept', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const { password, firstName, lastName } = req.body || {};

    if (!token) {
      res.status(400).json({ message: 'Invite token is required' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters long' });
      return;
    }

    const { data: invite, error: inviteError } = await supabaseDb
      .from('team_invites')
      .select('*')
      .eq('id', token)
      .maybeSingle();

    if (inviteError || !invite) {
      res.status(404).json({ message: 'Invite not found' });
      return;
    }

    if (invite.status && invite.status !== 'pending') {
      res.status(409).json({ message: `Invite already ${invite.status}` });
      return;
    }

    if (isInviteExpired(invite.expires_at)) {
      await supabaseDb
        .from('team_invites')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', token);
      res.status(410).json({ message: 'Invite has expired. Please ask your admin to resend a new invite.' });
      return;
    }

    const resolvedFirstName = (firstName || invite.first_name || '').trim();
    const resolvedLastName = (lastName || invite.last_name || '').trim();

    let inviterContext: { team_id?: string | null; plan?: string | null } | null = null;
    try {
      if (invite.invited_by) {
        const { data: inviterRow } = await supabaseDb
          .from('users')
          .select('team_id, plan')
          .eq('id', invite.invited_by)
          .maybeSingle();
        inviterContext = inviterRow || null;
      }
    } catch (inviterErr) {
      console.warn('[invite accept] failed to load inviter context', inviterErr);
    }

    const resolvedTeamId = (invite as any)?.team_id || inviterContext?.team_id || null;
    const resolvedPlan = resolvePaidPlanLabel(inviterContext?.plan || null);
    const resolvedRole = invite.role || 'member';

    let targetUserId: string | null = null;
    try {
      const { data: publicUser } = await supabaseDb
        .from('users')
        .select('id')
        .eq('email', invite.email)
        .maybeSingle();
      targetUserId = (publicUser as any)?.id || null;
    } catch {}

    let authUser: any = null;
    if (targetUserId) {
      const { data: authUserData } = await supabaseDb.auth.admin.getUserById(targetUserId);
      authUser = authUserData?.user || null;
    }

    if (!authUser) {
      const { data: listData, error: listError } = await supabaseDb.auth.admin.listUsers({ page: 1, perPage: 1000 } as any);
      if (listError) {
        res.status(500).json({ message: 'Failed to load invited user account', error: listError });
        return;
      }
      authUser = (listData?.users || []).find(u => (u.email || '').toLowerCase() === invite.email.toLowerCase());
      targetUserId = authUser?.id || targetUserId;
    }

    if (!authUser || !targetUserId) {
      res.status(404).json({ message: 'Could not locate the invited user account. Please contact support.' });
      return;
    }

    const existingMeta = (authUser.user_metadata || {}) as any;
    const mergedMeta = {
      ...existingMeta,
      first_name: resolvedFirstName || existingMeta.first_name || '',
      last_name: resolvedLastName || existingMeta.last_name || '',
      company: invite.company || existingMeta.company || null,
      team_id: resolvedTeamId || existingMeta.team_id || null,
      invite_id: invite.id,
      invited_by: invite.invited_by,
      role: resolvedRole,
      account_type: resolvedRole,
      onboarding_complete: false
    };

    const { error: updateAuthError } = await supabaseDb.auth.admin.updateUserById(targetUserId, {
      password,
      email_confirm: true,
      user_metadata: mergedMeta
    } as any);

    if (updateAuthError) {
      console.error('[invite accept] failed to update auth user', updateAuthError);
      res.status(500).json({ message: 'Failed to activate invited account', error: updateAuthError });
      return;
    }

    const profileUpdate: Record<string, any> = {
      onboarding_complete: true,
      first_name: resolvedFirstName || null,
      last_name: resolvedLastName || null,
      firstName: resolvedFirstName || null,
      lastName: resolvedLastName || null,
      role: resolvedRole,
      plan: resolvedPlan,
      plan_updated_at: new Date().toISOString()
    };
    if (resolvedTeamId) profileUpdate.team_id = resolvedTeamId;

    try {
      await supabaseDb
        .from('users')
        .upsert(
          {
            id: targetUserId,
            email: invite.email,
            ...profileUpdate
          } as any,
          { onConflict: 'id' }
        );
    } catch (profileErr) {
      console.warn('[invite accept] failed to update user profile', profileErr);
    }

    await syncAuthMetadata(targetUserId, resolvedRole, resolvedPlan, { team_id: resolvedTeamId || invite.team_id || null });

    try {
      await supabaseDb
        .from('team_invites')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', token);
    } catch (inviteUpdateErr) {
      console.warn('[invite accept] failed to update invite status', inviteUpdateErr);
    }

    res.json({ success: true, email: invite.email });
  } catch (error) {
    console.error('Unexpected error accepting invite:', error);
    res.status(500).json({ message: 'Unexpected error accepting invite', error });
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
      .maybeSingle();

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

// Import the new team API handlers
import getTeamSettings from '../api/team/getSettings';
import updateTeamSettings from '../api/team/updateSettings';
import updateTeamRole from '../api/team/updateRole';

// Add the new team API routes
router.get('/getSettings', getTeamSettings);
router.post('/updateSettings', updateTeamSettings);
router.post('/updateRole', updateTeamRole);

export default router; 