import { supabase } from '../lib/supabase';

/**
 * Read a boolean-ish system setting from `system_settings`.
 * Values are typically stored as strings ("true"/"false") but we accept booleans too.
 */
export async function getSystemSettingBoolean(key: string, defaultValue = false): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) return defaultValue;
    const v: any = data?.value;
    if (typeof v === 'boolean') return v;
    const s = String(v ?? '').trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}


