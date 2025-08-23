import { Worker } from 'bullmq';
import { connection } from '../src/queues/redis';
import { scheduleCampaign, generateSequenceForCampaign } from '../src/services/sourcing';

// Campaign queue worker to process campaign operations
const campaignWorker = new Worker('campaignQueue', async (job) => {
  const { type, campaignId, params } = job.data;
  
  try {
    switch (type) {
      case 'schedule':
        const result = await scheduleCampaign(campaignId);
        console.log(`✅ Campaign ${campaignId} scheduled: ${result.scheduled} leads`);
        return result;
        
      case 'generateSequence':
        const sequence = await generateSequenceForCampaign(campaignId, params);
        console.log(`✅ Sequence generated for campaign ${campaignId}`);
        return sequence;
        
      default:
        throw new Error(`Unknown campaign job type: ${type}`);
    }
  } catch (error) {
    console.error(`❌ Campaign job failed for ${campaignId}:`, error);
    throw error;
  }
}, { connection });

campaignWorker.on('completed', (job) => {
  console.log(`📋 Campaign job ${job.id} completed for ${job.data.campaignId}`);
});

campaignWorker.on('failed', (job, err) => {
  console.error(`💥 Campaign job ${job?.id} failed:`, err);
});

console.log('🚀 Campaign queue worker started');

export default campaignWorker;
