import { Worker } from 'bullmq';
import dayjs from 'dayjs';
import { connection } from './queues';
import { supabase } from '../lib/supabase';

export const salesSweepWorker = new Worker('sales:sweep', async (job) => {
  const { userId, lookback_hours } = job.data as { userId: string; lookback_hours: number };
  const cutoff = dayjs().subtract(lookback_hours, 'hour').toISOString();

  const { data: threads } = await supabase.from('sales_threads')
    .select('id').eq('user_id', userId).eq('status','awaiting_prospect')
    .lte('last_outbound_at', cutoff).limit(50);

  return { candidates: threads?.length || 0 };
}, { connection: connection as any });


