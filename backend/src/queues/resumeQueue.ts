import { Queue, Worker } from 'bullmq';
import { connection } from './redis';

export const resumeQueue = new Queue('resume-parse', { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } });

export function startResumeWorker(processor: (data: any) => Promise<any>) {
  const concurrency = Number(process.env.AI_PARSE_CONCURRENCY || 3);
  const worker = new Worker('resume-parse', async (job) => processor(job.data), { connection, concurrency });
  worker.on('failed', (job, err) => console.error('[resume-parse] failed', job?.id, err));
  worker.on('completed', (job) => console.log('[resume-parse] completed', job.id));
  return worker;
}


