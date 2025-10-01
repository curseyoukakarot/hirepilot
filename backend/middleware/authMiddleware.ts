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
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 🔧 EXPORT ALIAS - Fix import errors
export const authMiddleware = requireAuth;
