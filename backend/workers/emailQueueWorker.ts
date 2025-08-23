import { Worker } from 'bullmq';
import { connection } from '../src/queues/redis';
import { sendEmail } from '../src/services/sendgrid';

// Email queue worker to process scheduled emails
const emailWorker = new Worker('emailQueue', async (job) => {
  const { to, subject, html, headers } = job.data;
  
  try {
    await sendEmail(to, subject, html, headers);
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return { success: true, to, subject };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw error;
  }
}, { connection });

emailWorker.on('completed', (job) => {
  console.log(`📧 Email job ${job.id} completed for ${job.data.to}`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`💥 Email job ${job?.id} failed:`, err);
});

console.log('🚀 Email queue worker started');

export default emailWorker;
