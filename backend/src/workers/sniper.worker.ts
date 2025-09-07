import { Worker, Queue } from 'bullmq';
import dayjs from 'dayjs';
import { connection } from '../queues/redis';
import { captureOnce } from '../services/sniper';
import pTimeout from 'p-timeout';
import { supabase } from '../lib/supabase';

// Dedicated queue handle for scheduling next capture
const sniperQueue = new Queue('sniper:capture', { connection });

export const sniperWorker = new Worker('sniper:capture', async (job) => {
  const { targetId } = job.data as { targetId: string };
  const startedAt = Date.now();
  console.log(JSON.stringify({ scope:'sniper', event:'job_start', targetId, jobId: job.id }));
  const CAPTURE_TIMEOUT_MS = Number(process.env.SNIPER_CAPTURE_TIMEOUT_MS || 180000);
  let res: any;
  try {
    res = await pTimeout(captureOnce(targetId), {
      milliseconds: CAPTURE_TIMEOUT_MS,
      message: 'CAPTURE_TIMEOUT'
    } as any);
  } catch (err: any) {
    console.error(JSON.stringify({ scope:'sniper', event:'job_error', targetId, jobId: job.id, error: String(err?.message || err) }));
    try {
      // Mark target and campaign failed on hard error/timeout
      await supabase.from('sniper_targets').update({ status: 'failed' }).eq('id', targetId);
      const { data } = await supabase.from('sniper_targets').select('campaign_id').eq('id', targetId).maybeSingle();
      const campaignId = (data as any)?.campaign_id;
      if (campaignId) await supabase.from('sourcing_campaigns').update({ status: 'failed' }).eq('id', campaignId);
    } catch {}
    throw err;
  }
  console.log(JSON.stringify({ scope:'sniper', event:'job_done', targetId, jobId: job.id, durationMs: Date.now()-startedAt, result: res }));
  const delayMin = 30 + Math.floor(Math.random() * 30); // 30–60 min
  const nextDelay = dayjs().add(delayMin, 'minute').diff(dayjs(), 'millisecond');
  await sniperQueue.add('capture', { targetId }, { delay: Math.max(10_000, nextDelay) });
  return res;
}, { connection });

// If the process is started as a standalone worker, keep it alive
if (require.main === module) {
  console.log('✅ Sniper worker online (queue: sniper:capture)');
  // Basic env sanity checks
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'REDIS_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(JSON.stringify({ scope:'sniper', event:'env_missing', missing }));
  }
  process.on('uncaughtException', (err) => {
    console.error(JSON.stringify({ scope:'sniper', event:'uncaughtException', error: String(err?.message || err) }));
  });
  process.on('unhandledRejection', (reason: any) => {
    console.error(JSON.stringify({ scope:'sniper', event:'unhandledRejection', error: String((reason && reason.message) || reason) }));
  });
}


