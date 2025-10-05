import { startLinkedinWorker } from '../index';
import { createClient } from '@supabase/supabase-js';
import { sendConnection } from '../../automation/actions/sendConnection';
import { assignProxyForUser } from '../../proxy/proxyService';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export function bootLinkedinWorker() {
  return startLinkedinWorker(async (job) => {
    const { type, sessionId, userId, payload } = job.data as { type: string; sessionId: string; userId: string; payload: any };
    const { data: sess, error } = await supabase.from('linkedin_sessions').select('*').eq('id', sessionId).eq('user_id', userId).single();
    if (error || !sess?.cookies_encrypted) throw new Error('Session/cookies unavailable');
    const proxy = await assignProxyForUser(userId);
    if (type === 'send_connection') {
      return await sendConnection(payload, sess.cookies_encrypted, proxy);
    }
    throw new Error(`Unknown job type: ${type}`);
  });
}


