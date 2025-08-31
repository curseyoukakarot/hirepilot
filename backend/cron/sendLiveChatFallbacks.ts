import { supabase } from '../src/lib/supabase';
import { sendEmail } from '../services/emailService';
import express from 'express';

export const router = express.Router();

// Cron-safe endpoint: GET to run, idempotent per session via fallback_sent flag
router.get('/send-live-chat-fallbacks', async (_req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: sessions, error } = await supabase
      .from('rex_live_sessions')
      .select('id, user_email, user_name')
      .is('last_human_reply', null)
      .lt('created_at', fiveMinutesAgo)
      .eq('fallback_sent', false)
      .not('user_email', 'is', null);

    if (error) throw error;

    let sentCount = 0;
    for (const s of sessions || []) {
      const to = s.user_email as string;
      const name = (s.user_name as string) || 'there';
      try {
        await sendEmail(
          to,
          "Sorry we missed you — here's what’s next",
          `Hi ${name},\n\nYou recently reached out to us through the HirePilot assistant, but we missed the chance to reply live.\n\nFeel free to respond to this email or book a demo: https://thehirepilot.com/book\n\n- Team HirePilot`
        );
        await supabase
          .from('rex_live_sessions')
          .update({ fallback_sent: true })
          .eq('id', s.id);
        sentCount++;
      } catch (e) {
        console.error('[sendLiveChatFallbacks] email send failed', e);
      }
    }

    res.json({ ok: true, sent: sentCount });
  } catch (err: any) {
    console.error('[sendLiveChatFallbacks] error', err);
    res.status(500).json({ error: err?.message || 'internal_error' });
  }
});

export default router;


