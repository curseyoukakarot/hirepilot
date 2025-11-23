import { z } from 'zod';
import type { FormDestinationType, FormFieldType } from '../shared/types/forms';

export const formCreateDto = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().optional(), // server will generate if missing
  is_public: z.boolean().optional().default(false),
  theme: z.record(z.any()).optional(),
  destination_type: z.custom<FormDestinationType>().optional().default('table'),
  destination_target_id: z.string().uuid().nullable().optional(),
  job_req_id: z.string().uuid().nullable().optional(),
});
export type FormCreateDto = z.infer<typeof formCreateDto>;

export const formPatchDto = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  is_public: z.boolean().optional(),
  theme: z.record(z.any()).optional(),
  destination_type: z.custom<FormDestinationType>().optional(),
  destination_target_id: z.string().uuid().nullable().optional(),
  job_req_id: z.string().uuid().nullable().optional(),
});
export type FormPatchDto = z.infer<typeof formPatchDto>;

export const fieldUpsertDto = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  type: z.custom<FormFieldType>(),
  placeholder: z.string().nullable().optional(),
  help_text: z.string().nullable().optional(),
  required: z.boolean().optional().default(false),
  options: z.any().optional(),
  width: z.enum(['full', 'half', 'third']).optional().default('full'),
  position: z.number().int().nonnegative().optional().default(0),
});
export type FieldUpsertDto = z.infer<typeof fieldUpsertDto>;

export const fieldsUpsertArrayDto = z.array(fieldUpsertDto);

export const submissionValueDto = z.object({
  field_id: z.string().uuid(),
  value: z.string().nullable().optional(),
  json_value: z.any().optional(),
  file_url: z.string().url().optional(),
});

export const submissionPayloadDto = z.object({
  values: z.array(submissionValueDto),
  source: z.enum(['embed', 'direct']).optional().default('direct'),
  meta: z.record(z.any()).optional(),
});
export type SubmissionPayloadDto = z.infer<typeof submissionPayloadDto>;


