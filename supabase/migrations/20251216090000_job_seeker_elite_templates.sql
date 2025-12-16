-- Job Seeker Elite: Resume Templates + Landing Themes
-- Adds:
--  - resume_templates (seed 5)
--  - landing_themes (seed 10)
--  - user_resume_settings (selected_template_id per user)
--  - user_landing_settings (selected_theme_id per user)

-- ---------------------------------------------------------------------------
-- Resume templates
create table if not exists public.resume_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_ats_safe boolean not null default false,
  is_one_page boolean not null default false,
  tags text[] not null default '{}'::text[],
  preview_image_url text null,
  template_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger resume_templates_set_updated_at
before update on public.resume_templates
for each row execute function update_updated_at_column();

alter table public.resume_templates enable row level security;

drop policy if exists "resume_templates_read" on public.resume_templates;
create policy "resume_templates_read"
on public.resume_templates
for select
using (auth.role() in ('authenticated', 'service_role'));

-- ---------------------------------------------------------------------------
-- Landing themes
create table if not exists public.landing_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tags text[] not null default '{}'::text[],
  preview_image_url text null,
  theme_config jsonb not null default '{}'::jsonb,
  theme_html text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger landing_themes_set_updated_at
before update on public.landing_themes
for each row execute function update_updated_at_column();

alter table public.landing_themes enable row level security;

drop policy if exists "landing_themes_read" on public.landing_themes;
create policy "landing_themes_read"
on public.landing_themes
for select
using (auth.role() in ('authenticated', 'service_role'));

-- ---------------------------------------------------------------------------
-- Per-user selections (settings)
create table if not exists public.user_resume_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_template_id uuid references public.resume_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_resume_settings_set_updated_at
before update on public.user_resume_settings
for each row execute function update_updated_at_column();

alter table public.user_resume_settings enable row level security;

drop policy if exists "user_resume_settings_select_own" on public.user_resume_settings;
create policy "user_resume_settings_select_own"
on public.user_resume_settings
for select
using (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "user_resume_settings_insert_own" on public.user_resume_settings;
create policy "user_resume_settings_insert_own"
on public.user_resume_settings
for insert
with check (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "user_resume_settings_update_own" on public.user_resume_settings;
create policy "user_resume_settings_update_own"
on public.user_resume_settings
for update
using (auth.uid() = user_id or auth.role() = 'service_role')
with check (auth.uid() = user_id or auth.role() = 'service_role');

-- Landing settings
create table if not exists public.user_landing_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_theme_id uuid references public.landing_themes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_landing_settings_set_updated_at
before update on public.user_landing_settings
for each row execute function update_updated_at_column();

alter table public.user_landing_settings enable row level security;

drop policy if exists "user_landing_settings_select_own" on public.user_landing_settings;
create policy "user_landing_settings_select_own"
on public.user_landing_settings
for select
using (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "user_landing_settings_insert_own" on public.user_landing_settings;
create policy "user_landing_settings_insert_own"
on public.user_landing_settings
for insert
with check (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "user_landing_settings_update_own" on public.user_landing_settings;
create policy "user_landing_settings_update_own"
on public.user_landing_settings
for update
using (auth.uid() = user_id or auth.role() = 'service_role')
with check (auth.uid() = user_id or auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Seeds (idempotent)

-- Resume template ids (stable UUIDs so frontend can reliably reference)
insert into public.resume_templates (id, name, slug, is_ats_safe, is_one_page, tags, preview_image_url, template_config)
values
  (
    'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c001',
    'ATS-Safe Classic',
    'ats_safe_classic',
    true,
    true,
    array['ats','classic','onepage','minimal'],
    null,
    jsonb_build_object(
      'layout', 'single',
      'fontFamily', 'Inter, ui-sans-serif, system-ui',
      'accentColor', '#365F91',
      'baseFontPt', 9,
      'nameFontPt', 18,
      'sectionTitleStyle', jsonb_build_object('transform','uppercase','letterSpacing','0.06em')
    )
  ),
  (
    'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c002',
    'Executive Sidebar',
    'executive_sidebar',
    false,
    false,
    array['design','leadership','twoColumn','sidebar'],
    null,
    jsonb_build_object(
      'layout', 'twoColumn',
      'sidebar', true,
      'fontFamily', 'Inter, ui-sans-serif, system-ui',
      'accentColor', '#4F46E5',
      'baseFontPt', 9,
      'nameFontPt', 18,
      'sidebarSections', jsonb_build_array('summary','skills')
    )
  ),
  (
    'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c003',
    'Modern Timeline',
    'modern_timeline',
    false,
    false,
    array['design','timeline','storytelling','twoColumn'],
    null,
    jsonb_build_object(
      'layout', 'single',
      'fontFamily', 'Inter, ui-sans-serif, system-ui',
      'accentColor', '#10B981',
      'baseFontPt', 9,
      'nameFontPt', 18,
      'experienceStyle', 'timeline'
    )
  ),
  (
    'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c004',
    'Compact Operator',
    'compact_operator',
    true,
    true,
    array['ats','compact','onepage','operator'],
    null,
    jsonb_build_object(
      'layout', 'single',
      'fontFamily', 'Inter, ui-sans-serif, system-ui',
      'accentColor', '#111827',
      'baseFontPt', 8.5,
      'nameFontPt', 17,
      'spacing', jsonb_build_object('sectionMarginPt', 8)
    )
  ),
  (
    'a2a5a4f9-5d15-4b9b-b0d0-9bb8d2b0c005',
    'Brand Header Clean',
    'brand_header_clean',
    false,
    true,
    array['design','brand','onepage','clean'],
    null,
    jsonb_build_object(
      'layout', 'single',
      'fontFamily', 'Inter, ui-sans-serif, system-ui',
      'accentColor', '#7C3AED',
      'baseFontPt', 9,
      'nameFontPt', 18,
      'headerStyle', 'brand'
    )
  )
on conflict (slug) do update set
  name = excluded.name,
  is_ats_safe = excluded.is_ats_safe,
  is_one_page = excluded.is_one_page,
  tags = excluded.tags,
  preview_image_url = excluded.preview_image_url,
  template_config = excluded.template_config,
  updated_at = now();

-- Landing theme ids (stable UUIDs)
insert into public.landing_themes (id, name, slug, tags, preview_image_url, theme_config, theme_html)
values
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d001',
    'Minimal Clean',
    'minimal_clean',
    array['clean','executive','minimal'],
    null,
    jsonb_build_object('accentColor', '#4F46E5'),
    '<div style="min-height:100vh;background:#0b1220;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:28px 18px;"><div style="max-width:980px;margin:0 auto;border:1px solid rgba(255,255,255,.10);border-radius:18px;background:rgba(255,255,255,.04);padding:22px;">{{content}}</div></div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d002',
    'Modern Gradient Hero',
    'modern_gradient_hero',
    array['modern','hero','gradient'],
    null,
    jsonb_build_object('accentColor', '#22C55E'),
    '<div style="min-height:100vh;background:radial-gradient(900px 600px at 20% 10%, rgba(99,102,241,0.35), transparent 60%),radial-gradient(800px 500px at 80% 25%, rgba(34,197,94,0.22), transparent 65%),#070A0F;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:28px 18px;">{{content}}</div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d003',
    'Executive Serif',
    'executive_serif',
    array['executive','clean','serif'],
    null,
    jsonb_build_object('fontFamily', 'Georgia, ui-serif, serif'),
    '<div style="min-height:100vh;background:#060914;color:rgba(255,255,255,.92);font-family:Georgia, ui-serif, serif;padding:28px 18px;"><div style="max-width:980px;margin:0 auto;border:1px solid rgba(255,255,255,.10);border-radius:20px;background:rgba(255,255,255,.04);padding:26px;">{{content}}</div></div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d004',
    'Sales Leader Metrics',
    'sales_leader_metrics',
    array['sales','metrics','modern'],
    null,
    jsonb_build_object('accentColor', '#F59E0B'),
    '<div style="min-height:100vh;background:#070A0F;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:28px 18px;"><div style="max-width:1040px;margin:0 auto;">{{content}}</div><div style="position:fixed;inset:auto 18px 18px auto;opacity:.22;font-weight:700;">METRICS</div></div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d005',
    'Product PM Case Study',
    'product_pm_case_study',
    array['product','pm','case_study'],
    null,
    jsonb_build_object('accentColor', '#06B6D4'),
    '<div style="min-height:100vh;background:#071017;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:28px 18px;"><div style="max-width:980px;margin:0 auto;border-left:3px solid rgba(6,182,212,.55);padding-left:18px;">{{content}}</div></div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d006',
    'Engineer Builder',
    'engineer_builder',
    array['engineer','builder','minimal'],
    null,
    jsonb_build_object('accentColor', '#A855F7'),
    '<div style="min-height:100vh;background:#050816;color:rgba(255,255,255,.92);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:28px 18px;"><div style="max-width:980px;margin:0 auto;border:1px solid rgba(255,255,255,.10);border-radius:16px;background:rgba(255,255,255,.03);padding:20px;">{{content}}</div></div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d007',
    'Creative Portfolio',
    'creative_portfolio',
    array['portfolio','creative','modern'],
    null,
    jsonb_build_object('accentColor', '#EC4899'),
    '<div style="min-height:100vh;background:radial-gradient(700px 500px at 60% 20%, rgba(236,72,153,0.22), transparent 60%),#070A0F;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:28px 18px;">{{content}}</div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d008',
    'Healthcare Trust',
    'healthcare_trust',
    array['healthcare','trust','clean'],
    null,
    jsonb_build_object('accentColor', '#22C55E'),
    '<div style="min-height:100vh;background:#06151a;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:28px 18px;"><div style="max-width:980px;margin:0 auto;border:1px solid rgba(34,197,94,.22);border-radius:18px;background:rgba(255,255,255,.03);padding:22px;">{{content}}</div></div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d009',
    'Startup Operator',
    'startup_operator',
    array['startup','operator','modern'],
    null,
    jsonb_build_object('accentColor', '#84CC16'),
    '<div style="min-height:100vh;background:#070A0F;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:28px 18px;"><div style="max-width:980px;margin:0 auto;border:1px dashed rgba(255,255,255,.18);border-radius:18px;padding:22px;">{{content}}</div></div>'
  ),
  (
    'b3b5b4f9-5d15-4b9b-b0d0-9bb8d2b0d010',
    'Bold Dark Neon',
    'bold_dark_neon',
    array['dark','modern','sales'],
    null,
    jsonb_build_object('accentColor', '#A855F7'),
    '<div style="min-height:100vh;background:radial-gradient(900px 520px at 20% 0%, rgba(168,85,247,0.22), transparent 52%),radial-gradient(900px 520px at 90% 10%, rgba(16,185,129,0.18), transparent 46%),#070A0F;color:rgba(255,255,255,.92);font-family:ui-sans-serif,system-ui;padding:28px 18px;">{{content}}</div>'
  )
on conflict (slug) do update set
  name = excluded.name,
  tags = excluded.tags,
  preview_image_url = excluded.preview_image_url,
  theme_config = excluded.theme_config,
  theme_html = excluded.theme_html,
  updated_at = now();

