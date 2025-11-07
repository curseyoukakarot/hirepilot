import type { VercelRequest } from '@vercel/node';
import { createSupabaseForRequest, getBearerToken, assertAuth } from './supabaseServer';
import { create, all } from 'mathjs';

const math = create(all, {
  matrix: 'Array',
  number: 'number',
});

export type TableSchemaColumn = {
  name: string;
  type: 'text' | 'status' | 'number' | 'date' | 'formula';
  formula?: string;
};

export function getSupabaseAuthed(req: VercelRequest) {
  const token = getBearerToken(req);
  assertAuth(token);
  const supabase = createSupabaseForRequest(req);
  return { supabase, token: token as string };
}

export async function requireUserId(req: VercelRequest) {
  const { supabase, token } = getSupabaseAuthed(req);
  const { data: { user } } = await supabase.auth.getUser(token as any);
  if (!user) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
  return { supabase, userId: user.id };
}

// Evaluate formula columns using column names as variables, e.g. "=Value * 0.9"
export function evaluateFormulas(schema: TableSchemaColumn[], rows: Array<Record<string, any>>) {
  const formulaCols = (schema || []).filter(c => c.type === 'formula' && typeof c.formula === 'string' && c.formula.trim());
  if (!formulaCols.length || !Array.isArray(rows)) return rows;
  const out = rows.map((row) => ({ ...(row || {}) }));
  for (const col of formulaCols) {
    const raw = String(col.formula || '').trim();
    const expr = raw.startsWith('=') ? raw.slice(1) : raw; // strip leading '='
    for (const r of out) {
      // Build scope with sanitized numeric conversions where applicable
      const scope: Record<string, any> = {};
      for (const k of Object.keys(r)) {
        const v = (r as any)[k];
        const num = typeof v === 'string' ? Number(String(v).replace(/[^0-9.\-]/g, '')) : v;
        scope[k.replace(/\s+/g, '_')] = Number.isFinite(num) ? num : v;
        scope[k] = Number.isFinite(num) ? num : v; // allow both original and underscored
      }
      try {
        const val = math.evaluate(expr, scope as any);
        (r as any)[col.name] = val;
      } catch {
        // leave as-is if evaluation fails
      }
    }
  }
  return out;
}


