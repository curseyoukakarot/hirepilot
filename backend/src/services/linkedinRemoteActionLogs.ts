import { supabaseDb } from '../lib/supabase';

export type LinkedInRemoteActionLogStatus = 'queued' | 'success' | 'failed';

export interface CreateLinkedInRemoteActionLogInput {
  userId: string;
  action: string;
  linkedinUrl: string;
  jobId?: string | null;
  status?: LinkedInRemoteActionLogStatus;
  error?: string | null;
}

export async function createLinkedInRemoteActionLog(input: CreateLinkedInRemoteActionLogInput): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseDb
    .from('linkedin_remote_action_logs')
    .insert({
      user_id: input.userId,
      action: input.action,
      linkedin_url: input.linkedinUrl,
      job_id: input.jobId ?? null,
      status: input.status ?? 'queued',
      error: input.error ?? null,
      created_at: now,
      updated_at: now
    } as any)
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Failed to create linkedin_remote_action_logs row');
  }
  return String(data.id);
}

export async function updateLinkedInRemoteActionLog(
  id: string,
  patch: Partial<{ status: LinkedInRemoteActionLogStatus; error: string | null; job_id: string | null }>
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseDb
    .from('linkedin_remote_action_logs')
    .update({
      ...patch,
      updated_at: now
    } as any)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function listLatestLinkedInRemoteActionLogs(userId: string, limit = 10) {
  const { data, error } = await supabaseDb
    .from('linkedin_remote_action_logs')
    .select('id,user_id,action,linkedin_url,job_id,status,error,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) throw new Error(error.message);
  return data || [];
}

