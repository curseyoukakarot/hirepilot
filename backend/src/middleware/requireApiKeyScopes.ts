import type { Request, Response, NextFunction } from 'express';
import { withApiKeyAuth } from './withApiKeyAuth';

const DEFAULT_SCOPES = ['kanban:read', 'kanban:write', 'webhooks:manage'];

function normalizeScopes(scopes: string[] | undefined | null): string[] {
  if (!scopes || !Array.isArray(scopes)) return [];
  return scopes.map((s) => String(s || '').trim()).filter(Boolean);
}

export function requireApiKeyScopes(requiredScopes: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await withApiKeyAuth(req);
      if (!ctx?.userId) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const keyScopes = normalizeScopes(ctx.scopes);
      const effectiveScopes = keyScopes.length ? keyScopes : DEFAULT_SCOPES;

      const missing = requiredScopes.filter((scope) => !effectiveScopes.includes(scope));
      if (missing.length) {
        return res.status(403).json({ error: 'insufficient_scope', missing });
      }

      (req as any).user = {
        id: ctx.userId,
        email: ctx.user?.email || null,
        role: ctx.user?.role || 'api_key',
        first_name: ctx.user?.first_name || null,
        last_name: ctx.user?.last_name || null,
        plan: ctx.user?.plan || null,
        team_id: ctx.user?.team_id || null,
        _auth_source: ctx.source,
        _api_key_id: ctx.keyId
      };
      (req as any).apiKeyScopes = effectiveScopes;
      return next();
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'api_key_auth_failed' });
    }
  };
}
