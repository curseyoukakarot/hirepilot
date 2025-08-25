import { Worker, Queue } from 'bullmq';
import dayjs from 'dayjs';
import { connection } from '../queues/redis';
import { captureOnce } from '../services/sniper';

// Dedicated queue handle for scheduling next capture
const sniperQueue = new Queue('sniper:capture', { connection });

export const sniperWorker = new Worker('sniper:capture', async (job) => {
  const { targetId } = job.data as { targetId: string };
  const res = await captureOnce(targetId);
  const delayMin = 30 + Math.floor(Math.random() * 30); // 30–60 min
  const nextDelay = dayjs().add(delayMin, 'minute').diff(dayjs(), 'millisecond');
  await sniperQueue.add('capture', { targetId }, { delay: Math.max(10_000, nextDelay) });
  return res;
}, { connection });


