import { Worker, Job } from 'bullmq';
import { supabase } from '../lib/supabase';
// Note: GmailTrackingService import removed - Gmail notification features disabled for CASA compliance
import { OutlookTrackingService } from '../services/outlookTrackingService';

let worker: Worker | null = null;

if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  const connectionOptions = process.env.REDIS_URL
    ? { connection: require('ioredis')(process.env.REDIS_URL) }
    : {
        connection: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379')
        }
      };

  worker = new Worker('email-sync', async (job: Job) => {
    switch (job.name) {
      // Gmail notification cases removed for CASA compliance
      // case 'refresh-gmail-watch':
      // case 'process-gmail-notification':
      case 'refresh-outlook-subscription':
        await handleOutlookSubscriptionRefresh();
        break;
      case 'process-outlook-notification':
        await handleOutlookNotification(job.data);
        break;
      default:
        console.warn(`Unknown job type: ${job.name}`);
    }
  }, connectionOptions);
}

// Gmail watch refresh handler removed - requires gmail.readonly scope
// async function handleGmailWatchRefresh() { ... }

// Handle Outlook subscription refresh
async function handleOutlookSubscriptionRefresh() {
  try {
    // Get Outlook users with expiring subscriptions
    const { data: users } = await supabase
      .from('outlook_subscriptions')
      .select('user_id')
      .lt('expiration_date', new Date(Date.now() + 24 * 60 * 60 * 1000)); // Less than 24 hours left

    if (!users?.length) return;

    // Refresh subscription for each user
    for (const user of users) {
      try {
        await OutlookTrackingService.setupReplyNotifications(user.user_id);
        console.log(`Refreshed Outlook subscription for user ${user.user_id}`);
      } catch (error) {
        console.error(`Error refreshing Outlook subscription for user ${user.user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in Outlook subscription refresh:', error);
  }
}

// Gmail notification handler removed - requires gmail.readonly scope
// async function handleGmailNotification(data: { userId: string; messageId: string }) { ... }

// Handle Outlook notification
async function handleOutlookNotification(data: { userId: string; messageId: string }) {
  try {
    await OutlookTrackingService.handleWebhookNotification(data.userId, data.messageId);
    console.log(`Processed Outlook notification for message ${data.messageId}`);
  } catch (error) {
    console.error(`Error processing Outlook notification for message ${data.messageId}:`, error);
  }
}

// Handle job completion
worker?.on('completed', (job: Job) => {
  console.log(`Job ${job.name} ${job.id} completed`);
});

// Handle job failure
worker?.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`Job ${job?.name} ${job?.id} failed:`, error);
});

export { worker }; 