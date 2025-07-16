import { Queue } from 'bullmq';

let queue: Queue | null = null;

// Initialize Redis queue if Redis is configured
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  const connectionOptions = process.env.REDIS_URL
    ? { connection: require('ioredis')(process.env.REDIS_URL) }
    : {
        connection: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379')
        }
      };

  queue = new Queue('email-sync', connectionOptions);

  // Schedule recurring jobs
  async function scheduleJobs() {
    try {
      // Gmail watch refresh removed for CASA compliance
      // Gmail notifications require gmail.readonly scope which is no longer requested

      // Schedule Outlook subscription refresh (every 23 hours)
      await scheduleOutlookSubscriptionRefresh();
      
      console.log('Email sync jobs scheduled successfully');
    } catch (error) {
      console.error('Error scheduling email sync jobs:', error);
    }
  }

  scheduleJobs();
}

/**
 * Schedule Outlook subscription refresh job
 */
async function scheduleOutlookSubscriptionRefresh() {
  if (!queue) return;
  
  await queue.add('refresh-outlook-subscription', {}, {
    repeat: { pattern: '0 */23 * * *' }, // Every 23 hours
    removeOnComplete: 10,
    removeOnFail: 5
  });
}

export { queue }; 