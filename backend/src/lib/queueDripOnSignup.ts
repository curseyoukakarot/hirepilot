import { dripCadence, DripPlan } from './dripSchedule';
import { dripQueue } from '../queues/dripQueue';

export async function queueDripOnSignup(user: { id: string; email: string; first_name?: string }, plan: DripPlan) {
  const sequence = dripCadence[plan];
  const appUrl = process.env.APP_URL || 'https://thehirepilot.com';

  for (const { day, key, template } of sequence) {
    const delayMs = day * 24 * 60 * 60 * 1000;
    await dripQueue.add('send', {
      user_id: user.id,
      to: user.email,
      template,
      tokens: { first_name: user.first_name || 'there', app_url: appUrl },
      event_key: key,
    }, { delay: Math.max(0, delayMs) });
  }
}


