import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

async function main() {
  const thresholdMin = Number(process.env.SNIPER_WATCHDOG_MINUTES || 30);
  const since = dayjs().subtract(thresholdMin, 'minute').toISOString();
  const { data, error } = await supabase
    .from('sniper_targets')
    .select('id, updated_at')
    .eq('status', 'running')
    .lt('updated_at', since);
  if (error) throw error;
  if (!data || data.length === 0) {
    console.log('Watchdog: no stuck running targets.');
    return;
  }
  for (const t of data) {
    await supabase.from('sniper_targets').update({ status: 'failed' }).eq('id', t.id);
    console.log(`Watchdog: marked target ${t.id} as failed (stuck).`);
  }
}

main().catch((e) => {
  console.error('Watchdog error', e);
  process.exit(1);
});


