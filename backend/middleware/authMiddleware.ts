import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Auth headers:', req.headers); // Debug headers
    
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      console.log('Missing or invalid auth header:', auth); // Debug auth header
      return res.status(401).json({ error: 'Missing or invalid bearer token' });
    }

    const token = auth.split(' ')[1];
    console.log('Token received:', token.substring(0, 20) + '...'); // Debug token (safely)

    // Verify token format
    try {
      const decoded = jwt.decode(token);
      console.log('Decoded token:', decoded); // Debug decoded token
    } catch (e) {
      console.error('JWT decode error:', e); // Debug JWT error
      return res.status(401).json({ error: 'Malformed JWT' });
    }

    // Get user from Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    console.log('Supabase auth result:', { user: user?.id, error }); // Debug Supabase result
    
    if (error || !user) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: error?.message ?? 'Unauthorized' });
    }

    // Attach user to request object
    (req as any).auth = { user };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
