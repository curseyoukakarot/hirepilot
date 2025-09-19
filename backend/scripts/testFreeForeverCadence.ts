import 'dotenv/config';
import { freeForeverQueue } from '../jobs/freeForeverCadence';

async function main() {
  const email = process.env.TEST_EMAIL || 'test@demo.com';
  const first_name = process.env.TEST_FIRST_NAME || 'Demo';
  await freeForeverQueue.add('step-0', { email, first_name, step: 0 });
  console.log('Enqueued Free Forever cadence for', { email, first_name });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


