import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL || 'redis://127.0.0.1:6379';
export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined
});

export const emailQueue = new Queue('emailQueue', { connection });
export const campaignQueue = new Queue('campaignQueue', { connection });
export const sniperQueue = new Queue('sniper:capture', { connection });
export const sniperOpenerQueue = new Queue('sniper:opener', { connection });
