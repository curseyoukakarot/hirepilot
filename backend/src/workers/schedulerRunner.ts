import { supabaseAdmin } from '../lib/supabaseAdmin';
import { getDueJobs, computeNextRun, markRun } from '../lib/scheduler';
import { executeAction } from '../lib/actions';

const INTERVAL_MS = Number(process.env.CRON_INTERVAL_MS || 60000);

async function lockJob(id: string): Promise<boolean> {
  // Single-replica friendly: allow bypass when RPC isn't available
  if (process.env.DISABLE_SCHED_LOCK === '1') return true;
  try {
    const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: `select pg_try_advisory_lock(${hash}) as ok` } as any);
    if (error) return true; // fail-open when RPC not installed
    const ok = Array.isArray(data) ? (data[0] as any)?.ok : (data as any)?.ok;
    return !!ok;
  } catch {
    return true;
  }
}

async function unlockJob(id: string) {
  if (process.env.DISABLE_SCHED_LOCK === '1') return;
  try {
    const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
    await supabaseAdmin.rpc('exec_sql', { sql: `select pg_advisory_unlock(${hash})` } as any);
  } catch {}
}

async function tick() {
  const now = new Date();
  try {
    const due = await getDueJobs(now);
    if (due.length) {
      console.log(JSON.stringify({ event: 'due_jobs', count: due.length, at: now.toISOString() }));
    }
    for (const job of due) {
      const locked = await lockJob(job.id);
      if (!locked) continue;
      try {
        console.log(JSON.stringify({ event: 'run_start', job_id: job.id, when: now.toISOString() }));
        const result = await executeAction(job);
        const next = computeNextRun(job);
        await markRun(job.id, { ranAt: now, nextRunAt: next ? new Date(next) : null, runResult: result });
        console.log(JSON.stringify({ event: 'run_end', job_id: job.id, result, next_run_at: next }));
      } catch (e: any) {
        console.error(JSON.stringify({ event: 'run_error', job_id: job.id, error: e?.message || String(e) }));
      } finally {
        await unlockJob(job.id);
      }
    }
  } catch (e: any) {
    console.error(JSON.stringify({ event: 'tick_error', error: e?.message || String(e) }));
  }
}

console.log('[schedulerWorker] starting with interval', INTERVAL_MS, 'ms');
setInterval(tick, INTERVAL_MS);
// run immediately
tick().catch(()=>{});


