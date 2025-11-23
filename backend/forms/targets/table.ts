import type { FormResponseRecord, FormResponseValueRecord } from '../shared/types/forms';
import { supabaseDb } from '../../lib/supabase';

export async function insertIntoTableFromFormSubmission(form: FormWithFields, responseId: string) {
  try {
    const targetId = (form as any).destination_target_id as string | null | undefined;
    if (!targetId) return;
    // Load target custom table
    const { data: table, error: terr } = await supabaseDb
      .from('custom_tables')
      .select('id,user_id,schema_json,data_json')
      .eq('id', targetId)
      .maybeSingle();
    if (terr) throw terr;
    if (!table) return;
    // Ensure ownership
    if (String(table.user_id) !== String(form.user_id)) {
      console.warn('[forms] Table owner mismatch; skipping insert');
      return;
    }
    // Fetch response values
    const { data: values, error: verr } = await supabaseDb
      .from('form_response_values')
      .select('field_id,value,json_value,file_url')
      .eq('response_id', responseId);
    if (verr) throw verr;
    const fieldIndex = new Map(form.fields.map(f => [f.id, f]));
    // Build a new row object keyed by field label
    const row: Record<string, any> = {};
    for (const v of values || []) {
      const field = fieldIndex.get(v.field_id);
      if (!field) continue;
      const key = field.label || field.id;
      if (v.file_url) row[key] = v.file_url;
      else if (v.json_value != null) row[key] = v.json_value;
      else row[key] = v.value ?? null;
    }
    // Auto-extend schema_json for new labels
    const schema = Array.isArray(table.schema_json) ? [...table.schema_json] : [];
    const ensureCol = (name: string, type: string) => {
      if (!schema.some((c: any) => String(c?.name) === name)) schema.push({ name, type });
    };
    for (const f of form.fields) {
      if (!Object.prototype.hasOwnProperty.call(row, f.label)) continue;
      // Basic type mapping
      let t = 'text';
      if (f.type === 'date') t = 'date';
      else if (f.type === 'rating') t = 'number';
      else if (f.type === 'checkbox') t = 'status';
      ensureCol(f.label, t);
    }
    const data = Array.isArray(table.data_json) ? [...table.data_json, row] : [row];
    const { error: uerr } = await supabaseDb
      .from('custom_tables')
      .update({ schema_json: schema, data_json: data, updated_at: new Date().toISOString() })
      .eq('id', table.id);
    if (uerr) throw uerr;
  } catch (e) {
    console.warn('[forms] insertIntoTableFromFormSubmission error', (e as any)?.message || e);
  }
}


