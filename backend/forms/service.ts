import type { Request } from 'express';
import {
  createFormRepo,
  createResponseRepo,
  deleteFormRepo,
  getFormByIdRepo,
  getFormBySlugRepo,
  getFormBySlugPublicRepo,
  getFormWithFieldsRepo,
  getResponseDetailRepo,
  insertResponseValuesRepo,
  listFormsRepo,
  listResponsesRepo,
  publishFormRepo,
  updateFormRepo,
  upsertFieldsRepo,
} from './repo';
import type { FieldUpsertDto, FormCreateDto, FormPatchDto, SubmissionPayloadDto } from './dto';
import { supabaseDb } from '../lib/supabase';
import type { FormWithFields } from '../shared/types/forms';
import { GTM_STRATEGY_FORM_SLUG, handleGtmStrategyFormSubmission } from './workflows/gtmStrategy';

const PUBLIC_FORM_SLUG_ALLOWLIST = new Set([GTM_STRATEGY_FORM_SLUG]);

// Optional integrations (no-ops if missing or misconfigured)
async function emitFormSubmitted(form: FormWithFields, responseId: string) {
  try {
    const { emitZapEvent, ZAP_EVENT_TYPES } = await import('../lib/zapEventEmitter');
    await emitZapEvent({
      userId: form.user_id,
      eventType: (ZAP_EVENT_TYPES as any).FORM_SUBMITTED || 'form_submitted',
      eventData: { form, response_id: responseId },
      sourceTable: 'forms',
      sourceId: form.id,
    } as any);
  } catch {}
  try {
    const { sendFormSubmissionSlack } = await import('../integrations/slack').catch(() => ({ sendFormSubmissionSlack: async () => {} }));
    await sendFormSubmissionSlack(form, responseId);
  } catch {}
  try {
    const { sendZapierWebhook } = await import('../integrations/zapier').catch(() => ({ sendZapierWebhook: async () => {} }));
    await sendZapierWebhook({ type: 'form.submitted', form, response_id: responseId });
  } catch {}
}

export async function listForms(userId: string, page = 1, q?: string) {
  return listFormsRepo(userId, page, q);
}

export async function createForm(userId: string, workspaceId: string, payload: FormCreateDto) {
  return createFormRepo(userId, workspaceId, payload as any);
}

export async function getForm(id: string, userId: string) {
  return getFormWithFieldsRepo(id, userId);
}

export async function getFormPublicBySlug(slug: string) {
  const form = await getFormBySlugPublicRepo(slug);
  if (form) return form;
  if (!PUBLIC_FORM_SLUG_ALLOWLIST.has(slug)) return null;
  return getFormBySlugRepo(slug);
}

export async function updateForm(id: string, patch: FormPatchDto, userId: string) {
  return updateFormRepo(id, patch as any, userId);
}

export async function removeForm(id: string, userId: string) {
  return deleteFormRepo(id, userId);
}

export async function upsertFields(id: string, fields: FieldUpsertDto[], userId: string) {
  // Ensure form ownership
  await getFormByIdRepo(id, userId);
  return upsertFieldsRepo(id, fields as any);
}

export async function togglePublish(id: string, isPublic: boolean, userId: string) {
  return publishFormRepo(id, isPublic, userId);
}

export async function submitFormBySlug(req: Request, slug: string, payload: SubmissionPayloadDto) {
  const form = await getFormPublicBySlug(slug);
  if (!form) throw new Error('form_not_found_or_not_public');
  const response = await createResponseRepo(form.id, {
    source: payload.source || 'direct',
    meta: payload.meta || null,
    submitted_by_ip: (req.headers['x-forwarded-for'] as string) || (req as any).ip || null,
    user_agent: req.headers['user-agent'] || null,
  });
  const valuesInsert = (payload.values || []).map(v => ({
    response_id: response.id,
    field_id: v.field_id,
    value: v.value ?? null,
    json_value: v.json_value ?? null,
    file_url: v.file_url ?? null,
  }));
  await insertResponseValuesRepo(valuesInsert);

  // Custom workflow: GTM Strategy form → create lead under specific owner + tag + send access email.
  // Non-fatal: never block form submissions on workflow failures.
  if (slug === GTM_STRATEGY_FORM_SLUG) {
    try {
      await handleGtmStrategyFormSubmission(form, payload);
    } catch (e: any) {
      console.warn('[forms] gtm-strategy workflow error', e?.message || e);
    }
  }

  // Route destination (minimal, safe no-ops)
  try {
    switch (form.destination_type) {
      case 'lead': {
        const { createLeadFromFormSubmission } = await import('./targets/leads').catch(() => ({ createLeadFromFormSubmission: async () => {} }));
        await createLeadFromFormSubmission(form, response.id);
        break;
      }
      case 'candidate': {
        const { createCandidateFromFormSubmission } = await import('./targets/candidates').catch(() => ({ createCandidateFromFormSubmission: async () => {} }));
        await createCandidateFromFormSubmission(form, response.id);
        break;
      }
      case 'table':
      default: {
        const { insertIntoTableFromFormSubmission } = await import('./targets/table').catch(() => ({ insertIntoTableFromFormSubmission: async () => {} }));
        await insertIntoTableFromFormSubmission(form, response.id);
        break;
      }
    }
  } catch (e) {
    // Log but do not fail submission
    console.warn('[forms] destination routing error', (e as any)?.message || e);
  }

  await emitFormSubmitted(form, response.id);
  return { form, responseId: response.id };
}

export async function listResponses(formId: string, page = 1, userId: string) {
  // Ensure ownership
  await getFormByIdRepo(formId, userId);
  return listResponsesRepo(formId, page);
}

export async function getResponseDetail(formId: string, responseId: string, userId: string) {
  await getFormByIdRepo(formId, userId);
  return getResponseDetailRepo(formId, responseId);
}


