import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { connection } from '../src/queues/redis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type CandidateEnrichJob = {
  candidateId: string;
  userId: string;
};

async function getSystemSettingBoolean(key: string, defaultValue = false): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) return defaultValue;
    const v: any = data?.value;
    if (typeof v === 'boolean') return v;
    const s = String(v ?? '').trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

async function processJob(job: Job<CandidateEnrichJob>) {
  const { candidateId, userId } = job.data;

  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle();
  if (candErr || !candidate) return { ok: false, error: 'missing_candidate' } as const;

  const skrappApolloFallbackEnabled = await getSystemSettingBoolean('skrapp_apollo_fallback_enabled', false);
  const enrichmentData = candidate.enrichment_data || {};
  let enrichedEmail: string | null = null;
  let enrichmentSource: string | null = null;
  if (enrichmentData.apollo?.email && !String(enrichmentData.apollo.email).includes('email_not_unlocked')) {
    enrichedEmail = enrichmentData.apollo.email;
    enrichmentSource = 'Apollo';
  } else if (enrichmentData.hunter?.email) {
    enrichedEmail = enrichmentData.hunter.email;
    enrichmentSource = 'Hunter.io';
  } else if (skrappApolloFallbackEnabled && enrichmentData.skrapp?.email) {
    enrichedEmail = enrichmentData.skrapp.email;
    enrichmentSource = 'Skrapp.io';
  } else if (enrichmentData.decodo?.email) {
    enrichedEmail = enrichmentData.decodo.email;
    enrichmentSource = 'Decodo';
  }

  if (!enrichedEmail) return { ok: false, error: 'no_enrichment_available' } as const;

  const { data, error } = await supabase
    .from('candidates')
    .update({ email: enrichedEmail, enrichment_source: enrichmentSource, updated_at: new Date().toISOString() })
    .eq('id', candidateId)
    .select('id, lead_id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message } as const;

  if (data?.lead_id) {
    await supabase
      .from('leads')
      .update({ email: enrichedEmail, updated_at: new Date().toISOString() })
      .eq('id', data.lead_id);
  }

  return { ok: true } as const;
}

export function startCandidateEnrichWorker() {
  const worker = new Worker<CandidateEnrichJob>('candidate:enrich', processJob as any, { connection });
  worker.on('failed', (job, err) => console.error('[candidate:enrich] job failed', job?.id, err));
  worker.on('completed', (job) => console.log('[candidate:enrich] job completed', job.id));
  return worker;
}

if (require.main === module) {
  startCandidateEnrichWorker();
}


