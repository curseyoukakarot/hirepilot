import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

export const connection = new IORedis(process.env.REDIS_URL!, { 
  maxRetriesPerRequest: null, 
  enableReadyCheck: true 
});

export const emailQueue = new Queue('emailQueue', { connection });
export const campaignQueue = new Queue('campaignQueue', { connection });
export const sniperQueue = new Queue('sniper:capture', { connection });
