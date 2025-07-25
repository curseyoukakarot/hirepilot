import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DECODO_BW_QUOTA_GB = Number(process.env.DECODO_BW_QUOTA_GB || 25);
const ALERT_PCT = Number(process.env.DECODO_BW_ALERT_PCT || 0.8);
const SLACK_WEBHOOK = process.env.DECODO_SLACK_WEBHOOK || process.env.SLACK_WEBHOOK_URL;

function bytesToGB(bytes: number) {
  return bytes / 1024 ** 3;
}

async function sendSlackAlert(message: string) {
  if (!SLACK_WEBHOOK) {
    console.warn('[checkDecodoQuota] No Slack webhook configured');
    return;
  }
  try {
    await axios.post(SLACK_WEBHOOK, { text: message });
  } catch (err) {
    console.error('[checkDecodoQuota] Failed to send Slack alert', err);
  }
}

function updateTierOrder(newOrder: string[]) {
  // Persist new tier order by updating .env file so future deploys use it
  const envPath = path.resolve(__dirname, '../../.env');
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch {
    // file might not exist
  }
  const line = `PROXY_TIER_ORDER=${newOrder.join(',')}`;
  if (envContent.includes('PROXY_TIER_ORDER')) {
    envContent = envContent.replace(/PROXY_TIER_ORDER=.*/g, line);
  } else {
    envContent += `\n${line}\n`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log('[checkDecodoQuota] Updated PROXY_TIER_ORDER in .env');
}

async function main() {
  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1); // start of month

  const { data, error } = await supabase
    .from('decodo_bandwidth_log')
    .select('bytes')
    .gte('created_at', cycleStart.toISOString())
    .lte('created_at', now.toISOString());

  if (error) {
    console.error('[checkDecodoQuota] Supabase query failed', error);
    return;
  }

  const usedBytes = data?.reduce((acc, row) => acc + (row.bytes as number), 0) || 0;
  const usedRatio = usedBytes / (DECODO_BW_QUOTA_GB * 1024 ** 3);

  console.log(`[checkDecodoQuota] Used ${bytesToGB(usedBytes).toFixed(2)}GB of ${DECODO_BW_QUOTA_GB}GB (${(usedRatio * 100).toFixed(1)}%)`);

  if (usedRatio > ALERT_PCT) {
    await sendSlackAlert(`⚠️ Decodo bandwidth usage at ${(usedRatio * 100).toFixed(1)}%`);
  }

  if (usedRatio >= 1.0) {
    await sendSlackAlert('🚨 Decodo bandwidth quota exhausted – switching proxy priority');
    updateTierOrder(['local', 'decodo', 'direct']);
  }
}

main().then(() => process.exit()).catch(err => {
  console.error(err);
  process.exit(1);
}); 