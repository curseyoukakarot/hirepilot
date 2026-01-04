import type { FormWithFields } from '../../shared/types/forms';
import type { SubmissionPayloadDto } from '../dto';
import { supabaseDb } from '../../lib/supabase';
import { sendGtmStrategyAccessEmail } from '../../src/lib/emails/gtmStrategyAccessEmail';

export const GTM_STRATEGY_FORM_SLUG = 'gtm-strategy';
export const GTM_LEAD_TAG = 'GTM-Lead';
export const GTM_LEAD_OWNER_USER_ID = '02a42d5c-0f65-4c58-8175-8304610c2ddc';

function normalizeTag(t: string) {
  return String(t || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function pickEmail(form: FormWithFields, byFieldId: Record<string, any>): string | null {
  const emailField = (form.fields || []).find((f: any) => f.type === 'email');
  const raw = emailField ? byFieldId[emailField.id] : null;
  const email = raw ? String(raw).trim() : '';
  return email ? email : null;
}

function pickName(form: FormWithFields, byFieldId: Record<string, any>) {
  const fields = form.fields || [];
  let firstName: string | null = null;
  let lastName: string | null = null;

  for (const f of fields) {
    const label = String((f as any).label || '').toLowerCase();
    if (!firstName && /first/.test(label) && /name/.test(label)) firstName = String(byFieldId[(f as any).id] || '') || null;
    if (!lastName && /last/.test(label) && /name/.test(label)) lastName = String(byFieldId[(f as any).id] || '') || null;
  }

  if (!firstName && !lastName) {
    const nameField = fields.find((f: any) => String(f.label || '').toLowerCase().includes('name'));
    const full = nameField ? String(byFieldId[(nameField as any).id] || '') : '';
    if (full) {
      const parts = full.trim().split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(' ') || null;
    }
  }

  return { firstName, lastName };
}

export async function handleGtmStrategyFormSubmission(form: FormWithFields, payload: SubmissionPayloadDto) {
  // Map field_id -> scalar/json/file
  const byFieldId: Record<string, any> = {};
  for (const v of payload.values || []) {
    byFieldId[v.field_id] = v.value ?? (v as any).json_value ?? (v as any).file_url ?? null;
  }

  const email = pickEmail(form, byFieldId);
  if (!email) return { ok: false, reason: 'missing_email' as const };

  const { firstName, lastName } = pickName(form, byFieldId);
  const name =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    email ||
    'Unnamed';

  // Upsert lead for the specified owner user
  const { data: existing } = await supabaseDb
    .from('leads')
    .select('id,email,tags,first_name,last_name,name,user_id')
    .eq('user_id', GTM_LEAD_OWNER_USER_ID)
    .eq('email', email)
    .maybeSingle();

  const desiredTagNorm = normalizeTag(GTM_LEAD_TAG);

  if (existing?.id) {
    const prevTags = Array.isArray((existing as any).tags) ? ((existing as any).tags as string[]) : [];
    const prevNorm = new Set(prevTags.map(normalizeTag));
    const alreadyTagged = prevNorm.has(desiredTagNorm);
    const nextTags = alreadyTagged ? prevTags : Array.from(new Set([...prevTags, GTM_LEAD_TAG]));

    if (!alreadyTagged) {
      await supabaseDb
        .from('leads')
        .update({ tags: nextTags, updated_at: new Date().toISOString() } as any)
        .eq('id', existing.id)
        .eq('user_id', GTM_LEAD_OWNER_USER_ID);
    }

    // Send email only when GTM tag is newly added
    if (!alreadyTagged) {
      await sendGtmStrategyAccessEmail({
        to: email,
        firstName,
        ownerUserId: GTM_LEAD_OWNER_USER_ID,
      });
      return { ok: true, leadId: existing.id, emailed: true as const, created: false as const };
    }
    return { ok: true, leadId: existing.id, emailed: false as const, created: false as const };
  }

  const insertRow: any = {
    user_id: GTM_LEAD_OWNER_USER_ID,
    first_name: firstName,
    last_name: lastName,
    name,
    email,
    source: 'gtm_strategy_form',
    tags: [GTM_LEAD_TAG],
    campaign_id: null,
    created_at: new Date().toISOString(),
  };

  const { data: created, error: insErr } = await supabaseDb
    .from('leads')
    .insert(insertRow)
    .select('id')
    .single();
  if (insErr) throw insErr;

  await sendGtmStrategyAccessEmail({
    to: email,
    firstName,
    ownerUserId: GTM_LEAD_OWNER_USER_ID,
  });

  return { ok: true, leadId: (created as any)?.id as string, emailed: true as const, created: true as const };
}


