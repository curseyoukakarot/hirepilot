import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import pb from '../lib/phantombuster';
import { z } from 'zod';
import { createHash } from 'crypto';
import { notifySlack, SlackMessages } from '../lib/slack';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY?.slice(0, 32) || 'default_key_32_bytes_long_123456';
const IV_LENGTH = 16;

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const PbArg = z.object({
  sessionCookie: z.string().min(10),
  queries: z.string().url().min(20),
  searchType: z.literal('people'),
  numberOfProfiles: z.number().int().positive().max(100).optional(),
  pageLoadDelay: z.number().int().positive().min(8000).optional(),
  profileLoadDelay: z.number().int().positive().min(5000).optional(),
  proxy: z.any().optional()
});

function hashCookie(cookie: string): string {
  return createHash('sha1').update(cookie).digest('hex');
}

// Add PB API request/response logging
if (pb.client && pb.client.interceptors) {
  pb.client.interceptors.request.use(r => {
    console.log('[PB OUT]', r.method?.toUpperCase(), r.url, r.data);
    return r;
  });
  pb.client.interceptors.response.use(r => {
    console.log('[PB IN ]', r.status, r.data);
    return r;
  });
}

const redisUrl = process.env.REDIS_URL;
let worker: Worker | null = null;

if (redisUrl) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  worker = new Worker('launch-campaign', async (job: Job) => {
    const { campaignId, userId } = job.data;
    console.log(`[Worker] Starting job ${job.id} for campaign ${campaignId} (user ${userId})`);
    
    try {
      // 1. Fetch campaign details
      console.log('[Worker] Fetching campaign details...');
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      if (campaignError) throw new Error(`Failed to fetch campaign: ${campaignError.message}`);
      if (!campaign) throw new Error('Campaign not found');
      
      console.log('[Worker] Campaign details:', { 
        id: campaign.id, 
        name: campaign.name,
        status: campaign.status 
      });

      // 2. Get LinkedIn cookie
      console.log('[Worker] Fetching LinkedIn cookie...');
      const { data: cookieData, error: cookieError } = await supabase
        .from('linkedin_cookies')
        .select('encrypted_cookie')
        .eq('user_id', userId)
        .single();
      
      if (cookieError) throw new Error(`Failed to fetch LinkedIn cookie: ${cookieError.message}`);
      if (!cookieData?.encrypted_cookie) throw new Error('No LinkedIn cookie found');
      
      const sessionCookie = decrypt(cookieData.encrypted_cookie);
      console.log('[Worker] LinkedIn cookie decrypted successfully');

      // 3. Build PhantomBuster args
      console.log('[Worker] Building PhantomBuster arguments...');
      const pbArgs = {
        sessionCookie,
        queries: campaign.linkedin_search_url,
        searchType: 'people' as const,
        numberOfProfiles: 50,
        pageLoadDelay: 8000,
        profileLoadDelay: 5000
      };

      // 4. Launch PhantomBuster
      const pbKey = process.env.PHANTOMBUSTER_API_KEY || 'none';
      console.log('[dbg] using PB key', pbKey.slice(0, 6) + '…');
      console.log('[dbg] launch agent', 'linkedin-sales-navigator-search');
      console.log('[Worker] Launching PhantomBuster...');
      const result = await pb.launch({
        id: 'linkedin-sales-navigator-search',
        argument: pbArgs,
        saveArgument: true
      });
      console.log('[Worker] PhantomBuster launch result:', result);

      // 7️⃣ Sanity loop: fetch container status
      if (result && result.id) {
        await new Promise(r => setTimeout(r, 5000)); // PB needs a sec
        const info = await pb.client.get('/api/v2/containers/fetch', { params: { id: result.id } });
        if (!info.data || info.data.status === 'error') {
          throw new Error(`PB container failed: ${info.data?.error}`);
        }
        console.log('[Worker] PB container status:', info.data.status);
      } else {
        throw new Error('No containerId returned from PB launch');
      }

      // 5. Update campaign status
      console.log('[Worker] Updating campaign status...');
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ 
          status: 'running',
          phantom_id: result.id,
          started_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (updateError) throw new Error(`Failed to update campaign: ${updateError.message}`);

      console.log('[Worker] Campaign launched successfully!');
      return { ok: true, phantomId: result.id };
    } catch (error: any) {
      console.error('[Worker] Error launching campaign:', error);
      // Update campaign status to failed
      await supabase
        .from('campaigns')
        .update({ 
          status: 'failed',
          error: error.message
        })
        .eq('id', campaignId);
      throw error;
    }
  }, { connection });
}

if (worker) {
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err);
  });
}

export default worker; 