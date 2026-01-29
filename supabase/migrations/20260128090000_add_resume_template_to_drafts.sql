alter table public.job_resume_drafts
  add column if not exists template_slug text,
  add column if not exists template_id uuid references public.resume_templates(id);
