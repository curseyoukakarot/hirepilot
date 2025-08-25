import { Worker } from 'bullmq';
import dayjs from 'dayjs';
import { connection } from '../queues/redis';
import { captureOnce } from '../services/sniper';

export const sniperWorker = new Worker('sniper:capture', async (job) => {
  const { targetId } = job.data as { targetId: string };
  const res = await captureOnce(targetId);
  const delayMin = 30 + Math.floor(Math.random() * 30); // 30–60 min
  const nextDelay = dayjs().add(delayMin, 'minute').diff(dayjs(), 'millisecond');
  await job.queue.add('capture', { targetId }, { delay: Math.max(10_000, nextDelay) });
  return res;
}, { connection });


