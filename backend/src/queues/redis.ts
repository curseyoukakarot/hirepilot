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
export const schedulerNotifyQueue = new Queue('scheduler:notify', { connection });
export const sniperQueue = new Queue('sniper:capture', { connection });
export const sniperOpenerQueue = new Queue('sniper:opener', { connection });
export const sniperJobsQueue = new Queue('sniper:jobs', { connection });
export const sniperV1Queue = new Queue('sniper:v1', { connection });
export const jobseekerAgentQueue = new Queue('jobseeker:agent', { connection });
export const candidateEnrichQueue = new Queue('candidate:enrich', { connection });
export const LINKEDIN_REMOTE_ACTION_QUEUE = 'linkedin:remote_action';
export const linkedinRemoteActionQueue = new Queue(LINKEDIN_REMOTE_ACTION_QUEUE, { connection });
