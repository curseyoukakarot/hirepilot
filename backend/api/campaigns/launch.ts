import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import pb from '../../lib/phantombuster';
import { z } from 'zod';
import { createHash } from 'crypto';
import { notifySlack, SlackMessages } from '../../lib/slack';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Fixed: was SUPABASE_SERVICE_KEY
);

const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY?.slice(0, 32) || 'default_key_32_bytes_long_123456'; // 32 bytes for AES-256
const IV_LENGTH = 16;

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
export const launchQueue = new Queue('launch-campaign', { connection });

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Schema for validating PhantomBuster arguments
const PbArg = z.object({
  sessionCookie: z.string().min(10),
  queries: z.string().url().min(20),
  searchType: z.literal('people'),
  numberOfProfiles: z.number().int().positive().max(100).optional(),
  pageLoadDelay: z.number().int().positive().min(8000).optional(),
  profileLoadDelay: z.number().int().positive().min(5000).optional(),
  proxy: z.literal('auto').optional()
});

// Helper to hash cookie for tracking
function hashCookie(cookie: string): string {
  return createHash('sha1').update(cookie).digest('hex');
}

export async function launchCampaign(req: Request, res: Response) {
  const { id } = req.params;
  const uid = req.headers['x-user-id'];

  console.time('launchRoute');
  res.on('finish', () => console.timeEnd('launchRoute'));

  // quick sanity checks only
  const { data: camp, error } = await supabase
    .from('campaigns')
    .select('id,status,user_id')
    .eq('id', id)
    .maybeSingle();

  if (error)  return res.status(500).json({ error: error.message });
  if (!camp)  return res.status(404).json({ error: 'Campaign not found' });
  if (camp.user_id !== uid) return res.status(403).json({ error: 'Not yours' });
  if (camp.status !== 'ready') return res.status(400).json({ error: 'Not ready' });

  // enqueue job
  const job = await launchQueue.add('launch', { campaignId: id, userId: uid });

  return res.status(202).json({ 
    jobId: job.id,
    run: {
      status: 'queued',
      jobId: job.id
    }
  });
}

export default async function handler(req: Request, res: Response) {
  const id  = req.query.id ?? req.params.id;
  const uid = req.headers['x-user-id'];

  console.log('🛠  launch handler – id:', id, 'uid:', uid);

  /* STEP 1: READ the row, bypassing RLS so we know it's there */
  const { data: row, error: readErr } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle();

  console.log('🛠  select result:', row, readErr);

  if (!row) return res.status(404).json({ error: 'Campaign not found (read)' });

  /* STEP 2: UPDATE the row the same way your real code does */
  const { data: upd, error: updErr, status } = await supabaseAdmin
    .from('campaigns')
    .update({ status: 'launched', launched_at: new Date() })
    .eq('id', id)
    .eq('user_id', uid)              // keep any filters you normally use
    .select('id')
    .maybeSingle();

  console.log('🛠  update result:', upd, updErr, 'statusCode', status);

  if (updErr)  return res.status(500).json({ error: updErr.message });
  if (!upd)    return res.status(404).json({ error: 'Campaign not found (update)' });

  return res.status(200).json({ launched: upd.id });
} 