import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);
export const connection = redis as any;

export const salesInboundQueue = new Queue('sales:inbound', { connection });
export const salesSendQueue = new Queue('sales:send', { connection });
export const salesSweepQueue = new Queue('sales:sweep', { connection });


