import { createClient } from '@supabase/supabase-js';
import { linkedinQueue } from './index';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function getActiveLinkedinSession(userId: string) {
  const { data, error } = await supabase
    .from('linkedin_sessions')
    .select('id,status,updated_at')
    .eq('user_id', userId)
    .in('status', ['active','pending'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No LinkedIn session found. Please connect in Settings > Integrations.');
  if (data.status !== 'active') throw new Error('LinkedIn session not active yet. Please finish login in the modal.');
  return data.id as string;
}

export async function enqueueLinkedinJob(userId: string, type: 'send_connection'|'scrape_search'|'visit_profile', payload: any) {
  const sessionId = await getActiveLinkedinSession(userId);
  const job = await linkedinQueue.add(type, { type, sessionId, userId, payload }, { removeOnComplete: true, removeOnFail: false });
  return { jobId: job.id, sessionId };
}


