import { z } from 'zod';

// helpers to accept nulls from LLM output and coerce to undefined/empty
const StrOptNull = z.string().nullable().optional();
const YearOptNull = z.union([z.number().int(), z.string().regex(/^\d{4}$/).transform(s=>Number(s))]).optional().or(z.null()).transform(v => (v === null ? undefined : (typeof v === 'string' ? Number(v) : v)));
const ArrStrCoerce = z.preprocess((v) => Array.isArray(v) ? v : (v == null ? [] : [String(v)]), z.array(z.string()));

export const ParsedExperience = z.object({
  company: StrOptNull,
  title: StrOptNull,
  start_date: StrOptNull,
  end_date: StrOptNull,
  location: StrOptNull,
  description: StrOptNull,
});

export const ParsedEducation = z.object({
  school: StrOptNull,
  degree: StrOptNull,
  field: StrOptNull,
  start_year: YearOptNull,
  end_year: YearOptNull,
});

export const ParsedResumeSchema = z.object({
  name: StrOptNull,
  title: StrOptNull,
  email: StrOptNull,
  phone: StrOptNull,
  linkedin: StrOptNull,
  summary: StrOptNull,
  skills: ArrStrCoerce.default([]),
  soft_skills: ArrStrCoerce.default([]),
  tech: ArrStrCoerce.default([]),
  experience: z.preprocess((v)=> Array.isArray(v)? v : [], z.array(ParsedExperience)).default([]),
  education: z.preprocess((v)=> Array.isArray(v)? v : [], z.array(ParsedEducation)).default([]),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;


