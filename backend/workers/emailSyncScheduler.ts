import { Queue } from 'bullmq';

let queue: Queue | null = null;

if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  // Prefer full URL but fall back to host/port combo
  if (process.env.REDIS_URL) {
    const IORedis = require('ioredis');
    const connection = new IORedis(process.env.REDIS_URL);
    queue = new Queue('email-sync', { connection });
  } else {
    queue = new Queue('email-sync', {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });
  }
} else {
  console.warn('[emailSyncScheduler] Redis not configured – scheduler disabled');
}
export { queue };

/**
 * Schedule Gmail watch refresh job
 */
async function scheduleGmailWatchRefresh() {
  // Schedule job to run every 6 days at midnight
  await queue.add('refresh-gmail-watch', {}, {
    repeat: {
      pattern: '0 0 */6 * *' // Every 6 days at midnight
    }
  });
}

/**
 * Schedule Outlook subscription refresh job
 */
async function scheduleOutlookSubscriptionRefresh() {
  // Schedule job to run every 2 days at midnight
  await queue.add('refresh-outlook-subscription', {}, {
    repeat: {
      pattern: '0 0 */2 * *' // Every 2 days at midnight
    }
  });
}

/**
 * Initialize scheduler
 */
export async function initScheduler() {
  if (!queue) return;
  try {
    await queue.obliterate({ force: true });
    await Promise.all([
      scheduleGmailWatchRefresh(),
      scheduleOutlookSubscriptionRefresh()
    ]);
    console.log('Email sync scheduler initialized');
  } catch (error) {
    console.error('Error initializing email sync scheduler:', error);
  }
} 