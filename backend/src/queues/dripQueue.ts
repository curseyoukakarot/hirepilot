import { Queue } from 'bullmq';
import { connection } from './redis';

export const dripQueue = new Queue('drip:email', { connection });


