import { sniperSupabaseDb } from './supabase';

export type UserLinkedInAuthRow = {
  user_id: string;
  workspace_id: string;
  airtop_profile_id: string | null;
  airtop_last_auth_at: string | null;
  browserbase_context_id: string | null;
  browserbase_last_auth_at: string | null;
  local_li_at: string | null;
  local_jsessionid: string | null;
  status: 'ok' | 'needs_reauth' | 'checkpointed';
  updated_at: string;
};

export async function getUserLinkedinAuth(userId: string, workspaceId: string): Promise<UserLinkedInAuthRow | null> {
  const { data, error } = await sniperSupabaseDb
    .from('user_linkedin_auth')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function upsertUserLinkedinAuth(userId: string, workspaceId: string, patch: Partial<UserLinkedInAuthRow>) {
  const row: any = { user_id: userId, workspace_id: workspaceId, ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await sniperSupabaseDb
    .from('user_linkedin_auth')
    .upsert(row, { onConflict: 'user_id,workspace_id' } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

export type AirtopAuthSessionRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  airtop_session_id: string;
  airtop_window_id: string;
  airtop_profile_name: string;
  status: 'active' | 'completed' | 'expired';
  created_at: string;
  updated_at: string;
};

export async function createAirtopAuthSession(row: {
  user_id: string;
  workspace_id: string;
  airtop_session_id: string;
  airtop_window_id: string;
  airtop_profile_name: string;
}): Promise<AirtopAuthSessionRow> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_airtop_auth_sessions')
    .insert({
      ...row,
      status: 'active'
    } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

export async function getAirtopAuthSession(id: string): Promise<AirtopAuthSessionRow | null> {
  const { data, error } = await sniperSupabaseDb.from('sniper_airtop_auth_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function markAirtopAuthSession(id: string, status: AirtopAuthSessionRow['status']) {
  const { error } = await sniperSupabaseDb
    .from('sniper_airtop_auth_sessions')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Browserbase auth sessions
// ---------------------------------------------------------------------------

export type BrowserbaseAuthSessionRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  browserbase_session_id: string;
  browserbase_context_id: string;
  status: 'active' | 'completed' | 'expired';
  created_at: string;
  updated_at: string;
};

export async function createBrowserbaseAuthSession(row: {
  user_id: string;
  workspace_id: string;
  browserbase_session_id: string;
  browserbase_context_id: string;
}): Promise<BrowserbaseAuthSessionRow> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_browserbase_auth_sessions')
    .insert({ ...row, status: 'active' } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

export async function getBrowserbaseAuthSession(id: string): Promise<BrowserbaseAuthSessionRow | null> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_browserbase_auth_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function markBrowserbaseAuthSession(id: string, status: BrowserbaseAuthSessionRow['status']) {
  const { error } = await sniperSupabaseDb
    .from('sniper_browserbase_auth_sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}


