import { Worker } from 'bullmq';
import { connection } from '../queues/redis';
import { processSniperOpenersBatch } from '../services/sniper.opener';

export const sniperOpenerWorker = new Worker('sniper:opener', async (job) => {
  const { targetId } = job.data as { targetId: string };
  return await processSniperOpenersBatch(targetId);
}, { connection });


