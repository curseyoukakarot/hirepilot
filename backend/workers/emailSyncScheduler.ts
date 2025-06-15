import { Queue } from 'bullmq';

// Create queue
export const queue = new Queue('email-sync', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

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
  try {
    // Clear existing jobs
    await queue.obliterate({ force: true });

    // Schedule new jobs
    await Promise.all([
      scheduleGmailWatchRefresh(),
      scheduleOutlookSubscriptionRefresh()
    ]);

    console.log('Email sync scheduler initialized');
  } catch (error) {
    console.error('Error initializing email sync scheduler:', error);
  }
} 