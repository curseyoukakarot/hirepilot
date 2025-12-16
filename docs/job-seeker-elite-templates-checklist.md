## Manual test checklist — Job Seeker Elite Templates (Resume + Landing)

### DB / seeds
- [ ] Run migrations; confirm tables exist: `resume_templates`, `landing_themes`, `user_resume_settings`, `user_landing_settings`
- [ ] Confirm seed counts: 5 resume templates, 10 landing themes
- [ ] Confirm RLS enabled and:
  - [ ] authenticated users can `select` templates/themes
  - [ ] users can only `select/insert/update` their own settings rows

### Backend API
- [ ] As authenticated **non-elite** user:
  - [ ] `GET /api/resume-templates` returns templates list (200)
  - [ ] `POST /api/resume-templates/select` returns 403 `{ code: "ELITE_REQUIRED" }`
  - [ ] `GET /api/landing-themes` returns themes list (200)
  - [ ] `POST /api/landing-themes/select` returns 403 `{ code: "ELITE_REQUIRED" }`
- [ ] As authenticated **elite** user:
  - [ ] selecting a template/theme returns 200 and persists selection (re-fetch reflects selected id)

### Frontend pages
- [ ] Visit `/prep/resume/templates`
  - [ ] Search + filters work
  - [ ] Preview modal opens/closes
  - [ ] Elite: Apply updates “Current Template” pill + persists on refresh
  - [ ] Non-elite: Apply shows upgrade CTA (does not change selection)
- [ ] Visit `/prep/landing/themes`
  - [ ] Search + tag filters work
  - [ ] Preview modal opens/closes
  - [ ] Elite: Apply persists selection on refresh
  - [ ] Non-elite: Apply shows upgrade CTA

### Integration
- [ ] Resume export (`Download` in Resume Builder) still works and uses selected template config (default to `ats_safe_classic` if unset)
- [ ] Landing builder preview is wrapped with selected theme wrapper (default to `minimal_clean` if unset)

