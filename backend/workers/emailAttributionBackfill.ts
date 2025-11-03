import { runFullBackfillLoop } from './emailAttributionCore';
import { log } from '../utils/logger';

async function main() {
  try {
    log.info('[Email Attribution Backfill] starting...');
    const startedAt = Date.now();
    await runFullBackfillLoop();
    log.info('[Email Attribution Backfill] complete', { ms: Date.now() - startedAt });
    process.exit(0);
  } catch (err: any) {
    log.error('[Email Attribution Backfill] failed', { err: err?.message });
    process.exit(1);
  }
}

// Execute when invoked via npm script
void main();

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
