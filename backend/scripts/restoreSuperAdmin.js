/**
 * Emergency restore script: set a user back to super_admin in BOTH:
 * - public.users (role/plan/account_type/primary_app)
 * - Supabase Auth metadata (user_metadata + app_metadata)
 *
 * Usage:
 *   node backend/scripts/restoreSuperAdmin.js 02a42d5c-0f65-4c58-8175-8304610c2ddc
 *
 * Requires env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const userId = process.argv[2];
if (!userId) {
  console.error('Missing user id. Usage: node backend/scripts/restoreSuperAdmin.js <userId>');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  console.log('[restoreSuperAdmin] starting', { userId });

  // 1) Read auth user
  const { data: authRes, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr) throw authErr;
  const authUser = authRes.user;
  if (!authUser) throw new Error('auth user not found');

  // 2) Update public.users (do not touch unrelated columns)
  const { data: before } = await supabase.from('users').select('id,email,role,plan,account_type,primary_app').eq('id', userId).maybeSingle();
  console.log('[restoreSuperAdmin] users before', before || null);

  const { data: updated, error: upErr } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        email: authUser.email,
        role: 'super_admin',
        plan: 'admin',
        account_type: 'super_admin',
        primary_app: 'recruiter',
      },
      { onConflict: 'id' }
    )
    .select('id,email,role,plan,account_type,primary_app')
    .maybeSingle();
  if (upErr) throw upErr;
  console.log('[restoreSuperAdmin] users after', updated || null);

  // 3) Update Supabase Auth metadata
  const nextUserMeta = { ...(authUser.user_metadata || {}) };
  nextUserMeta.role = 'super_admin';
  nextUserMeta.account_type = 'super_admin';

  const nextAppMeta = { ...(authUser.app_metadata || {}) };
  nextAppMeta.role = 'super_admin';
  // Preserve any existing allowed_roles, ensure super_admin is included
  const allowed = new Set([].concat(nextAppMeta.allowed_roles || []));
  allowed.add('super_admin');
  nextAppMeta.allowed_roles = Array.from(allowed);

  const { data: authUpd, error: authUpdErr } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: nextUserMeta,
    app_metadata: nextAppMeta,
  });
  if (authUpdErr) throw authUpdErr;

  console.log('[restoreSuperAdmin] auth updated', {
    id: authUpd?.user?.id,
    email: authUpd?.user?.email,
    user_metadata: authUpd?.user?.user_metadata,
    app_metadata: authUpd?.user?.app_metadata,
  });

  console.log('[restoreSuperAdmin] done ✅');
}

main().catch((e) => {
  console.error('[restoreSuperAdmin] failed', e?.message || e);
  process.exit(1);
});


