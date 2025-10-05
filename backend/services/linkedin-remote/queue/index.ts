import { Queue, Worker, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!);
export const linkedinQueue = new Queue('linkedin_action_queue', { connection });
export const linkedinScheduler = new QueueScheduler('linkedin_action_queue', { connection });

export function startLinkedinWorker(processor: (job: any) => Promise<any>) {
  const w = new Worker('linkedin_action_queue', processor as any, { connection, concurrency: 3 });
  w.on('failed', (job, err) => console.error('LI job failed', job?.id, err));
  return w;
}


