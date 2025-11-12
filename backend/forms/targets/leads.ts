import type { FormWithFields } from '../../../shared/types/forms';
import { supabaseDb } from '../../lib/supabase';

export async function createLeadFromFormSubmission(form: FormWithFields, responseId: string) {
  // 1) Fetch submitted values
  const { data: values } = await supabaseDb
    .from('form_response_values')
    .select('field_id, value, json_value, file_url')
    .eq('response_id', responseId);
  const byFieldId: Record<string, any> = {};
  (values || []).forEach((v: any) => {
    byFieldId[v.field_id] = v.value ?? v.json_value ?? v.file_url ?? null;
  });

  // 2) Basic mapping heuristics
  const fields = form.fields || [];
  const findByType = (t: string) => fields.find((f: any) => f.type === t);
  const getVal = (f: any) => (f ? byFieldId[f.id] : null);

  const email = getVal(findByType('email')) || null;
  const phone = getVal(findByType('phone')) || null;

  let firstName: string | null = null;
  let lastName: string | null = null;
  // Prefer labeled name fields
  for (const f of fields) {
    const label = String(f.label || '').toLowerCase();
    if (!firstName && /first/.test(label) && /name/.test(label)) firstName = String(byFieldId[f.id] || '') || null;
    if (!lastName && /last/.test(label) && /name/.test(label)) lastName = String(byFieldId[f.id] || '') || null;
  }
  // Fallback: single "name" field
  if (!firstName && !lastName) {
    const nameField = fields.find((f: any) => String(f.label || '').toLowerCase().includes('name'));
    const full = nameField ? String(byFieldId[nameField.id] || '') : '';
    if (full) {
      const parts = full.trim().split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(' ') || null;
    }
  }

  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || email || 'Unnamed';

  // 3) Avoid duplicate by (user_id, email)
  if (email) {
    const { data: existing } = await supabaseDb
      .from('leads')
      .select('id')
      .eq('user_id', form.user_id)
      .eq('email', email)
      .maybeSingle();
    if (existing) return;
  }

  // 4) Insert lead
  const insert: any = {
    user_id: form.user_id,
    first_name: firstName,
    last_name: lastName,
    name,
    email,
    phone: phone || null,
    source: 'form_submission',
    campaign_id: null,
    created_at: new Date().toISOString(),
  };
  await supabaseDb.from('leads').insert(insert);
  return;
}


