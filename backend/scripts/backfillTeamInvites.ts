import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in environment');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log('[backfill] Starting team invite backfill…');

  const inviteSql = `
    update team_invites ti
    set team_id = inviter.team_id,
        updated_at = now()
    from users inviter
    where ti.team_id is null
      and inviter.id = ti.invited_by
      and inviter.team_id is not null
  `;

  const { error: inviteErr } = await supabaseAdmin.rpc('exec_sql', { sql: inviteSql } as any);
  if (inviteErr) {
    console.error('[backfill] Failed to update team_invites', inviteErr);
    throw inviteErr;
  }
  console.log('[backfill] team_invites updated');

  const userSql = `
    with accepted_invites as (
      select
        lower(ti.email) as email,
        ti.role,
        coalesce(ti.team_id, inviter.team_id) as team_id,
        case
          when inviter.plan ilike 'team%' then 'team'
          when inviter.plan ilike 'pro%' then 'pro'
          when inviter.plan ilike 'starter%' then 'starter'
          when inviter.plan ilike 'recruit%' then 'RecruitPro'
          else coalesce(inviter.plan, 'team')
        end as resolved_plan
      from team_invites ti
      join users inviter on inviter.id = ti.invited_by
      where ti.status = 'accepted'
    )
    update users u
    set
      team_id = coalesce(u.team_id, ai.team_id),
      role = coalesce(ai.role, u.role, 'member'),
      plan = coalesce(ai.resolved_plan, u.plan, 'team'),
      plan_updated_at = now()
    from accepted_invites ai
    where lower(u.email) = ai.email
      and (
        u.team_id is distinct from coalesce(u.team_id, ai.team_id) or
        coalesce(u.role, '') <> coalesce(ai.role, u.role, '') or
        coalesce(u.plan, '') = '' or
        lower(u.plan) = 'free'
      )
  `;

  const { error: userErr } = await supabaseAdmin.rpc('exec_sql', { sql: userSql } as any);
  if (userErr) {
    console.error('[backfill] Failed to update users records', userErr);
    throw userErr;
  }
  console.log('[backfill] users table updated.');
}

run()
  .then(() => {
    console.log('[backfill] Completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('[backfill] Failed', err);
    process.exit(1);
  });

