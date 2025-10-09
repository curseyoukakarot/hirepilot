import { log } from '../utils/logger';
import { runFullBackfillLoop } from './emailAttributionCore';

(async () => {
  try {
    log.info('Starting full backfill attribution loop...');
    await runFullBackfillLoop();
    log.info('Full backfill finished.');
    process.exit(0);
  } catch (err: any) {
    log.error('Backfill crashed', { err: err?.message });
    process.exit(1);
  }
})();
