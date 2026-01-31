import { Request, Response, NextFunction } from 'express';
import { supabaseDb } from '../lib/supabase';

export async function attachTeam(req: Request, _res: Response, next: NextFunction) {
  try {
    // auth middleware (supabase-jwt) populates req.auth?.user on protected routes
    // some routes are public; we only attach when user is present
    const userId = (req as any).auth?.user?.id;
    if (process.env.LOG_REQUESTS === 'true') {
      console.log('[teamContext] enter', { path: req.path, hasUser: Boolean(userId) });
    }
    if (!userId) return next();

    const { data, error } = await supabaseDb
      .from('users')
      .select('team_id')
      .eq('id', userId)
      .single();

    if (!error && data?.team_id) {
      (req as any).teamId = data.team_id;
    }
  } catch (_) {
    /* ignore; fallback will be undefined */
  }
  next();
} 