import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { LifecycleEventKey } from '../lib/emailEvents';
import { sendLifecycleEmail, LifecycleTokens } from '../lib/sendLifecycleEmail';
import { canSendLifecycleEmail } from '../lib/emailSuppressor';

export const templateMap: Record<LifecycleEventKey, string> = {
  [LifecycleEventKey.Deals]: 'feature-deals',
  [LifecycleEventKey.REX]: 'feature-rex-agent',
  [LifecycleEventKey.Workflows]: 'feature-workflows',
  [LifecycleEventKey.CampaignWizard]: 'feature-campaign-wizard',
  [LifecycleEventKey.Integrations]: 'feature-integrations',
  [LifecycleEventKey.Founder]: 'founder-intro',
};

export async function handleLifecycleEvent(input: {
  userId: string;
  to: string;
  eventKey: LifecycleEventKey;
  tokens: LifecycleTokens;
}) {
  const { userId, to, eventKey, tokens } = input;
  try {
    // Idempotency: if we've ever sent this lifecycle event for the user, skip
    try {
      const { data: existing } = await supabase
        .from('email_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_key', eventKey)
        .limit(1);
      if ((existing || []).length > 0) {
        logger.info({ at: 'featureTriggers.already_sent', userId, eventKey });
        return { skipped: 'already-sent' } as const;
      }
    } catch {}

    if (!(await canSendLifecycleEmail(userId))) {
      logger.info({ at: 'featureTriggers.suppressed', userId, eventKey });
      return { suppressed: true } as const;
    }

    const template = templateMap[eventKey];
    if (!template) {
      logger.warn({ at: 'featureTriggers.no_template', eventKey, userId });
      return { skipped: 'no-template' } as const;
    }

    await sendLifecycleEmail({ to, template, tokens });

    await supabase.from('email_events').insert({
      user_id: userId,
      event_key: eventKey,
      template,
    } as any);

    return { ok: true } as const;
  } catch (err: any) {
    logger.error({ at: 'featureTriggers.error', userId, eventKey, error: err?.message || String(err) });
    return { error: err?.message || 'unknown_error' } as const;
  }
}


