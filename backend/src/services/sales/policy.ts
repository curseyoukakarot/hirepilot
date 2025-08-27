import { supabase } from '../../lib/supabase';

export type SalesPolicy = any;

export async function getPolicyForUser(userId: string): Promise<SalesPolicy> {
  const { data } = await supabase.from('sales_agent_policies').select('policy').eq('user_id', userId).maybeSingle();
  return (data?.policy as any) || { mode: 'handle' };
}
