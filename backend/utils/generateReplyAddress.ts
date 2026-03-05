import { newReplyToken } from '../lib/replyToken';
import { createClient } from '@supabase/supabase-js';

export const REPLY_DOMAIN =
  process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com';

export function generateUniqueReplyToken(length = 12): string {
  return newReplyToken(length);
}

export function buildReplyToAddress(token: string, domain?: string): string {
  // Using plus-addressing to match existing inbound parser
  return `reply+${token}@${domain || REPLY_DOMAIN}`;
}

// In-memory cache for custom reply domains (60s TTL)
const domainCache = new Map<string, { domain: string; expiry: number }>();

// Lazy-init supabase client to avoid circular dependency issues
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabase;
}

/**
 * Resolves the reply domain for a given user.
 * Returns their custom domain if verified, otherwise the default REPLY_DOMAIN.
 * Uses a 60-second in-memory cache to minimize DB queries.
 */
export async function resolveReplyDomain(userId: string): Promise<string> {
  if (!userId) return REPLY_DOMAIN;

  const cached = domainCache.get(userId);
  if (cached && cached.expiry > Date.now()) return cached.domain;

  try {
    const { data } = await getSupabase()
      .from('custom_reply_domains')
      .select('domain')
      .eq('user_id', userId)
      .eq('status', 'verified')
      .maybeSingle();

    const domain: string = (data as any)?.domain || REPLY_DOMAIN;
    domainCache.set(userId, { domain, expiry: Date.now() + 60_000 });
    return domain;
  } catch {
    // On any error, fall back to default domain
    return REPLY_DOMAIN;
  }
}

/**
 * Invalidate the cached domain for a user (call on domain save/delete).
 */
export function invalidateReplyDomainCache(userId: string): void {
  domainCache.delete(userId);
}
