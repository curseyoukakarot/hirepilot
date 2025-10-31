import { Worker, Queue } from 'bullmq';
import { connection } from '../queues/redis';
import { supabase } from '../lib/supabase';
import { tryConsume, incrementConcurrency, decrementConcurrency } from '../lib/throttle';

const queueName = 'sniper:jobs';
export const sniperJobsQueue = new Queue(queueName, { connection });

export const sniperJobsWorker = new Worker(queueName, async (job) => {
  const payload = job.data as {
    activityLogId: string;
    sessionId: string;
    source: 'linkedin';
    action: 'sourcing'|'view'|'invite'|'message';
    query: string;
    resolvedSettings: any;
  };

  // Basic placeholder settings
  const capacityPerDay = 100;
  const activeWorkingSeconds = 8 * 60 * 60; // 8 hours
  const concurrencyMax = 2;
  const cost = 1;

  // Update status → running
  await supabase.from('sniper_jobs').update({ status: 'running' }).eq('id', payload.activityLogId);

  const acquired = await incrementConcurrency(payload.sessionId, payload.source, concurrencyMax, 60);
  if (!acquired) {
    // Requeue with short delay if concurrency blocked
    await sniperJobsQueue.add('sniper_job', payload, { delay: 10_000 });
    await supabase.from('sniper_jobs').update({ status: 'queued' }).eq('id', payload.activityLogId);
    return { requeued: true, reason: 'concurrency' } as any;
  }
  try {
    const tokenAttempt = await tryConsume({ sessionId: payload.sessionId, source: payload.source, capacityPerDay, activeWorkingSeconds }, cost);
    if (!tokenAttempt.ok) {
      const delay = Math.max(5_000, tokenAttempt.retryInMs || 30_000);
      await sniperJobsQueue.add('sniper_job', payload, { delay });
      await supabase.from('sniper_jobs').update({ status: 'queued' }).eq('id', payload.activityLogId);
      return { requeued: true, reason: 'tokens', delay } as any;
    }

    // Placeholder: perform the action (stub)
    const result = { ok: true, action: payload.action, processed: Math.min(1, tokenAttempt.remaining + 1) };
    await supabase.from('sniper_jobs').update({ status: 'completed', result }).eq('id', payload.activityLogId);
    return result as any;
  } catch (e: any) {
    await supabase.from('sniper_jobs').update({ status: 'failed', result: { error: e?.message || 'failed' } }).eq('id', payload.activityLogId);
    throw e;
  } finally {
    await decrementConcurrency(payload.sessionId, payload.source);
  }
}, { connection });

if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log('✅ Sniper jobs worker online (queue: sniper:jobs)');
}


