import { supabaseDb } from '../../lib/supabase';

export async function getUsageRow(userId: string, workspaceId: string | null, day: string) {
  const { data, error } = await supabaseDb
    .from('jobseeker_cloud_engine_usage_daily')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('day', day)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function incrementUsage(
  userId: string,
  workspaceId: string | null,
  day: string,
  patch: { job_pages_read?: number; profiles_read?: number }
) {
  const current = await getUsageRow(userId, workspaceId, day);
  const nextJobPages = Number(current?.job_pages_read || 0) + Number(patch.job_pages_read || 0);
  const nextProfiles = Number(current?.profiles_read || 0) + Number(patch.profiles_read || 0);
  const row: any = {
    user_id: userId,
    workspace_id: workspaceId,
    day,
    job_pages_read: nextJobPages,
    profiles_read: nextProfiles,
    last_updated_at: new Date().toISOString()
  };
  const { data, error } = await supabaseDb
    .from('jobseeker_cloud_engine_usage_daily')
    .upsert(row, { onConflict: 'user_id,workspace_id,day' } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}
