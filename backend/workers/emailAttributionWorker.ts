import cron from 'node-cron';
import { log } from '../utils/logger';
import { processBatchSoftTimed } from './emailAttributionCore';

async function tick() {
  try {
    const { scanned, updated } = await processBatchSoftTimed();
    log.info('Attribution cron tick complete', { scanned, updated });
  } catch (err: any) {
    log.error('Attribution cron tick error', { err: err?.message });
  }
}

// Run immediately on boot
tick();

// Schedule: every 4 minutes
cron.schedule('*/4 * * * *', async () => {
  log.info('Attribution cron tick starting...');
  await tick();
});

log.info('Email attribution worker started - running every 4 minutes');
