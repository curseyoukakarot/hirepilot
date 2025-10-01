import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'hp_csrf';
const CSRF_HEADER = 'x-csrf-token';

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function csrfIssueToken(req: Request, res: Response) {
  const token = generateCsrfToken();
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 1000
  });
  res.json({ token });
}

/**
 * Minimal double-submit cookie CSRF guard.
 * Enforce only when ENABLE_CSRF=true and method is state-changing.
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  const enabled = String(process.env.ENABLE_CSRF || 'false').toLowerCase() === 'true';
  if (!enabled) return next();
  const method = String(req.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

  // Allow Stripe/Slack webhooks and other raw-body routes to bypass using explicit flag on req
  if ((req as any)._csrfBypass === true) return next();

  const cookieToken = (req as any)?.cookies?.[CSRF_COOKIE];
  const headerToken = String(req.header(CSRF_HEADER) || '');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }
  next();
}

export const CSRF_COOKIE_NAME = CSRF_COOKIE;
export const CSRF_HEADER_NAME = CSRF_HEADER;


