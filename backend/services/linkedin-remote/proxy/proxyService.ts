import { createClient } from '@supabase/supabase-js';

function safeCreateSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return undefined as any;
  return createClient(url, key);
}

const supabase = safeCreateSupabase();

export async function assignProxyForUser(userId: string) {
  const provider = String(process.env.PROXY_PROVIDER || '').toLowerCase();

  // Decodo provider via env: stable port selection across a range
  if (provider === 'decodo') {
    const host = process.env.DECODO_HOST || 'gate.decodo.com';
    const range = process.env.DECODO_PORT_RANGE || '10001-10010';
    const [startStr, endStr] = range.split('-');
    const start = Number(startStr || 10001);
    const end = Number(endStr || 10010);
    const count = Math.max(1, (end - start + 1));
    const username = process.env.DECODO_USERNAME || process.env.PROXY_USERNAME || '';
    const password = process.env.DECODO_PASSWORD || process.env.PROXY_PASSWORD || '';
    if (!username || !password) return undefined;
    const stableIndex = Math.abs(hashString(userId)) % count;
    const port = start + stableIndex;
    const user = encodeURIComponent(username);
    const pass = encodeURIComponent(password);
    return `http://${user}:${pass}@${host}:${port}`;
  }

  // Generic env fallback
  if (process.env.PROXY_ENDPOINT) {
    const endpoint = process.env.PROXY_ENDPOINT; // host:port
    const authRaw = process.env.PROXY_AUTH || '';
    const [u, p] = authRaw.split(':');
    const user = u ? encodeURIComponent(u) : '';
    const pass = p ? encodeURIComponent(p) : '';
    const auth = authRaw ? `${user}:${pass}@` : '';
    return `http://${auth}${endpoint}`;
  }

  // DB-driven pool (optional)
  if (supabase) {
    const { data } = await supabase
      .from('proxy_pool')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    return data ? formatProxyUrl(data) : undefined;
  }
  return undefined;
}

function formatProxyUrl(p: any) {
  if (!p) return;
  const auth = p.auth ? `${encodeURIComponent(p.auth.split(':')[0])}:${encodeURIComponent(p.auth.split(':')[1] || '')}@` : '';
  return `http://${auth}${p.endpoint}`;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}


