import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import requireAuthUnified from './requireAuthUnified';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Short-circuit if an upstream middleware (e.g., API key) already attached a user
    if ((req as any).user?.id) {
      return next();
    }
    const useUnified = String(process.env.ENABLE_SESSION_COOKIE_AUTH || 'false').toLowerCase() === 'true';
    if (useUnified) {
      // Delegate to unified middleware (supports Bearer or hp_session cookie)
      return requireAuthUnified(req, res, next);
    }

    console.log('Auth headers:', req.headers); // Debug headers
    
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      console.log('Missing or invalid auth header:', auth); // Debug auth header
      res.status(401).json({ error: 'Missing or invalid bearer token' });
      return;
    }

    const token = auth.split(' ')[1];
    console.log('Token received:', token.substring(0, 20) + '...'); // Debug token (safely)

    // Verify token format
    try {
      const decoded = jwt.decode(token);
      console.log('Decoded token:', decoded); // Debug decoded token
    } catch (e) {
      console.error('JWT decode error:', e); // Debug JWT error
      res.status(401).json({ error: 'Malformed JWT' });
      return;
    }

    // Get user from Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    console.log('Supabase auth result:', { user: user?.id, error }); // Debug Supabase result
    
    if (error || !user) {
      console.error('Auth error:', error);
      res.status(401).json({ error: error?.message ?? 'Unauthorized' });
      return;
    }

    // Attach user to request object in a common property
    const appRole = (user.user_metadata as any)?.role || (user.user_metadata as any)?.account_type || user.role;
    (req as any).user = {
      id: user.id,
      email: user.email,
      role: appRole,
      first_name: (user.user_metadata as any)?.first_name,
      last_name: (user.user_metadata as any)?.last_name,
    };

    // Best-effort: if this user has a pending team invite, accept it on first auth'd request.
    // This keeps the UI consistent (invites stop showing "Pending" once the user logs in)
    // and ensures membership tables are populated even if the user doesn't complete onboarding.
    try {
      const email = (user.email || '').toLowerCase();
      if (email) {
        const { data: invite } = await supabase
          .from('team_invites')
          .select('id, team_id, invited_by, expires_at, status')
          .eq('email', email)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const inviteId = (invite as any)?.id || null;
        let teamId = (invite as any)?.team_id || null;
        const invitedBy = (invite as any)?.invited_by || null;
        const expiresAt = (invite as any)?.expires_at || null;
        const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

        // If invite doesn't have team_id populated (older rows), infer it from inviter's users.team_id
        if (!teamId && invitedBy) {
          try {
            const { data: inviterRow } = await supabase.from('users').select('team_id').eq('id', invitedBy).maybeSingle();
            teamId = (inviterRow as any)?.team_id || null;
          } catch {}
        }

        // If the user can authenticate, we treat the invite as accepted (even if expired).
        // Expiration is primarily for the join-link UX; the account/password was already provisioned.
        if (inviteId) {
          // Some envs don't have team_invites.updated_at; retry without it if missing.
          const upd = await supabase
            .from('team_invites')
            .update({ status: 'accepted', updated_at: new Date().toISOString() } as any)
            .eq('id', inviteId);
          if (upd.error && (upd.error as any).code === '42703') {
            await supabase.from('team_invites').update({ status: 'accepted' } as any).eq('id', inviteId);
          } else if (upd.error) {
            throw upd.error;
          }

          if (teamId) {
            // Ensure public.users exists and has team_id set
            await supabase
              .from('users')
              .upsert({ id: user.id, email: user.email, team_id: teamId } as any, { onConflict: 'id' });

            // Ensure team_members exists (if table exists in env)
            try {
              await supabase
                .from('team_members')
                .upsert([{ team_id: teamId, user_id: user.id }], { onConflict: 'team_id,user_id' } as any);
            } catch {}
          }
        }
      }
    } catch (e) {
      // Never block the request on invite housekeeping
      console.warn('[auth] invite auto-accept failed', e);
    }
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 🔧 EXPORT ALIAS - Fix import errors
export const authMiddleware = requireAuth;
