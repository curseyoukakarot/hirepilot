import { Request, Response, NextFunction } from 'express';
import { supabaseDb } from '../lib/supabase';
import { CustomUser } from '../types/api';

/**
 * Authenticate requests coming from Zapier/Make (or any third-party)
 * using the "X-API-Key" header. The key is looked up in the
 * `api_keys` table and, if found, the owner's user id is attached
 * to `req.user`. Otherwise the request is rejected with 401.
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const headerKey = req.headers['x-api-key'] as string | undefined;

    if (!headerKey) {
      return res.status(401).json({ error: 'Missing X-API-Key header' });
    }

    // Validate the key in the database
    const { data: apiKeyRow, error } = await supabaseDb
      .from('api_keys')
      .select('user_id')
      .eq('key', headerKey)
      .single();

    if (error || !apiKeyRow) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Attach minimal user context for downstream handlers
    const user: CustomUser = {
      id: apiKeyRow.user_id,
      email: '' // email not required for most server logic
    };

    (req as any).user = user;

    return next();
  } catch (err) {
    console.error('[apiKeyAuth] error validating API key', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 