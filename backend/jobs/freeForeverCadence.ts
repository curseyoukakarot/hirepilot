import { Queue, Worker, JobsOptions } from 'bullmq';
import { sendEmail } from '../lib/sendEmail';
import IORedis from 'ioredis';
import dayjs from 'dayjs';
import businessDays from 'dayjs-business-days';

dayjs.extend(businessDays as any);

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined
});

export interface FreeForeverJobData {
  email: string;
  first_name: string;
  step: 0 | 1 | 2;
}

export const freeForeverQueue = new Queue<FreeForeverJobData>('free-forever-cadence', { connection });

// Worker to process cadence steps
export const freeForeverWorker = new Worker<FreeForeverJobData>(
  'free-forever-cadence',
  async (job) => {
    const { email, first_name, step } = job.data;

    if (step === 0) {
      await sendEmail(email, '🎉 Your Free HirePilot Account is Live!', 'welcome.html', { first_name });
      const nextAt = (dayjs() as any).businessDaysAdd(2);
      const opts: JobsOptions = { delay: Math.max(nextAt.diff(dayjs()), 0) }; // +2 business days
      await freeForeverQueue.add('step-1', { email, first_name, step: 1 }, opts);
    } else if (step === 1) {
      await sendEmail(email, 'How to make the most of your free account', 'getMostOut.html', { first_name });
      const nextAt = (dayjs() as any).businessDaysAdd(2);
      const opts: JobsOptions = { delay: Math.max(nextAt.diff(dayjs()), 0) }; // +2 business days
      await freeForeverQueue.add('step-2', { email, first_name, step: 2 }, opts);
    } else if (step === 2) {
      await sendEmail(email, 'Scale your hiring with integrations + AI 🚀', 'scale.html', { first_name });
    }
  },
  { connection }
);


