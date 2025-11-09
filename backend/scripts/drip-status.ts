#!/usr/bin/env ts-node
/**
 * Drip Status CLI
 *
 * Shows, in near real-time, which users are on the drip campaigns,
 * which emails they've received, and which are queued to be delivered.
 *
 * Usage:
 *   ts-node backend/scripts/drip-status.ts [--user EMAIL_OR_ID] [--plan free|paid] [--json]
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL must be set.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { dripQueue } from '../src/queues/dripQueue';

type Args = {
  user?: string;
  plan?: 'free' | 'paid';
  json?: boolean;
};

function parseArgs(): Args {
  const args: Args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--user') args.user = argv[++i];
    else if (a === '--plan') args.plan = argv[++i] as any;
    else if (a === '--json') args.json = true;
  }
  return args;
}

function fmt(ts?: string | number | null): string {
  if (!ts && ts !== 0) return '';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

async function main() {
  const { user, plan, json } = parseArgs();
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1) Load users (filter by email/id or plan if provided)
  let userQuery = supabase.from('users').select('id,email,plan,firstName,lastName').order('created_at', { ascending: false });
  if (plan) userQuery = userQuery.eq('plan', plan);
  const { data: users, error: usersErr } = await (user
    ? supabase.from('users')
        .select('id,email,plan,firstName,lastName')
        .or(`id.eq.${user},email.ilike.%${user}%`)
        .order('created_at', { ascending: false })
    : userQuery);
  if (usersErr) throw usersErr;

  // 2) Get queued jobs once and bucket by user_id
  const jobs = await dripQueue.getJobs(['waiting','delayed','active','completed','failed'], 0, 1000);
  const byUser: Record<string, any[]> = {};
  for (const j of jobs) {
    const uid = (j as any)?.data?.user_id;
    if (!uid) continue;
    if (!byUser[uid]) byUser[uid] = [];
    const state = (j as any).state || (typeof (j as any).getState === 'function' ? await (j as any).getState() : 'unknown');
    byUser[uid].push({
      id: j.id,
      template: (j as any)?.data?.template,
      event_key: (j as any)?.data?.event_key,
      state,
      scheduled_at: fmt((j as any).timestamp),
      delay_ms: (j as any).delay ?? 0,
      next_run_at: fmt((j as any).timestamp ? (j as any).timestamp + ((j as any).delay || 0) : null),
      failed_reason: (j as any).failedReason || null,
      finished_on: fmt((j as any).finishedOn || null),
    });
  }

  const dripKeys = [
    'drip.free.campaign','drip.free.rex','drip.free.csv','drip.free.extension','drip.free.requests','drip.free.leads',
    'drip.paid.agent','drip.paid.rex','drip.paid.deals','drip.paid.leads','drip.paid.candidates','drip.paid.reqs'
  ];

  // 3) For each user gather sent rows
  const results: any[] = [];
  for (const u of users || []) {
    const { data: sentRows } = await supabase
      .from('email_events')
      .select('event_key,template,event_timestamp,created_at')
      .eq('user_id', u.id)
      .in('event_key', dripKeys as any)
      .order('created_at', { ascending: false })
      .limit(100);
    const jobsForUser = (byUser[u.id] || []);
    const queued = jobsForUser.filter(j => ['waiting','delayed','active'].includes(j.state));
    const failed = jobsForUser.filter(j => j.failed_reason);
    const completed = jobsForUser.filter(j => j.state === 'completed');
    results.push({
      id: u.id,
      email: u.email,
      plan: u.plan,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim(),
      sent: sentRows || [],
      queued,
      completed,
      failed
    });
  }

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.log(`\n=== ${r.email} (${r.plan}) [${r.id}] ===`);
      console.log(`Sent (${(r.sent || []).length}):`);
      for (const s of (r.sent || [])) {
        console.log(`  - ${s.event_key} | ${s.template} | sent_at=${fmt(s.event_timestamp || s.created_at)}`);
      }
      console.log(`Queued (${(r.queued || []).length}):`);
      for (const q of (r.queued || [])) {
        console.log(`  - ${q.event_key} | ${q.template} | state=${q.state} | next_run_at=${q.next_run_at}`);
      }
      if ((r.failed || []).length) {
        console.log(`Failed (${(r.failed || []).length}):`);
        for (const f of r.failed) {
          console.log(`  - ${f.event_key} | ${f.template} | reason=${f.failed_reason}`);
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


