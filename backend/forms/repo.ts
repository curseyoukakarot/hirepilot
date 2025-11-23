import { supabaseDb } from '../lib/supabase';
import type {
  FormFieldRecord,
  FormRecord,
  FormResponseRecord,
  FormResponseValueRecord,
  FormWithFields,
} from '../shared/types/forms';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

export async function listFormsRepo(userId: string, page = 1, q?: string) {
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabaseDb
    .from('forms')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (q && q.trim().length > 0) {
    query = query.ilike('title', `%${q}%`);
  }
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { items: (data || []) as FormRecord[], total: count || 0, page, pageSize };
}

export async function createFormRepo(userId: string, workspaceId: string, params: Partial<FormRecord>) {
  const baseSlug = params.slug || slugify(params.title || 'form');
  let slug = baseSlug;
  // Ensure uniqueness by appending suffix if needed
  for (let i = 1; i < 50; i++) {
    const { data: existing } = await supabaseDb
      .from('forms')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${i}`;
  }
  const insert: Partial<FormRecord> = {
    user_id: userId,
    workspace_id: workspaceId,
    title: params.title || 'Untitled Form',
    description: params.description || null,
    slug,
    is_public: params.is_public ?? false,
    theme: params.theme || {},
    destination_type: (params as any).destination_type || 'table',
    destination_target_id: (params as any).destination_target_id || null,
    job_req_id: (params as any).job_req_id || null,
  };
  const { data, error } = await supabaseDb.from('forms').insert(insert).select('*').single();
  if (error) throw error;
  return data as FormRecord;
}

export async function getFormByIdRepo(id: string, userId?: string) {
  let query = supabaseDb.from('forms').select('*').eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.single();
  if (error) throw error;
  return data as FormRecord;
}

export async function getFormWithFieldsRepo(id: string, userId?: string): Promise<FormWithFields> {
  const form = await getFormByIdRepo(id, userId);
  const { data: fields, error: ferr } = await supabaseDb
    .from('form_fields')
    .select('*')
    .eq('form_id', id)
    .order('position', { ascending: true });
  if (ferr) throw ferr;
  return { ...(form as FormRecord), fields: (fields || []) as FormFieldRecord[] };
}

export async function getFormBySlugPublicRepo(slug: string): Promise<FormWithFields | null> {
  const { data: form } = await supabaseDb
    .from('forms')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();
  if (!form) return null;
  const { data: fields } = await supabaseDb
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('position', { ascending: true });
  return { ...(form as any), fields: (fields || []) as FormFieldRecord[] };
}

export async function updateFormRepo(id: string, patch: Partial<FormRecord>, userId?: string) {
  let q = supabaseDb.from('forms').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q.select('*').single();
  if (error) throw error;
  return data as FormRecord;
}

export async function deleteFormRepo(id: string, userId?: string) {
  let q = supabaseDb.from('forms').delete().eq('id', id);
  if (userId) q = q.eq('user_id', userId);
  const { error } = await q;
  if (error) throw error;
  return true;
}

export async function upsertFieldsRepo(formId: string, fields: Partial<FormFieldRecord>[]) {
  // Normalize positions
  const normalized = fields
    .map((f, idx) => ({
      id: f.id,
      form_id: formId,
      label: f.label,
      type: f.type,
      placeholder: f.placeholder ?? null,
      help_text: f.help_text ?? null,
      required: !!f.required,
      options: f.options ?? null,
      width: (f.width as any) || 'full',
      position: typeof f.position === 'number' ? f.position : idx,
      updated_at: new Date().toISOString(),
    }))
    // Ensure sections can be included but still stored
    ;
  const { data, error } = await supabaseDb.from('form_fields').upsert(normalized as any, { onConflict: 'id' }).select('*');
  if (error) throw error;
  // Cleanup: ensure only provided fields remain
  try {
    const { data: existing } = await supabaseDb
      .from('form_fields')
      .select('id')
      .eq('form_id', formId);
    const providedIds = new Set(normalized.filter(n => !!n.id).map(n => String(n.id)));
    const toDelete = (existing || [])
      .map(r => (r as any).id as string)
      .filter(id => !providedIds.has(id));
    if (toDelete.length) {
      await supabaseDb.from('form_fields').delete().in('id', toDelete);
    }
  } catch (e) {
    // non-fatal
  }
  return (data || []) as FormFieldRecord[];
}

export async function publishFormRepo(id: string, isPublic: boolean, userId?: string) {
  // Load current form
  const form = await getFormByIdRepo(id, userId);
  let nextSlug = form.slug;
  const desired = slugify(form.title || 'form');
  // If the current slug is default-ish or empty, or still "untitled", regenerate from current title
  const isDefaultSlug = !nextSlug || /^untitled(-|$)|^untitled-form(-|$)|^form(-|$)/.test(nextSlug);
  if (isDefaultSlug && desired && desired !== nextSlug) {
    // ensure uniqueness
    let candidate = desired;
    for (let i = 1; i < 100; i++) {
      const { data: existing } = await supabaseDb.from('forms').select('id').eq('slug', candidate).maybeSingle();
      if (!existing || (existing as any).id === id) break;
      candidate = `${desired}-${i}`;
    }
    nextSlug = candidate;
  }
  return updateFormRepo(id, { is_public: isPublic, slug: nextSlug } as any, userId);
}

export async function createResponseRepo(
  formId: string,
  payload: { source?: string | null; meta?: any | null; submitted_by_ip?: string | null; user_agent?: string | null }
): Promise<FormResponseRecord> {
  const insert = {
    form_id: formId,
    source: payload.source || null,
    meta: payload.meta || null,
    submitted_by_ip: payload.submitted_by_ip || null,
    user_agent: payload.user_agent || null,
  };
  const { data, error } = await supabaseDb.from('form_responses').insert(insert).select('*').single();
  if (error) throw error;
  return data as FormResponseRecord;
}

export async function insertResponseValuesRepo(values: Partial<FormResponseValueRecord>[]) {
  if (!values.length) return [];
  const { data, error } = await supabaseDb.from('form_response_values').insert(values).select('*');
  if (error) throw error;
  return (data || []) as FormResponseValueRecord[];
}

export async function listResponsesRepo(formId: string, page = 1) {
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabaseDb
    .from('form_responses')
    .select('*', { count: 'exact' })
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  const responses = (data || []) as FormResponseRecord[];
  // Fetch values for these responses
  const ids = responses.map(r => r.id);
  let values: FormResponseValueRecord[] = [];
  if (ids.length) {
    const { data: vals } = await supabaseDb
      .from('form_response_values')
      .select('*')
      .in('response_id', ids);
    values = (vals || []) as FormResponseValueRecord[];
  }
  return { items: responses, values, total: count || 0, page, pageSize };
}

export async function getResponseDetailRepo(formId: string, responseId: string) {
  const { data: response, error } = await supabaseDb
    .from('form_responses')
    .select('*')
    .eq('id', responseId)
    .eq('form_id', formId)
    .single();
  if (error) throw error;
  const { data: values, error: vErr } = await supabaseDb
    .from('form_response_values')
    .select('*')
    .eq('response_id', responseId);
  if (vErr) throw vErr;
  return { response: response as FormResponseRecord, values: (values || []) as FormResponseValueRecord[] };
}


