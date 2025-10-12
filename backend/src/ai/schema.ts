import { z } from 'zod';

export const ParsedExperience = z.object({
  company: z.string().optional(),
  title: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export const ParsedEducation = z.object({
  school: z.string().optional(),
  degree: z.string().optional(),
  field: z.string().optional(),
  start_year: z.number().int().optional(),
  end_year: z.number().int().optional(),
});

export const ParsedResumeSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).default([]),
  soft_skills: z.array(z.string()).default([]),
  tech: z.array(z.string()).default([]),
  experience: z.array(ParsedExperience).default([]),
  education: z.array(ParsedEducation).default([]),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;


