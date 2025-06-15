import { supabase } from '../lib/supabase';

export async function getLeads() {
  const { data, error } = await supabase.from('leads').select('*');
  if (error) {
    console.error('❌ Error fetching leads:', error.message);
    return [];  // return empty array instead of throwing
  }
  console.log('✅ Leads loaded:', data);
  return data;
}
