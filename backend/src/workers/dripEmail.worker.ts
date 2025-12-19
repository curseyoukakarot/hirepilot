import { Worker } from 'bullmq';
import { connection } from '../queues/redis';
import { canSendLifecycleEmail } from '../lib/emailSuppressor';
import { sendLifecycleEmail } from '../lib/sendLifecycleEmail';
import { supabase } from '../lib/supabase';

type DripJobData = {
  user_id: string;
  to: string;
  template: string;
  tokens: {
    first_name: string;
    app_url?: string;
    cta_url?: string;
    article_url?: string;
    onboarding_url?: string;
    resume_builder_url?: string;
    landing_page_url?: string;
    year?: string;
    unsubscribe_url?: string;
  };
  event_key?: string;
};

export const dripEmailWorker = new Worker('drip:email', async (job) => {
  const data = job.data as DripJobData;
  if (!data?.user_id || !data?.to || !data?.template) return { skipped: 'invalid' };

  if (!(await canSendLifecycleEmail(data.user_id))) return { suppressed: true };

  await sendLifecycleEmail({
    to: data.to,
    template: data.template,
    tokens: {
      first_name: data.tokens.first_name,
      app_url: data.tokens.app_url,
      cta_url: data.tokens.cta_url,
      article_url: data.tokens.article_url,
      onboarding_url: data.tokens.onboarding_url,
      resume_builder_url: data.tokens.resume_builder_url,
      landing_page_url: data.tokens.landing_page_url,
      year: data.tokens.year,
      unsubscribe_url: data.tokens.unsubscribe_url,
    },
  });

  try {
    await supabase.from('email_events').insert({
      user_id: data.user_id,
      event_key: data.event_key || null,
      template: data.template,
    } as any);
  } catch {}

  return { sent: true };
}, { connection });


